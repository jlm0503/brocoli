import type { CicloCerrado, ViajeHistorico, EstatusLiquidacion, EvaluacionViaje, Liquidacion, ProblemaEvaluado, RepartoKg, Viaje } from "./types";
import type { AlertaDireccion, ConceptoGasto, Devolucion, EstadoUbicacion, Extraordinario, FotoGps, GastoRancho, LineaExtra, RepartoCultivo, RepartoExtra } from "./types";
import type {
  Adicional,
  AlertaInsumos,
  ClaveParametro,
  Cultivo,
  CultivoCat,
  DosisPorSemana,
  EstatusRecepcion,
  EstatusSolicitud,
  EstatusTabla,
  InsumoAsignado,
  LineaDemanda,
  LineaSolicitud,
  Lote,
  MovimientoPlanta,
  Parametro,
  PedidoPlaneacion,
  Producto,
  Familia,
  Receta,
  Recetas,
  Recepcion,
  Rancho,
  Semaforo,
  SolicitudPlanta,
  EntregaPlanta,
  Tabla,
  Variedad,
} from "./types";

/* ───────────────────────── Semanas ───────────────────────── */

/** Semana de receta en que se entrega el paquete de planeación. */
export const SEMANA_PLANEACION = -2;
export const SEMANA_RECETA_MIN = -2;
/** La coliflor (95 días) llega hasta la semana 14; el brócoli hasta la 12. */
export const SEMANA_RECETA_MAX = 14;
/** -2, -1, 0, 1 … 14 */
export const SEMANAS_RECETA = Array.from(
  { length: SEMANA_RECETA_MAX - SEMANA_RECETA_MIN + 1 },
  (_, i) => SEMANA_RECETA_MIN + i,
);
/** Semanas de anticipación ideales para planear. Menos que esto es planeación tardía. */
export const ANTICIPACION_SEMANAS = 2;
/** Días que puede estar abierta una alerta antes de marcarse en rojo. */
export const DIAS_ALERTA_ROJA = 7;

export const FAMILIAS: Familia[] = [
  "Suelo",
  "Agroquímico",
  "Herbicida",
  "Riego",
  "Fertilizante",
  "Bioestimulante",
  "Micronutriente",
  "Fungicida",
  "Insecticida",
  "Coadyuvante",
];

export function nombreCultivo(cultivos: CultivoCat[], id: Cultivo): string {
  return cultivos.find((c) => c.id === id)?.nombre ?? id;
}

/* ───────────────────────── Parámetros con vigencia ───────────────────────── */

export const PARAMETROS_INFO: Record<
  ClaveParametro,
  { nombre: string; unidad: string; defecto: number; porVariedad: boolean }
> = {
  plantasPorHa: { nombre: "Plantas por hectárea (sugerido)", unidad: "plantas", defecto: 60000, porVariedad: true },
  costoPlantaHa: { nombre: "Costo de planta por hectárea", unidad: "MXN", defecto: 16200, porVariedad: true },
  precioKg: { nombre: "Precio por kg pagable", unidad: "MXN", defecto: 10.5, porVariedad: true },
  descuentoViaje: { nombre: "Descuento de planta por viaje", unidad: "MXN", defecto: 10000, porVariedad: false },
  metaKgHa: {
    nombre: "Meta de rendimiento por ha (alerta si cierra abajo)",
    unidad: "kg",
    defecto: 16000,
    porVariedad: true,
  },
  rollosCintaHa: { nombre: "Rollos de cinta por hectárea", unidad: "rollos", defecto: 2.1, porVariedad: true },
  diasSinEvaluacion: { nombre: "Días sin evaluación antes de alerta", unidad: "días", defecto: 3, porVariedad: false },
};

export const CLAVES_PARAMETRO = Object.keys(PARAMETROS_INFO) as ClaveParametro[];

/** Último registro de la clave vigente en `fecha` para esa variedad (o el general si `variedadId` es undefined). */
export function registroVigente(
  params: Parametro[],
  clave: ClaveParametro,
  fecha: string,
  variedadId?: string,
): Parametro | undefined {
  let mejor: Parametro | undefined;
  for (const p of params) {
    if (p.clave !== clave || p.desde > fecha || (p.variedadId ?? undefined) !== variedadId) continue;
    if (!mejor || p.desde >= mejor.desde) mejor = p;
  }
  return mejor;
}

/**
 * Valor que aplica en `fecha`: el último cambio con fecha de vigencia igual o anterior. Con variedad,
 * manda el valor propio de esa variedad vigente en la fecha; si no tiene, se usa el general.
 */
export function parametroVigente(
  params: Parametro[],
  clave: ClaveParametro,
  fecha: string,
  variedadId?: string,
): number {
  const propio =
    variedadId && PARAMETROS_INFO[clave].porVariedad
      ? registroVigente(params, clave, fecha, variedadId)
      : undefined;
  return (propio ?? registroVigente(params, clave, fecha))?.valor ?? PARAMETROS_INFO[clave].defecto;
}

/** Costo por planta = costo de planta por ha ÷ plantas por ha (16,200 ÷ 60,000 = $0.27). */
export function costoPorPlanta(params: Parametro[], fecha: string, variedadId?: string): number {
  const porHa = parametroVigente(params, "plantasPorHa", fecha, variedadId);
  return porHa > 0
    ? redondear(parametroVigente(params, "costoPlantaHa", fecha, variedadId) / porHa, 4)
    : 0;
}

/** Errores al registrar un nuevo valor de parámetro. */
export function validarParametro(
  clave: ClaveParametro,
  valor: number,
  desde: string,
): string | null {
  if (!PARAMETROS_INFO[clave]) return "Parámetro desconocido.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) return "Indica desde qué fecha aplica.";
  if (!Number.isFinite(valor) || valor < 0) return "El valor debe ser un número mayor o igual a 0.";
  return null;
}

/** Precio del producto que aplica en `fecha`: el último cambio vigente, o el precio inicial. */
export function precioVigente(p: Producto, fecha: string): number {
  let precio = p.precio;
  let desde = "";
  for (const c of p.precios ?? [])
    if (c.desde <= fecha && c.desde >= desde) [precio, desde] = [c.precio, c.desde];
  return precio;
}

/* ───────────────────────── Plantas por lote ───────────────────────── */

/** Tolerancia contra lo sugerido antes de pedir motivo. */
export const TOLERANCIA_PLANTAS = 0.1;

export function plantasSugeridas(ha: number, plantasPorHa: number): number {
  return Math.round(ha * plantasPorHa);
}

/** Las plantas difieren más de ±10% de lo sugerido. */
export function plantasFueraDeRango(plantas: number, sugeridas: number): boolean {
  if (sugeridas <= 0) return false;
  return Math.abs(plantas - sugeridas) / sugeridas > TOLERANCIA_PLANTAS + 1e-9;
}

export function validarPlantas(
  plantas: number,
  sugeridas: number,
  motivo: string | undefined,
): string | null {
  if (!Number.isInteger(plantas) || plantas <= 0) return "Indica la cantidad de plantas.";
  if (plantasFueraDeRango(plantas, sugeridas) && !motivo?.trim())
    return "Las plantas difieren más de 10% de lo sugerido: escribe el motivo.";
  return null;
}

/**
 * Etapa de una semana de receta. Con `semanaCosecha` (la del lote según su variedad),
 * de ahí en adelante es cosecha; sin ella se usan las etapas generales del brócoli.
 */
export function etapa(semanaReceta: number, semanaCosecha?: number): string {
  if (semanaReceta === -2) return "Planeación";
  if (semanaReceta === -1) return "Preparación";
  if (semanaReceta === 0) return "Plantación";
  if (semanaCosecha !== undefined) {
    if (semanaReceta >= 1 && semanaReceta < semanaCosecha) return "Desarrollo";
    if (semanaReceta >= semanaCosecha) return "Cosecha";
  }
  if (semanaReceta >= 1 && semanaReceta <= 10) return "Desarrollo";
  if (semanaReceta === 11) return "Cosecha";
  if (semanaReceta === 12) return "Máxima cosecha y cierre";
  if (semanaReceta > 12 && semanaReceta <= SEMANA_RECETA_MAX) return "Cosecha";
  return "Fuera de ciclo";
}

/** Semanas de receta que se muestran para un cultivo: de -2 hasta la cosecha de su variedad más larga (mínimo 12). */
export function semanasReceta(cultivo: Cultivo, variedades: Variedad[]): number[] {
  const max = Math.max(
    12,
    ...variedades.filter((v) => v.cultivo === cultivo).map((v) => Math.ceil(v.cicloDias / 7)),
  );
  return SEMANAS_RECETA.filter((w) => w <= Math.min(max, SEMANA_RECETA_MAX));
}

const LUNES_SEMANA_1_2026 = Date.UTC(2025, 11, 29);
const DIA = 24 * 60 * 60 * 1000;

/** Lunes de la semana ISO `w` de 2026 (la semana inicia en lunes). */
export function inicioSemana(w: number): Date {
  return new Date(LUNES_SEMANA_1_2026 + (w - 1) * 7 * DIA);
}

/** Fecha ISO de un día de la semana `w` (0 = lunes). */
export function fechaEnSemana(w: number, dia = 0): string {
  return new Date(inicioSemana(w).getTime() + dia * DIA).toISOString().slice(0, 10);
}

export function semanaDeFecha(iso: string): number {
  const t = Date.parse(iso + "T00:00:00Z");
  return Math.floor((t - LUNES_SEMANA_1_2026) / (7 * DIA)) + 1;
}

export function sumarDias(iso: string, dias: number): string {
  return new Date(Date.parse(iso + "T00:00:00Z") + dias * DIA).toISOString().slice(0, 10);
}

/** dd/mm/aa → yyyy-mm-dd */
export function fechaDeHoja(dmy: string): string {
  const [d, m, y] = dmy.split("/").map(Number);
  return `${2000 + y!}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(hasta + "T00:00:00Z") - Date.parse(desde + "T00:00:00Z")) / DIA);
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function fechaCorta(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d + "T00:00:00Z") : d;
  return `${date.getUTCDate()} ${MESES[date.getUTCMonth()]}`;
}

/** Lunes de la semana indicada, en formato corto. */
export function fechaLimite(semana: number): string {
  return fechaCorta(inicioSemana(semana));
}

/* ───────────────────────── Catálogos ───────────────────────── */

/** Radio de validación: √(ha × 10,000 ÷ 3.1416) × 1.5, mínimo 100 m, o el que fije el administrador. */
export function radioValidacion(t: Tabla): number {
  if (t.radio && t.radio > 0) return t.radio;
  return Math.max(100, Math.round(Math.sqrt((t.hectareas * 10000) / 3.1416) * 1.5));
}

export function codigoDisponible(
  productos: Producto[],
  codigo: string,
  exceptoId?: string,
): boolean {
  const c = codigo.trim().toUpperCase();
  return c.length > 0 && !productos.some((p) => p.id !== exceptoId && p.codigo.toUpperCase() === c);
}

/* ───────────────────────── Receta ───────────────────────── */

/** Receta base + adicionales de esa tabla, por semana de receta. */
export function recetaEfectiva(
  receta: Receta,
  adicionales: Adicional[],
  tablaId: string,
): DosisPorSemana {
  const out: DosisPorSemana = {};
  for (const w of SEMANAS_RECETA) out[w] = { ...(receta.dosis[w] ?? {}) };
  for (const a of adicionales) {
    if (!a.tablaIds.includes(tablaId)) continue;
    for (const w of a.semanas) {
      const sem = (out[w] ??= {});
      sem[a.productoId] = redondear((sem[a.productoId] ?? 0) + a.dosis, 4);
    }
  }
  return out;
}

export function recetaDe(recetas: Recetas, cultivo: Cultivo): Receta {
  return recetas[cultivo] ?? { dosis: {} };
}

/** La receta de un lote plantado es su copia guardada; si aún no se planta, la vigente de su cultivo. */
export function recetaLote(lote: Lote, recetas: Recetas, adicionales: Adicional[]): DosisPorSemana {
  return lote.receta ?? recetaEfectiva(recetaDe(recetas, lote.cultivo), adicionales, lote.tablaId);
}

/** Cinta del paquete de planeación: el primer producto en rollos, a los rollos por ha del parámetro. */
export interface Cinta {
  productoId: string;
  porHa: number;
}

export function cintaPlaneacion(productos: Producto[], rollosPorHa: number): Cinta | undefined {
  const p = productos.find((x) => x.unidad === "rollo");
  return p ? { productoId: p.id, porHa: rollosPorHa } : undefined;
}

/**
 * Paquete de planeación (semana -2) × hectáreas. Con `cinta`, los rollos salen del parámetro
 * (2.1/ha) en lugar de la receta y se piden completos en cada lote.
 */
export function lineasPlaneacion(
  receta: Receta,
  adicionales: Adicional[],
  tablaId: string,
  ha: number,
  cinta?: Cinta,
): { productoId: string; cantidad: number }[] {
  const sem = { ...(recetaEfectiva(receta, adicionales, tablaId)[SEMANA_PLANEACION] ?? {}) };
  if (cinta) {
    const extra = adicionales
      .filter(
        (a) =>
          a.tablaIds.includes(tablaId) &&
          a.productoId === cinta.productoId &&
          a.semanas.includes(SEMANA_PLANEACION),
      )
      .reduce((s, a) => s + a.dosis, 0);
    sem[cinta.productoId] = redondear(cinta.porHa + extra, 4);
  }
  return Object.entries(sem)
    .filter(([, d]) => d > 0)
    .map(([productoId, d]) => ({ productoId, cantidad: redondear(d * ha) }));
}

/* ───────────────────────── Lotes ───────────────────────── */

export function plantadasLote(l: Lote): number {
  return redondear(l.avances.reduce((s, a) => s + a.ha, 0));
}

export function pendientesLote(l: Lote): number {
  if (l.cancelado) return 0;
  return redondear(Math.max(0, l.ha - plantadasLote(l)));
}

/** Semana real de plantación (semana 0 del ciclo del lote). */
export function semanaRealLote(l: Lote): number | null {
  return l.avances[0]?.semana ?? null;
}

/** Semana de receta = semana calendario − semana real de plantación. */
export function semanaRecetaLote(l: Lote, semana: number): number | null {
  const real = semanaRealLote(l);
  return real === null ? null : semana - real;
}

/** Fecha de plantación: primer avance; si aún no se planta, el lunes de la semana planeada. */
export function fechaPlantacionLote(l: Lote): string {
  return l.avances[0]?.fecha ?? fechaEnSemana(l.semanaPlaneada);
}

/** Fecha estimada de cosecha: la capturada, o plantación + ciclo de la variedad. */
export function fechaCosechaLote(l: Lote): string {
  return l.fechaCosecha ?? sumarDias(fechaPlantacionLote(l), l.cicloDias);
}

/**
 * Semana de receta en que se cosecha: ciclo ÷ 7 hacia arriba (Diamante 70 días → 10,
 * Tlaloc 84 → 12, coliflor 95 → 14), o la de la fecha capturada. La receta aplica hasta ahí.
 */
export function semanaCosechaLote(l: Lote): number {
  if (l.fechaCosecha) {
    const base = semanaRealLote(l) ?? l.semanaPlaneada;
    return semanaDeFecha(l.fechaCosecha) - base;
  }
  return Math.ceil(l.cicloDias / 7);
}

/** Semanas después de la semana de cosecha en que el lote se da por terminado y libera la tabla. */
export const SEMANAS_CIERRE = 2;

/** Marca como finalizados los lotes plantados cuya cosecha ya pasó hace SEMANAS_CIERRE semanas o más. */
export function finalizarCosechados(lotes: Lote[], semanaActual: number): Lote[] {
  return lotes.map((l) => {
    const real = semanaRealLote(l);
    if (l.finalizado || l.cancelado || real === null || pendientesLote(l) > 0) return l;
    return semanaActual >= real + semanaCosechaLote(l) + SEMANAS_CIERRE
      ? { ...l, finalizado: true }
      : l;
  });
}

/** Lotes vigentes de la tabla (sin cancelados ni ciclos ya cosechados). */
export function lotesDeTabla(lotes: Lote[], tablaId: string): Lote[] {
  return lotes
    .filter((l) => l.tablaId === tablaId && !l.cancelado && !l.finalizado)
    .sort((a, b) => a.semanaPlaneada - b.semanaPlaneada || a.codigo.localeCompare(b.codigo));
}

/** El lote ya debía plantarse y aún le faltan hectáreas. */
export function lotePorPlantar(l: Lote, semanaActual: number): boolean {
  return !l.cancelado && l.semanaPlaneada <= semanaActual && pendientesLote(l) > 0;
}

/** Pendiente arrastrado: viene de otro lote o su semana planeada ya pasó sin plantarse completo. */
export function esArrastrado(l: Lote, semanaActual: number): boolean {
  return pendientesLote(l) > 0 && (!!l.origenId || l.semanaPlaneada < semanaActual);
}

export function hectareasPlaneadas(lotes: Lote[], tablaId: string): number {
  return redondear(lotesDeTabla(lotes, tablaId).reduce((s, l) => s + l.ha, 0));
}

export function hectareasPlantadas(lotes: Lote[], tablaId: string): number {
  return redondear(lotesDeTabla(lotes, tablaId).reduce((s, l) => s + plantadasLote(l), 0));
}

/** Disponibles = total − planeadas − plantadas (las plantadas ya forman parte de sus lotes). */
export function hectareasDisponibles(t: Tabla, lotes: Lote[]): number {
  return redondear(Math.max(0, t.hectareas - hectareasPlaneadas(lotes, t.id)));
}

/** En cosecha: desde la semana anterior a su cosecha estimada hasta que se finaliza. */
export function loteEnCosecha(l: Lote, semanaActual: number): boolean {
  if (l.cancelado || l.finalizado) return false;
  const sr = semanaRecetaLote(l, semanaActual);
  return sr !== null && sr >= semanaCosechaLote(l) - 1;
}

export function estatusTabla(t: Tabla, lotes: Lote[], semanaActual?: number): EstatusTabla {
  const planeadas = hectareasPlaneadas(lotes, t.id);
  const plantadas = hectareasPlantadas(lotes, t.id);
  if (planeadas <= 0) return "libre";
  if (
    semanaActual !== undefined &&
    lotesDeTabla(lotes, t.id).some((l) => loteEnCosecha(l, semanaActual))
  )
    return "en-cosecha";
  if (plantadas > 0) return plantadas >= t.hectareas ? "plantada" : "plantada-parcial";
  return planeadas >= t.hectareas ? "planeada" : "parcial-planeada";
}

export const ESTATUS_TABLA_LABEL: Record<EstatusTabla, string> = {
  libre: "Libre",
  "parcial-planeada": "Parcialmente planeada",
  planeada: "Planeada completa",
  "plantada-parcial": "Plantada parcial",
  plantada: "Plantada completa",
  "en-cosecha": "En cosecha",
};

/** Semana de cultivo de la tabla según su primer lote plantado. */
export function semanaCultivoTabla(
  lotes: Lote[],
  tablaId: string,
  semanaActual: number,
): number | null {
  const reales = lotesDeTabla(lotes, tablaId)
    .map(semanaRealLote)
    .filter((w): w is number => w !== null);
  if (reales.length === 0) return null;
  return semanaActual - Math.min(...reales);
}

/** Hectáreas plantadas que siguen dentro del ciclo (semana 0 a la de cosecha de su variedad). */
export function hectareasActivas(lotes: Lote[], tablaId: string, semanaActual: number): number {
  return redondear(
    lotesDeTabla(lotes, tablaId)
      .filter((l) => {
        const sr = semanaRecetaLote(l, semanaActual);
        return sr !== null && sr >= 0 && sr <= semanaCosechaLote(l);
      })
      .reduce((s, l) => s + plantadasLote(l), 0),
  );
}

function numeroTabla(t: Tabla): string {
  return t.nombre.replace(/^Tabla\s*/i, "").trim() || t.id;
}

/** Siguiente código de lote de la tabla: 1-A, 1-B, 1-C… */
export function siguienteCodigo(t: Tabla, lotes: Lote[]): string {
  const usados = lotes.filter((l) => l.tablaId === t.id && !l.origenId).length;
  return `${numeroTabla(t)}-${String.fromCharCode(65 + usados)}`;
}

/** Código del lote que recibe lo arrastrado: 1-A → 1-A2 → 1-A3. */
export function codigoArrastre(origen: Lote): string {
  const m = /^(.*?)(\d+)$/.exec(origen.codigo);
  if (m && /[A-Z]$/i.test(m[1]!)) return `${m[1]}${Number(m[2]) + 1}`;
  return `${origen.codigo}2`;
}

/* ───────────────────────── Planeación ───────────────────────── */

/** Errores al planear un lote. `null` si es válido. La planeación tardía NO es error. */
export function validarApartado(
  t: Tabla,
  lotes: Lote[],
  semana: number,
  ha: number,
  semanaActual: number,
): string | null {
  const disponibles = hectareasDisponibles(t, lotes);
  if (disponibles <= 0) return "Toda la tabla ya está planeada.";
  if (semana < semanaActual) return "No se puede planear en una semana que ya pasó.";
  if (!(ha > 0)) return "Indica cuántas hectáreas se van a plantar.";
  if (ha > disponibles)
    return `Solo quedan ${formatoNum(disponibles)} ha disponibles en esta tabla.`;
  return null;
}

/* ───────────────────────── Captura de catálogos ───────────────────────── */

const normal = (x: string) => x.trim().toLowerCase();

/** Errores al agregar un elemento con nombre a un catálogo (cultivo, vivero, chofer, problema…). */
export function validarNombreCatalogo(
  nombre: string,
  existentes: { id: string; nombre: string }[],
  exceptoId?: string,
): string | null {
  if (!nombre.trim()) return "Escribe el nombre.";
  if (existentes.some((x) => x.id !== exceptoId && normal(x.nombre) === normal(nombre)))
    return `Ya existe ${nombre.trim()}.`;
  return null;
}

export function validarVariedad(
  v: Omit<Variedad, "id">,
  variedades: Variedad[],
  cultivos: CultivoCat[],
): string | null {
  if (!cultivos.some((c) => c.id === v.cultivo)) return "Elige el cultivo de la variedad.";
  const err = validarNombreCatalogo(
    v.nombre,
    variedades.filter((x) => x.cultivo === v.cultivo),
  );
  if (err) return err;
  if (!Number.isInteger(v.cicloDias) || v.cicloDias <= 0)
    return "Indica los días de plantación a cosecha.";
  return null;
}

/** Errores al agregar un rancho. `null` si es válido. */
export function validarRancho(nombre: string, ranchos: Rancho[]): string | null {
  if (!nombre.trim()) return "Escribe el nombre del rancho.";
  if (ranchos.some((r) => normal(r.nombre) === normal(nombre)))
    return `Ya existe el rancho ${nombre.trim()}.`;
  return null;
}

/** Errores al agregar una tabla. El nombre no se repite dentro del mismo rancho. */
export function validarTabla(
  ranchoId: string,
  nombre: string,
  hectareas: number,
  ranchos: Rancho[],
  tablas: Tabla[],
): string | null {
  if (!ranchos.some((r) => r.id === ranchoId)) return "Elige el rancho de la tabla.";
  if (!nombre.trim()) return "Escribe el nombre de la tabla.";
  if (!(hectareas > 0)) return "Indica las hectáreas de la tabla.";
  if (tablas.some((t) => t.ranchoId === ranchoId && normal(t.nombre) === normal(nombre)))
    return `Ya existe ${nombre.trim()} en este rancho.`;
  return null;
}

/** Errores al registrar una plantación que ya se hizo (fecha de hoy o anterior). */
export function validarPlantacionPrevia(
  t: Tabla,
  lotes: Lote[],
  ha: number,
  fechaPlantacion: string,
  hoy: string,
  fechaCosecha?: string,
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaPlantacion)) return "Indica la fecha de plantación.";
  if (fechaPlantacion > hoy)
    return "La fecha de plantación no puede ser futura; para eso usa Planear lote.";
  if (fechaCosecha && fechaCosecha <= fechaPlantacion)
    return "La cosecha debe ser después de la plantación.";
  if (!(ha > 0)) return "Indica cuántas hectáreas se plantaron.";
  const disponibles = hectareasDisponibles(t, lotes);
  if (ha > disponibles)
    return `Solo quedan ${formatoNum(disponibles)} ha disponibles en esta tabla.`;
  return null;
}

/**
 * Lote ya plantado capturado a mano: se plantó completo en la fecha dada, guarda la receta vigente
 * y su paquete de planeación (semana -2) se da por pedido y entregado a tiempo.
 */
export function crearLotePlantado(p: {
  tabla: Tabla;
  lotes: Lote[];
  ha: number;
  variedad: Variedad;
  fechaPlantacion: string;
  fechaCosecha?: string | undefined;
  recetas: Recetas;
  adicionales: Adicional[];
  ingeniero: string;
  nuevoId: (prefijo: string) => string;
  cinta?: Cinta | undefined;
  plantasPorHa?: number | undefined;
}): { lote: Lote; pedido: PedidoPlaneacion | null } {
  const ha = redondear(p.ha);
  const semana = semanaDeFecha(p.fechaPlantacion);
  const loteId = p.nuevoId("lt");
  const receta = recetaDe(p.recetas, p.variedad.cultivo);
  const lineas = lineasPlaneacion(receta, p.adicionales, p.tabla.id, ha, p.cinta);
  const pedido: PedidoPlaneacion | null =
    lineas.length > 0
      ? {
          id: p.nuevoId("pp"),
          loteId,
          tablaId: p.tabla.id,
          ranchoId: p.tabla.ranchoId,
          semanaPlantacion: semana,
          ha,
          lineas,
          fecha: fechaEnSemana(semana - 3, 1),
          ingeniero: p.ingeniero,
          urgente: false,
          status: "entregado",
          fechaEntrega: fechaEnSemana(semana - 2, 2),
        }
      : null;
  const lote: Lote = {
    id: loteId,
    codigo: siguienteCodigo(p.tabla, p.lotes),
    tablaId: p.tabla.id,
    ranchoId: p.tabla.ranchoId,
    ha,
    semanaPlaneada: semana,
    ingeniero: p.ingeniero,
    avances: [{ id: p.nuevoId("av"), fecha: p.fechaPlantacion, semana, ha }],
    insumos: pedido ? pedido.lineas.map((x) => ({ ...x, pedidoId: pedido.id })) : [],
    receta: recetaEfectiva(receta, p.adicionales, p.tabla.id),
    variedadId: p.variedad.id,
    cultivo: p.variedad.cultivo,
    cicloDias: p.variedad.cicloDias,
    fechaCosecha: p.fechaCosecha || undefined,
    plantas: p.plantasPorHa ? plantasSugeridas(ha, p.plantasPorHa) : undefined,
  };
  return { lote, pedido };
}

export function semanasAnticipacion(semana: number, semanaActual: number): number {
  return semana - semanaActual;
}

export function esPlaneacionTardia(semana: number, semanaActual: number): boolean {
  return semanasAnticipacion(semana, semanaActual) < ANTICIPACION_SEMANAS;
}

/** Insumos de planeación del lote cuyo pedido ya se entregó. */
export function insumosEntregados(l: Lote, pedidos: PedidoPlaneacion[]): InsumoAsignado[] {
  const entregados = new Set(pedidos.filter((p) => p.status === "entregado").map((p) => p.id));
  return l.insumos.filter((i) => entregados.has(i.pedidoId) && i.cantidad > 0);
}

/** Lotes pendientes del rancho con insumos de planeación ya entregados (para planeación tardía). */
export function pendientesConInsumos(
  lotes: Lote[],
  pedidos: PedidoPlaneacion[],
  ranchoId: string,
  semanaActual: number,
): Lote[] {
  return lotes.filter(
    (l) =>
      l.ranchoId === ranchoId &&
      !l.sinInsumos &&
      plantadasLote(l) === 0 &&
      esArrastrado(l, semanaActual) &&
      insumosEntregados(l, pedidos).length > 0,
  );
}

export function sumarPorProducto(
  items: { productoId: string; cantidad: number }[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of items) m.set(i.productoId, redondear((m.get(i.productoId) ?? 0) + i.cantidad));
  return m;
}

/** Lo que falta pedir después de usar los insumos de pendientes. */
export function descontar(
  necesidad: { productoId: string; cantidad: number }[],
  disponibles: { productoId: string; cantidad: number }[],
): { productoId: string; cantidad: number }[] {
  const disp = sumarPorProducto(disponibles);
  return necesidad
    .map((n) => ({
      productoId: n.productoId,
      cantidad: redondear(Math.max(0, n.cantidad - (disp.get(n.productoId) ?? 0))),
    }))
    .filter((n) => n.cantidad > 0);
}

/** Verde: entregado. Rojo: no entregado y ya es semana P-1 o después. Amarillo: en tiempo. */
export function semaforoPedido(p: PedidoPlaneacion, semanaActual: number): Semaforo {
  if (p.status === "cancelado") return "gris";
  if (p.status === "entregado") return "verde";
  return semanaActual >= p.semanaPlantacion - 1 ? "rojo" : "amarillo";
}

export function semanaEntregaIdeal(p: PedidoPlaneacion): number {
  return p.semanaPlantacion - 2;
}

export function semanaEntregaLimite(p: PedidoPlaneacion): number {
  return p.semanaPlantacion - 1;
}

export function alertaVencida(a: AlertaInsumos, hoy: string): boolean {
  return a.status === "abierta" && diasEntre(a.fecha, hoy) > DIAS_ALERTA_ROJA;
}

/* ───────────────────────── Avance y arrastre ───────────────────────── */

export function validarAvance(lotesTabla: Lote[], ha: number, semanaActual: number): string | null {
  const activos = lotesTabla.filter((l) => !l.cancelado);
  if (activos.length === 0) return "La tabla no tiene lotes planeados.";
  const due = activos.filter((l) => lotePorPlantar(l, semanaActual));
  if (due.length === 0) {
    const prox = activos
      .filter((l) => pendientesLote(l) > 0)
      .sort((a, b) => a.semanaPlaneada - b.semanaPlaneada)[0];
    return prox
      ? `El siguiente lote (${prox.codigo}) está planeado para la semana ${prox.semanaPlaneada}.`
      : "La tabla ya está plantada completa.";
  }
  if (!(ha > 0)) return "Indica las hectáreas plantadas hoy.";
  const pend = redondear(due.reduce((s, l) => s + pendientesLote(l), 0));
  if (ha > pend) return `Solo quedan ${formatoNum(pend)} ha por plantar esta semana.`;
  return null;
}

/** Reparte lo plantado hoy entre los lotes que ya tocan, del más antiguo al más nuevo. */
export function repartirAvance(
  lotesTabla: Lote[],
  ha: number,
  semanaActual: number,
): { loteId: string; ha: number }[] {
  let resto = ha;
  const out: { loteId: string; ha: number }[] = [];
  const due = lotesTabla
    .filter((l) => lotePorPlantar(l, semanaActual))
    .sort((a, b) => a.semanaPlaneada - b.semanaPlaneada || a.codigo.localeCompare(b.codigo));
  for (const l of due) {
    if (resto <= 0) break;
    const toma = redondear(Math.min(resto, pendientesLote(l)));
    if (toma > 0) out.push({ loteId: l.id, ha: toma });
    resto = redondear(resto - toma);
  }
  return out;
}

function escalar(items: InsumoAsignado[], factor: number): InsumoAsignado[] {
  return items.map((i) => ({ ...i, cantidad: redondear(i.cantidad * factor) }));
}

/**
 * Al cerrar la semana `semana`: si un lote se plantó solo en parte, lo plantado se queda
 * en el lote y lo que faltó pasa a un lote pendiente nuevo para la semana siguiente,
 * con su parte de los insumos de planeación.
 */
export function cerrarSemana(lotes: Lote[], semana: number, nuevoId: () => string): Lote[] {
  const out: Lote[] = [];
  for (const l of lotes) {
    const plantadas = plantadasLote(l);
    const pend = pendientesLote(l);
    if (l.cancelado || l.semanaPlaneada > semana || plantadas === 0 || pend === 0) {
      out.push(l);
      continue;
    }
    const fPlant = plantadas / l.ha;
    // Las plantas se dividen proporcionalmente entre lo plantado y lo arrastrado.
    const plantasPlant = l.plantas !== undefined ? Math.round(l.plantas * fPlant) : undefined;
    out.push({ ...l, ha: plantadas, insumos: escalar(l.insumos, fPlant), plantas: plantasPlant });
    out.push({
      id: nuevoId(),
      codigo: codigoArrastre(l),
      tablaId: l.tablaId,
      ranchoId: l.ranchoId,
      ha: pend,
      semanaPlaneada: semana + 1,
      ingeniero: l.ingeniero,
      avances: [],
      origenId: l.id,
      insumos: escalar(l.insumos, 1 - fPlant),
      sinInsumos: l.sinInsumos,
      variedadId: l.variedadId,
      cultivo: l.cultivo,
      cicloDias: l.cicloDias,
      plantas:
        l.plantas !== undefined && plantasPlant !== undefined
          ? l.plantas - plantasPlant
          : undefined,
      viveroId: l.viveroId,
    });
  }
  return out;
}

/* ───────────────────────── Entregar y comprar ───────────────────────── */

/**
 * Insumos de un lote para una semana calendario. Semanas 0 a la de cosecha de su variedad:
 * solo hectáreas realmente plantadas. Semana -1 (preparación): hectáreas planeadas de lotes nuevos. La semana -2 va
 * en el pedido de planeación, no aquí.
 */
export function lineasLote(
  l: Lote,
  recetas: Recetas,
  adicionales: Adicional[],
  semana: number,
): LineaDemanda[] {
  if (l.cancelado) return [];
  const dosis = recetaLote(l, recetas, adicionales);
  const plantadas = plantadasLote(l);
  let sr: number | null = null;
  let ha = 0;
  if (plantadas > 0) {
    sr = semanaRecetaLote(l, semana);
    ha = plantadas;
    if (sr === null || sr < 0 || sr > Math.min(semanaCosechaLote(l), SEMANA_RECETA_MAX)) return [];
  } else if (!l.origenId && semana === l.semanaPlaneada - 1) {
    sr = -1;
    ha = l.ha;
  } else return [];
  return Object.entries(dosis[sr] ?? {})
    .filter(([, d]) => d > 0)
    .map(([productoId, d]) => ({
      key: `${l.id}|${productoId}|${semana}`,
      loteId: l.id,
      tablaId: l.tablaId,
      ranchoId: l.ranchoId,
      productoId,
      semana,
      semanaReceta: sr,
      cantidad: redondear(d * ha),
    }));
}

export function lineasSemana(
  lotes: Lote[],
  recetas: Recetas,
  adicionales: Adicional[],
  semanas: number[],
): LineaDemanda[] {
  return lotes.flatMap((l) => semanas.flatMap((w) => lineasLote(l, recetas, adicionales, w)));
}

/** En el prototipo, lo de semanas anteriores se da por recibido en rancho. */
export function estatusLinea(
  l: LineaDemanda,
  recepciones: Record<string, Recepcion>,
  semanaActual: number,
): EstatusRecepcion {
  return recepciones[l.key]?.status ?? (l.semana < semanaActual ? "recibido" : "pendiente");
}

export function cantidadRecibida(l: LineaDemanda, recepciones: Record<string, Recepcion>): number {
  return recepciones[l.key]?.cantidadRecibida ?? l.cantidad;
}

export interface Consolidado {
  ranchoId: string;
  productoId: string;
  semana: number;
  /** Suma exacta de los lotes */
  cantidad: number;
  /** Cantidad a pedir: los rollos se redondean hacia arriba después de sumar. */
  cantidadPedido: number;
  lineas: LineaDemanda[];
  keys: string[];
  status: EstatusRecepcion | "parcial";
}

export function consolidar(
  lineas: LineaDemanda[],
  productos: Producto[],
  recepciones: Record<string, Recepcion>,
  semanaActual: number,
): Consolidado[] {
  const unidad = new Map(productos.map((p) => [p.id, p.unidad]));
  const map = new Map<string, Consolidado & { statuses: Set<EstatusRecepcion> }>();
  for (const l of lineas) {
    const k = `${l.ranchoId}|${l.productoId}|${l.semana}`;
    const cur = map.get(k) ?? {
      ranchoId: l.ranchoId,
      productoId: l.productoId,
      semana: l.semana,
      cantidad: 0,
      cantidadPedido: 0,
      lineas: [],
      keys: [],
      status: "pendiente" as const,
      statuses: new Set<EstatusRecepcion>(),
    };
    cur.cantidad = redondear(cur.cantidad + l.cantidad);
    cur.lineas.push(l);
    cur.keys.push(l.key);
    cur.statuses.add(estatusLinea(l, recepciones, semanaActual));
    map.set(k, cur);
  }
  return [...map.values()].map(({ statuses, ...c }) => {
    const unico = statuses.size === 1 ? [...statuses][0] : undefined;
    return {
      ...c,
      cantidadPedido:
        unidad.get(c.productoId) === "rollo" ? Math.ceil(c.cantidad - 1e-9) : c.cantidad,
      status: unico ?? "parcial",
    };
  });
}

/** Consolida líneas de pedidos de planeación del mismo rancho y semana (rollos redondeados al final). */
export function consolidarPlaneacion(
  pedidos: PedidoPlaneacion[],
  productos: Producto[],
): { productoId: string; cantidad: number; cantidadPedido: number }[] {
  const unidad = new Map(productos.map((p) => [p.id, p.unidad]));
  const suma = sumarPorProducto(
    pedidos.filter((p) => p.status !== "cancelado").flatMap((p) => p.lineas),
  );
  return [...suma.entries()].map(([productoId, cantidad]) => ({
    productoId,
    cantidad,
    cantidadPedido: unidad.get(productoId) === "rollo" ? Math.ceil(cantidad - 1e-9) : cantidad,
  }));
}

/* ───────────────────────── Costos ───────────────────────── */

export function costoLineas(
  lineas: LineaDemanda[],
  productos: Producto[],
  recepciones: Record<string, Recepcion>,
): number {
  const prod = new Map(productos.map((p) => [p.id, p]));
  return lineas.reduce((s, l) => {
    const p = prod.get(l.productoId);
    // Precio vigente en la fecha de recepción (o en la semana de la línea): un cambio no recalcula lo anterior.
    const fecha = recepciones[l.key]?.fecha ?? fechaEnSemana(l.semana);
    return s + cantidadRecibida(l, recepciones) * (p ? precioVigente(p, fecha) : 0);
  }, 0);
}

/** Costo de los insumos de planeación entregados al lote. */
export function costoPlaneacionLote(
  l: Lote,
  pedidos: PedidoPlaneacion[],
  productos: Producto[],
): number {
  const prod = new Map(productos.map((p) => [p.id, p]));
  const entrega = new Map(pedidos.map((p) => [p.id, p.fechaEntrega ?? p.fecha]));
  return insumosEntregados(l, pedidos).reduce((s, i) => {
    const p = prod.get(i.productoId);
    return s + i.cantidad * (p ? precioVigente(p, entrega.get(i.pedidoId) ?? "") : 0);
  }, 0);
}

/* ───────────────────────── Formato ───────────────────────── */

export function redondear(n: number, dec = 2): number {
  const f = 10 ** dec;
  return Math.round(n * f) / f;
}

const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });

export const formatoMXN = (n: number) => mxn.format(n);
export const formatoNum = (n: number) => num.format(n);

/* ───────────────────────── Corrección de fechas (solo administrador) ───────────────────────── */

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Corrige las fechas de plantación (cada avance) y la de cosecha de un lote ya plantado.
 * `fechaCosecha` vacía = se calcula con el ciclo de la variedad. Las semanas se recalculan
 * con la nueva fecha, así que la receta y las compras del lote se recorren solas.
 */
export function corregirFechasLote(
  l: Lote,
  cambios: { avances: Record<string, string>; fechaCosecha?: string | undefined },
  hoy: string,
): { error: string } | { lote: Lote } {
  if (l.avances.length === 0) return { error: "El lote aún no tiene plantación registrada." };
  const avances = l.avances.map((a) => {
    const fecha = cambios.avances[a.id] ?? a.fecha;
    return { ...a, fecha, semana: semanaDeFecha(fecha) };
  });
  for (const a of avances) {
    if (!FECHA_ISO.test(a.fecha)) return { error: "Indica la fecha de plantación." };
    if (a.fecha > hoy) return { error: "La fecha de plantación no puede ser futura." };
  }
  avances.sort((a, b) => a.fecha.localeCompare(b.fecha));
  const cosecha = cambios.fechaCosecha?.trim() || undefined;
  if (cosecha) {
    if (!FECHA_ISO.test(cosecha)) return { error: "La fecha de cosecha no es válida." };
    if (cosecha <= avances[avances.length - 1]!.fecha)
      return { error: "La cosecha debe ser después de la plantación." };
  }
  // Si se plantó en la semana que se planeó (p. ej. plantación ya hecha), la semana planeada se recorre igual.
  const semanaPlaneada =
    l.semanaPlaneada === semanaRealLote(l) ? avances[0]!.semana : l.semanaPlaneada;
  return { lote: { ...l, avances, semanaPlaneada, fechaCosecha: cosecha } };
}

/* ───────────────────────── Fecha real ───────────────────────── */

/** Fecha de hoy en Ciudad de México (UTC-6, sin horario de verano). */
export function hoyEnMexico(ahora: number = Date.now()): string {
  return new Date(ahora - 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Cierra las semanas que pasaron desde la última guardada hasta la actual:
 * lo no plantado pasa a lote pendiente y los lotes ya cosechados se finalizan.
 */
export function ponerAlDia(
  lotes: Lote[],
  semanaGuardada: number,
  semanaActual: number,
  nuevoId: () => string,
): Lote[] {
  let ls = lotes;
  for (let w = semanaGuardada; w < semanaActual; w++)
    ls = finalizarCosechados(cerrarSemana(ls, w, nuevoId), w + 1);
  return finalizarCosechados(ls, semanaActual);
}

/* ───────────────────────── Fase 2 · Solicitud de planta ───────────────────────── */

export const ESTATUS_SOLICITUD_LABEL: Record<EstatusSolicitud, string> = {
  generada: "Generada",
  enviada: "Enviada al vivero",
  parcial: "Recibida parcial",
  recibida: "Planta recibida",
  cancelada: "Cancelada",
};

export function folioSolicitud(n: number): string {
  return `SP-${String(n).padStart(4, "0")}`;
}

export function siguienteFolio(solicitudes: SolicitudPlanta[]): number {
  return solicitudes.reduce((m, s) => Math.max(m, s.folio), 0) + 1;
}

/** Lotes que ya están en una solicitud vigente (no cancelada). */
function lotesSolicitados(solicitudes: SolicitudPlanta[]): Set<string> {
  return new Set(
    solicitudes
      .filter((s) => s.status !== "cancelada")
      .flatMap((s) => s.lineas.map((l) => l.loteId)),
  );
}

/**
 * Lotes a los que se les puede pedir planta: planeados, sin plantar, no arrastrados (un arrastre
 * ya tiene su planta pedida en el lote de origen) y sin otra solicitud vigente.
 */
export function lotesParaSolicitud(lotes: Lote[], solicitudes: SolicitudPlanta[]): Lote[] {
  const ya = lotesSolicitados(solicitudes);
  return lotes.filter(
    (l) => !l.cancelado && !l.finalizado && !l.origenId && plantadasLote(l) === 0 && !ya.has(l.id),
  );
}

/** Errores al generar una solicitud: un vivero y todos los lotes de la misma semana de plantación. */
export function validarSolicitud(
  seleccion: Lote[],
  viveroId: string,
  disponibles: Lote[],
): string | null {
  if (!viveroId) return "Elige el vivero.";
  if (seleccion.length === 0) return "Elige al menos un lote.";
  const ok = new Set(disponibles.map((l) => l.id));
  const fuera = seleccion.find((l) => !ok.has(l.id));
  if (fuera) return `El lote ${fuera.codigo} ya tiene solicitud o no puede pedir planta.`;
  if (new Set(seleccion.map((l) => l.semanaPlaneada)).size > 1)
    return "Una solicitud consolidada lleva lotes de la misma semana de plantación.";
  const otro = seleccion.find((l) => l.viveroId && l.viveroId !== viveroId);
  if (otro) return `El lote ${otro.codigo} es de otro vivero.`;
  return null;
}

const porHaDe = (x: number | ((l: Lote) => number), l: Lote) => (typeof x === "function" ? x(l) : x);

/** Renglones de la solicitud (copia de los datos del lote). Sin plantas capturadas, se usan las sugeridas. */
export function lineasSolicitud(
  seleccion: Lote[],
  ctx: {
    ranchos: Rancho[];
    tablas: Tabla[];
    variedades: Variedad[];
    /** Plantas por ha sugeridas: un número o, por lote (según su variedad). */
    plantasPorHa: number | ((l: Lote) => number);
    /** Plantas capturadas en la solicitud por lote (por ha o total); mandan sobre las del lote. */
    plantas?: Record<string, number> | undefined;
  },
): LineaSolicitud[] {
  return seleccion.map((l) => ({
    loteId: l.id,
    ranchoId: l.ranchoId,
    tablaId: l.tablaId,
    rancho: ctx.ranchos.find((r) => r.id === l.ranchoId)?.nombre ?? "",
    tabla: ctx.tablas.find((t) => t.id === l.tablaId)?.nombre ?? "",
    lote: l.codigo,
    variedad: ctx.variedades.find((v) => v.id === l.variedadId)?.nombre ?? "",
    ha: l.ha,
    plantas: ctx.plantas?.[l.id] ?? l.plantas ?? plantasSugeridas(l.ha, porHaDe(ctx.plantasPorHa, l)),
    semanaPlantacion: l.semanaPlaneada,
    fechaEntrega: l.fechaEntregaPlanta ?? fechaEnSemana(l.semanaPlaneada, 0),
  }));
}

/**
 * Plantas capturadas en la solicitud: enteras y mayores a 0; si difieren más de ±10% de
 * ha × plantas por ha vigente, piden motivo (la misma regla que al planear).
 */
export function validarPlantasSolicitud(
  seleccion: Lote[],
  plantas: Record<string, number>,
  motivos: Record<string, string>,
  plantasPorHa: number | ((l: Lote) => number),
): string | null {
  for (const l of seleccion) {
    const n = plantas[l.id];
    if (n === undefined) continue;
    const motivo = motivos[l.id] ?? l.motivoPlantas;
    const err = validarPlantas(n, plantasSugeridas(l.ha, porHaDe(plantasPorHa, l)), motivo);
    if (err) return `Lote ${l.codigo}: ${err.charAt(0).toLowerCase()}${err.slice(1)}`;
  }
  return null;
}

export function totalesSolicitud(s: Pick<SolicitudPlanta, "lineas">): {
  ha: number;
  plantas: number;
  recibidas: number;
} {
  return {
    ha: redondear(s.lineas.reduce((a, l) => a + l.ha, 0)),
    plantas: s.lineas.reduce((a, l) => a + l.plantas, 0),
    recibidas: s.lineas.reduce((a, l) => a + (l.plantasRecibidas ?? 0), 0),
  };
}

/** Diferencia contra lo solicitado (negativo = llegaron menos). */
export function diferenciaPlantas(l: LineaSolicitud): number {
  return (l.plantasRecibidas ?? l.plantas) - l.plantas;
}

/** Errores al registrar una entrega de planta (completa o parcial). */
export function validarRecepcionPlanta(
  recibidas: Record<string, number>,
  lineas: LineaSolicitud[],
  fecha: string,
  hoy: string,
  foto: string | undefined,
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return "Indica la fecha en que llegó la planta.";
  if (fecha > hoy) return "La fecha de recepción no puede ser futura.";
  for (const l of lineas) {
    const n = recibidas[l.loteId];
    if (n === undefined || !Number.isInteger(n) || n < 0)
      return `Indica las plantas recibidas del lote ${l.lote}.`;
  }
  if (lineas.reduce((s, l) => s + (recibidas[l.loteId] ?? 0), 0) <= 0)
    return "Indica cuántas plantas llegaron.";
  if (!foto) return "La foto del ticket del vivero es obligatoria.";
  return null;
}

/** Entregas de una solicitud; las antiguas (una sola recepción) se leen como una entrega. */
export function entregasSolicitud(s: SolicitudPlanta): EntregaPlanta[] {
  if (s.entregas) return s.entregas;
  if (!s.recepcion) return [];
  return [
    {
      ...s.recepcion,
      recibidas: Object.fromEntries(s.lineas.map((l) => [l.loteId, l.plantasRecibidas ?? 0])),
    },
  ];
}

/** Plantas que faltan por llegar en cada lote de la solicitud. */
export function faltantesSolicitud(s: Pick<SolicitudPlanta, "lineas">): Record<string, number> {
  return Object.fromEntries(
    s.lineas.map((l) => [l.loteId, Math.max(0, l.plantas - (l.plantasRecibidas ?? 0))]),
  );
}

/**
 * Suma una entrega a la solicitud. Queda "recibida" cuando ya llegó todo lo pedido (o se cierra
 * porque no llegará más); si falta planta queda "parcial" y puede recibir otra entrega.
 */
export function registrarEntregaPlanta(
  s: SolicitudPlanta,
  entrega: EntregaPlanta,
  cerrar = false,
): SolicitudPlanta {
  const lineas = s.lineas.map((l) => ({
    ...l,
    plantasRecibidas: (l.plantasRecibidas ?? 0) + (entrega.recibidas[l.loteId] ?? 0),
  }));
  const completa = lineas.every((l) => l.plantasRecibidas >= l.plantas);
  const { fecha, foto, costoPlanta, plantasPorHa } = entrega;
  return {
    ...s,
    lineas,
    entregas: [...entregasSolicitud(s), entrega],
    recepcion: { fecha, foto, costoPlanta, plantasPorHa },
    status: completa || cerrar ? "recibida" : "parcial",
  };
}

/**
 * Al cancelar un lote, sus solicitudes sin planta recibida se cancelan; en una consolidada solo
 * se quita ese lote. Lo que ya llegó no se toca.
 */
export function solicitudesAlCancelarLote(
  solicitudes: SolicitudPlanta[],
  loteId: string,
  hoy: string,
): SolicitudPlanta[] {
  return solicitudes.map((s) => {
    if (s.status !== "generada" && s.status !== "enviada" && s.status !== "parcial") return s;
    const linea = s.lineas.find((l) => l.loteId === loteId);
    if (!linea || (linea.plantasRecibidas ?? 0) > 0) return s;
    const lineas = s.lineas.filter((l) => l.loteId !== loteId);
    if (lineas.length === 0) return { ...s, status: "cancelada", fechaCancelacion: hoy };
    const status =
      s.status === "parcial" && lineas.every((l) => (l.plantasRecibidas ?? 0) >= l.plantas)
        ? "recibida"
        : s.status;
    return { ...s, lineas, status };
  });
}

/* ───────────────────────── Fase 2 · Cuenta de planta ───────────────────────── */

/** Cargos de planta: cada renglón recibido = plantas × costo por planta vigente el día que llegó. */
export function cargosPlanta(solicitudes: SolicitudPlanta[]): MovimientoPlanta[] {
  return solicitudes
    .filter((s) => s.status === "recibida" || s.status === "parcial")
    .flatMap((s) =>
      entregasSolicitud(s).flatMap((e) =>
        s.lineas
          .filter((l) => (e.recibidas[l.loteId] ?? 0) > 0)
          .map((l) => {
            const n = e.recibidas[l.loteId]!;
            const { costoPlanta, plantasPorHa } = e.porLote?.[l.loteId] ?? e;
            return {
              fecha: e.fecha,
              tipo: "cargo" as const,
              monto: redondear(n * costoPlanta),
              plantas: n,
              ha: plantasPorHa > 0 ? redondear(n / plantasPorHa, 4) : 0,
              loteId: l.loteId,
              ranchoId: l.ranchoId,
              tablaId: l.tablaId,
              lote: l.lote,
              tabla: l.tabla,
              folio: s.folio,
            };
          }),
      ),
    );
}

/** Costo real de la planta de un lote (plantas recibidas × costo por planta). */
export function costoPlantaLote(loteId: string, cargos: MovimientoPlanta[]): number {
  return cargos
    .filter((c) => c.tipo === "cargo" && c.loteId === loteId)
    .reduce((s, c) => s + c.monto, 0);
}

export interface ResumenCuentaPlanta {
  plantas: number;
  haEquivalentes: number;
  cargos: number;
  descuentos: number;
  viajes: number;
  saldoPeriodo: number;
  /** Desde el inicio hasta el fin del periodo. Positivo = debo; negativo = me descontaron de más. */
  saldoAcumulado: number;
  /** Descuentos ÷ cargos (%), con un decimal. */
  relacion: number | null;
}

/** Indicadores de la cuenta de planta entre `desde` y `hasta` (incluidos). La cuenta nunca se cierra. */
export function cuentaPlanta(
  movs: MovimientoPlanta[],
  desde: string,
  hasta: string,
): ResumenCuentaPlanta {
  const enPeriodo = movs.filter((m) => m.fecha >= desde && m.fecha <= hasta);
  const cargos = enPeriodo.filter((m) => m.tipo === "cargo");
  const abonos = enPeriodo.filter((m) => m.tipo === "abono");
  const suma = (xs: MovimientoPlanta[]) => redondear(xs.reduce((s, m) => s + m.monto, 0));
  const totalCargos = suma(cargos);
  const totalAbonos = suma(abonos);
  const hastaFin = movs.filter((m) => m.fecha <= hasta);
  return {
    plantas: cargos.reduce((s, m) => s + (m.plantas ?? 0), 0),
    haEquivalentes: redondear(cargos.reduce((s, m) => s + (m.ha ?? 0), 0)),
    cargos: totalCargos,
    descuentos: totalAbonos,
    viajes: abonos.length,
    saldoPeriodo: redondear(totalCargos - totalAbonos),
    saldoAcumulado: redondear(
      suma(hastaFin.filter((m) => m.tipo === "cargo")) -
        suma(hastaFin.filter((m) => m.tipo === "abono")),
    ),
    relacion: totalCargos > 0 ? redondear((totalAbonos / totalCargos) * 100, 1) : null,
  };
}

/** Por mes del periodo: cargos, descuentos y saldo acumulado al cierre de cada mes. */
export function cuentaMensual(
  movs: MovimientoPlanta[],
  desde: string,
  hasta: string,
): { mes: string; etiqueta: string; cargos: number; descuentos: number; saldo: number }[] {
  const out: {
    mes: string;
    etiqueta: string;
    cargos: number;
    descuentos: number;
    saldo: number;
  }[] = [];
  let y = Number(desde.slice(0, 4));
  let m = Number(desde.slice(5, 7));
  const finY = Number(hasta.slice(0, 4));
  const finM = Number(hasta.slice(5, 7));
  while (y < finY || (y === finY && m <= finM)) {
    const mes = `${y}-${String(m).padStart(2, "0")}`;
    const ini = `${mes}-01`;
    const fin = `${mes}-31`;
    const r = cuentaPlanta(movs, ini < desde ? desde : ini, fin > hasta ? hasta : fin);
    out.push({
      mes,
      etiqueta: `${MESES[m - 1]} ${String(y).slice(2)}`,
      cargos: r.cargos,
      descuentos: r.descuentos,
      saldo: r.saldoAcumulado,
    });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/* ───────────────────────── Lo que llega a cada rancho ───────────────────────── */

/** Pedidos de planeación que deben llegar al rancho en la semana (2 semanas antes de plantar). */
export function pedidosQueLleganEnSemana(
  pedidos: PedidoPlaneacion[],
  semana: number,
): PedidoPlaneacion[] {
  return pedidos.filter((p) => p.status !== "cancelado" && semanaEntregaIdeal(p) === semana);
}

/** Planta que el vivero entrega en la semana: renglones de solicitudes vigentes, con su folio y estatus. */
export function plantaQueLlegaEnSemana(
  solicitudes: SolicitudPlanta[],
  semana: number,
): (LineaSolicitud & { folio: number; vivero: string; status: EstatusSolicitud })[] {
  return solicitudes
    .filter((s) => s.status !== "cancelada")
    .flatMap((s) =>
      s.lineas
        .filter((l) => semanaDeFecha(l.fechaEntrega) === semana)
        .map((l) => ({ ...l, folio: s.folio, vivero: s.vivero.nombre, status: s.status })),
    );
}

/* ───────────── Fase 3: extraordinarios, alertas a Dirección y devoluciones ───────────── */

/** Distancia en metros entre dos puntos GPS (fórmula de haversine). */
export function distanciaM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Cada foto debe caer dentro del radio de al menos una de las tablas elegidas.
 * Una foto fuera (o sin ubicación) = "no_valida". Si ninguna tabla elegida tiene punto = "no_verificable".
 */
export function validarUbicacionFotos(fotos: FotoGps[], tablas: Tabla[]): EstadoUbicacion {
  const conPunto = tablas.filter((t) => t.gps);
  if (conPunto.length === 0) return "no_verificable";
  const dentro = (f: FotoGps) =>
    f.lat !== undefined &&
    f.lng !== undefined &&
    conPunto.some((t) => distanciaM({ lat: f.lat!, lng: f.lng! }, t.gps!) <= radioValidacion(t));
  if (fotos.every(dentro)) return "valida";
  // Si hay tablas sin punto, la foto pudo tomarse en ellas: no se puede asegurar que esté mal.
  return conPunto.length < tablas.length ? "no_verificable" : "no_valida";
}

/** Una foto cuenta como "tomada en el momento" si el archivo es de hace 5 minutos o menos. */
export function fotoRecienTomada(lastModified: number, ahora: number): boolean {
  return ahora - lastModified >= -60_000 && ahora - lastModified <= 5 * 60_000;
}

/** Costo estimado: cantidad por ha × hectáreas de todas las tablas × precio vigente en la fecha. */
export function costoExtraordinario(
  lineas: LineaExtra[],
  tablas: Tabla[],
  productos: Producto[],
  fecha: string,
): number {
  const ha = tablas.reduce((s, t) => s + t.hectareas, 0);
  return lineas.reduce((s, l) => {
    const p = productos.find((x) => x.id === l.productoId);
    return s + (p ? l.porHa * ha * precioVigente(p, fecha) : 0);
  }, 0);
}

/** El costo se carga a las tablas en proporción a sus hectáreas, y a su lote activo si tiene. */
export function repartirPorHa(costo: number, tablas: Tabla[], lotes: Lote[]): RepartoExtra[] {
  const ha = tablas.reduce((s, t) => s + t.hectareas, 0);
  return tablas.map((t) => {
    const activos = lotesDeTabla(lotes, t.id).filter((l) => l.avances.length > 0);
    const lote = activos[activos.length - 1];
    return {
      tablaId: t.id,
      loteId: lote?.id,
      ha: t.hectareas,
      monto: ha > 0 ? Math.round((costo * t.hectareas * 100) / ha) / 100 : 0,
    };
  });
}

/** Cantidad total por producto que Compras debe surtir (por ha × hectáreas). */
export function cantidadesExtraordinario(ex: Extraordinario, tablas: Tabla[]): { productoId: string; cantidad: number }[] {
  const ha = tablas.filter((t) => ex.tablaIds.includes(t.id)).reduce((s, t) => s + t.hectareas, 0);
  return ex.lineas.map((l) => ({ productoId: l.productoId, cantidad: Math.round(l.porHa * ha * 100) / 100 }));
}

export function validarExtraordinario(d: {
  tablaIds: string[];
  descripcion: string;
  lineas: LineaExtra[];
  fotos: FotoGps[];
  diasEfecto: number;
  fechaMaxSurtido: string;
}, hoy: string): string | null {
  if (d.tablaIds.length === 0) return "Elige al menos una tabla afectada.";
  if (!d.descripcion.trim()) return "Describe la condición.";
  if (d.lineas.length === 0 || d.lineas.some((l) => !l.productoId || !(l.porHa > 0)))
    return "Agrega los productos con su cantidad por ha.";
  if (d.fotos.length < 3) return "Toma al menos 3 fotos con la cámara.";
  if (!(d.diasEfecto > 0)) return "Indica los días esperados de efecto.";
  if (!d.fechaMaxSurtido) return "Indica la fecha máxima de surtido.";
  if (d.fechaMaxSurtido < hoy) return "La fecha máxima de surtido no puede ser pasada.";
  return null;
}

export function siguienteFolioExtra(extras: Extraordinario[]): string {
  const n = extras.reduce((m, e) => Math.max(m, Number(e.folio.replace(/\D/g, "")) || 0), 0);
  return `EX-${String(n + 1).padStart(4, "0")}`;
}

/** Aviso en rojo: por autorizar y falta 1 día o menos para la fecha máxima de surtido. */
export function urgenteSurtido(ex: Extraordinario, hoy: string): boolean {
  return ex.status === "por_autorizar" && diasEntre(hoy, ex.fechaMaxSurtido) <= 1;
}

/** Fecha en que el ingeniero debe reportar la mejora: autorización + días de efecto. */
export function fechaReporteMejora(ex: Extraordinario): string | null {
  if (!ex.autorizacion || (ex.status !== "autorizada" && ex.status !== "surtida")) return null;
  return sumarDias(ex.autorizacion.fecha, ex.diasEfecto);
}

export function debeReportarMejora(ex: Extraordinario, hoy: string): boolean {
  const f = fechaReporteMejora(ex);
  return !!f && !ex.mejora && hoy >= f;
}

/**
 * Alertas a Dirección que deben existir: fotos fuera de lugar (solicitud o mejora) y
 * mejora no reportada 3 días después de la fecha esperada. Ids fijos para no duplicar.
 */
export function alertasDireccionNuevas(
  extras: Extraordinario[],
  existentes: AlertaDireccion[],
  hoy: string,
): AlertaDireccion[] {
  const ya = new Set(existentes.map((a) => a.id));
  const nuevas: AlertaDireccion[] = [];
  const base = (ex: Extraordinario, id: string, tipo: AlertaDireccion["tipo"], fotos: FotoGps[]) => {
    if (ya.has(id)) return;
    nuevas.push({
      id,
      tipo,
      extraordinarioId: ex.id,
      ingeniero: ex.ingeniero,
      ranchoId: ex.ranchoId,
      tablaIds: ex.tablaIds,
      fecha: hoy,
      fotos,
      status: "abierta",
    });
  };
  for (const ex of extras) {
    if (ex.ubicacion === "no_valida") base(ex, `ub-${ex.id}`, "ubicacion", ex.fotos);
    if (ex.mejora?.ubicacion === "no_valida") base(ex, `ubm-${ex.id}`, "ubicacion", ex.mejora.fotos);
    const f = fechaReporteMejora(ex);
    if (f && !ex.mejora && diasEntre(f, hoy) > 3) base(ex, `sm-${ex.id}`, "sin_mejora", []);
  }
  return nuevas;
}

export function validarCierreAlerta(comentario: string): string | null {
  return comentario.trim() ? null : "Escribe el comentario para cerrar la alerta.";
}

/** Reporte mensual: cuántas alertas por mes, ingeniero y tipo. */
export function reporteMensualAlertas(
  alertas: AlertaDireccion[],
): { mes: string; ingeniero: string; ubicacion: number; sin_mejora: number }[] {
  const m = new Map<string, { mes: string; ingeniero: string; ubicacion: number; sin_mejora: number }>();
  for (const a of alertas) {
    const mes = a.fecha.slice(0, 7);
    const k = `${mes}|${a.ingeniero}`;
    const r = m.get(k) ?? { mes, ingeniero: a.ingeniero, ubicacion: 0, sin_mejora: 0 };
    r[a.tipo] += 1;
    m.set(k, r);
  }
  return [...m.values()].sort((a, b) => b.mes.localeCompare(a.mes) || a.ingeniero.localeCompare(b.ingeniero));
}

/** Monto de extraordinarios cargado a un lote: solo cuenta cuando Compras ya lo surtió. */
export function costoExtraLote(loteId: string, extras: Extraordinario[]): number {
  return extras
    .filter((e) => e.status === "surtida")
    .flatMap((e) => e.reparto ?? [])
    .filter((r) => r.loteId === loteId)
    .reduce((s, r) => s + r.monto, 0);
}

/** Lo retirado sale del costo del lote: cantidad × precio guardado en la devolución. */
export function costoDevolucionesLote(loteId: string, devoluciones: Devolucion[]): number {
  return devoluciones.filter((d) => d.loteId === loteId).reduce((s, d) => s + d.cantidad * d.precio, 0);
}

export function validarDevolucion(d: { tablaId: string; productoId: string; cantidad: number; foto?: string | undefined }): string | null {
  if (!d.tablaId) return "Elige la tabla.";
  if (!d.productoId) return "Elige el producto.";
  if (!(d.cantidad > 0)) return "Indica la cantidad retirada.";
  if (!d.foto) return "Toma la foto de lo retirado.";
  return null;
}

/** Consumo teórico = entregado − retirado (nunca menos de 0). */
export function consumoTeorico(entregado: number, retirado: number): number {
  return Math.max(0, Math.round((entregado - retirado) * 100) / 100);
}


/* ───────────────────────── Fase 4 · Cosecha ───────────────────────── */

/** Jueves que abre la semana de pago (jueves a miércoles) en la que cae `fecha`. */
export function semanaPago(fecha: string): string {
  const lunes0 = (new Date(fecha + "T00:00:00Z").getUTCDay() + 6) % 7;
  return sumarDias(fecha, -((lunes0 - 3 + 7) % 7));
}

export function finSemanaPago(jueves: string): string {
  return sumarDias(jueves, 6);
}

/** Lotes que pueden salir en un viaje: plantados y sin cerrar (el Super Admin puede ver los cerrados). */
export function lotesParaSalida(lotes: Lote[], incluirCerrados = false): Lote[] {
  return lotes.filter((l) => !l.cancelado && plantadasLote(l) > 0 && (incluirCerrados || !l.finalizado));
}

export function validarSalida(
  d: {
    folio: string;
    fecha: string;
    loteIds: string[];
    choferId: string;
    foto?: string | undefined;
    motivoCerrado?: string | undefined;
    bins?: Record<string, number> | undefined;
  },
  lotes: Lote[],
  viajes: Viaje[],
  hoy: string,
  superAdmin: boolean,
): string | null {
  if (!d.folio.trim()) return "Escribe el folio de la hoja.";
  if (viajes.some((v) => v.folio.trim().toLowerCase() === d.folio.trim().toLowerCase()))
    return "Ya hay un viaje con ese folio.";
  if (!d.fecha || d.fecha > hoy) return "La fecha de salida no puede ser futura.";
  if (d.loteIds.length === 0) return "Elige al menos una tabla o lote.";
  if (!d.choferId) return "Elige el chofer.";
  for (const id of d.loteIds) {
    const b = d.bins?.[id];
    if (!(b !== undefined && Number.isInteger(b) && b > 0)) return "Escribe cuántos bins van de cada tabla (número entero mayor a 0).";
  }
  if (!d.foto) return "Falta la foto de la hoja.";
  const cerrados = lotes.filter((l) => d.loteIds.includes(l.id) && l.finalizado);
  if (cerrados.length > 0) {
    if (!superAdmin) return "No se puede incluir un lote cerrado.";
    if (!d.motivoCerrado?.trim()) return "Escribe el motivo para incluir un lote cerrado.";
  }
  return null;
}

/**
 * Reparte los kilos del viaje entre sus lotes. Por defecto, proporcional a las hectáreas
 * en cosecha de cada lote; el Super Admin puede fijar % (suman 100) o kg pagables por lote.
 */
export function repartirKg(
  lotes: Lote[],
  kgBrutos: number,
  kgPagables: number,
  ajuste?: { modo: "pct" | "kg"; valores: Record<string, number> },
  bins?: Record<string, number>,
): { error: string } | { filas: Pick<RepartoKg, "loteId" | "tablaId" | "ranchoId" | "pct" | "kgBrutos" | "kgPagables">[] } {
  if (lotes.length === 0) return { error: "El viaje no tiene lotes." };
  let pesos: number[];
  if (lotes.length === 1 || !ajuste) {
    // Con bins capturados en la salida, se reparte proporcional a los bins; si no, por hectáreas.
    const conBins = bins && lotes.every((l) => (bins[l.id] ?? 0) > 0);
    pesos = lotes.map((l) => (conBins ? bins[l.id]! : plantadasLote(l)));
  } else if (ajuste.modo === "pct") {
    pesos = lotes.map((l) => ajuste.valores[l.id] ?? 0);
    if (pesos.some((p) => p < 0)) return { error: "Los porcentajes no pueden ser negativos." };
    if (Math.abs(pesos.reduce((s, p) => s + p, 0) - 100) > 0.01) return { error: "Los porcentajes deben sumar 100%." };
  } else {
    pesos = lotes.map((l) => ajuste.valores[l.id] ?? 0);
    if (pesos.some((p) => p < 0)) return { error: "Los kilos no pueden ser negativos." };
    if (Math.abs(pesos.reduce((s, p) => s + p, 0) - kgPagables) > 0.5)
      return { error: "Los kg por tabla deben sumar los kg pagables del viaje." };
  }
  const total = pesos.reduce((s, p) => s + p, 0);
  if (!(total > 0)) return { error: "No hay hectáreas para repartir." };
  let restoB = kgBrutos;
  let restoP = kgPagables;
  const filas = lotes.map((l, i) => {
    const ultimo = i === lotes.length - 1;
    const f = pesos[i]! / total;
    const b = ultimo ? redondear(restoB) : redondear(kgBrutos * f);
    const p = ultimo ? redondear(restoP) : redondear(kgPagables * f);
    restoB -= b;
    restoP -= p;
    return { loteId: l.id, tablaId: l.tablaId, ranchoId: l.ranchoId, pct: redondear(f * 100, 2), kgBrutos: b, kgPagables: p };
  });
  return { filas };
}

/** Merma % = (brutos − pagables) ÷ brutos. */
export function mermaPct(kgBrutos: number, kgPagables: number): number {
  return kgBrutos > 0 ? redondear(((kgBrutos - kgPagables) / kgBrutos) * 100, 2) : 0;
}

export interface DatosEvaluacion {
  kgBrutos: number;
  kgPagables: number;
  calificacion: number;
  problemas: Omit<ProblemaEvaluado, "kg">[];
  reporte?: string | undefined;
  ajuste?: { modo: "pct" | "kg"; valores: Record<string, number> } | undefined;
}

/**
 * Evalúa el viaje: reparte los kilos, toma el precio por kg vigente en la fecha del viaje
 * (por variedad) y el descuento de planta vigente. La calidad no cambia el precio.
 */
export function evaluarViaje(
  v: Viaje,
  d: DatosEvaluacion,
  ctx: { lotes: Lote[]; parametros: Parametro[]; hoy: string; por: string },
): { error: string } | { evaluacion: EvaluacionViaje } {
  if (!(d.kgBrutos > 0)) return { error: "Captura los kg brutos." };
  if (!(d.kgPagables >= 0) || d.kgPagables > d.kgBrutos) return { error: "Los kg pagables deben estar entre 0 y los kg brutos." };
  if (!(d.calificacion >= 1 && d.calificacion <= 10)) return { error: "La calificación general va de 1 a 10." };
  if (!d.reporte) return { error: "Falta la foto o PDF del reporte de la congeladora." };
  for (const p of d.problemas) {
    if (!p.problemaId) return { error: "Elige el problema de calidad." };
    if (!(p.valor > 0)) return { error: "Cada problema necesita su % o kg castigados." };
    if (p.modo === "pct" && p.valor > 100) return { error: "El % castigado no puede pasar de 100." };
  }
  const ls = v.loteIds.map((id) => ctx.lotes.find((l) => l.id === id)).filter((l): l is Lote => !!l);
  const r = repartirKg(ls, d.kgBrutos, d.kgPagables, ls.length > 1 ? d.ajuste : undefined, v.bins);
  if ("error" in r) return r;
  const reparto: RepartoKg[] = r.filas.map((f) => {
    const l = ls.find((x) => x.id === f.loteId)!;
    const precio = parametroVigente(ctx.parametros, "precioKg", v.fecha, l.variedadId);
    return { ...f, precio, importe: redondear(f.kgPagables * precio) };
  });
  const importeBruto = redondear(reparto.reduce((s, x) => s + x.importe, 0));
  const descuento = parametroVigente(ctx.parametros, "descuentoViaje", v.fecha);
  return {
    evaluacion: {
      fecha: ctx.hoy,
      por: ctx.por,
      kgBrutos: d.kgBrutos,
      kgPagables: d.kgPagables,
      calificacion: d.calificacion,
      problemas: d.problemas.map((p) => ({
        ...p,
        comentario: p.comentario.trim(),
        kg: p.modo === "kg" ? p.valor : redondear((p.valor / 100) * d.kgBrutos),
      })),
      reporte: d.reporte,
      repartoAjustado: ls.length > 1 && d.ajuste ? d.ajuste.modo : undefined,
      reparto,
      merma: mermaPct(d.kgBrutos, d.kgPagables),
      importeBruto,
      descuento,
      importeNeto: redondear(importeBruto - descuento),
    },
  };
}

/** Abonos de la cuenta de planta: el descuento de cada viaje evaluado, en su fecha de salida. */
export function abonosViajes(viajes: Viaje[]): MovimientoPlanta[] {
  return viajes
    .filter((v) => v.status === "evaluado" && v.evaluacion)
    .map((v) => {
      const r = v.evaluacion!.reparto[0];
      return {
        fecha: v.fecha,
        tipo: "abono" as const,
        monto: v.evaluacion!.descuento,
        loteId: r?.loteId,
        ranchoId: r?.ranchoId,
        tablaId: r?.tablaId,
      };
    });
}

/** Viajes en tránsito con más de `dias` días sin evaluación (alerta). */
export function viajesSinEvaluar(viajes: Viaje[], hoy: string, dias: number): Viaje[] {
  return viajes.filter((v) => v.status === "transito" && diasEntre(v.fecha, hoy) > dias);
}

/** Hectáreas plantadas de los lotes en cosecha en esa semana (sin cerrar). */
export function haEnCosecha(lotes: Lote[], semana: number): number {
  return redondear(lotes.filter((l) => loteEnCosecha(l, semana)).reduce((s, l) => s + plantadasLote(l), 0));
}

export interface ResumenPago {
  jueves: string;
  fin: string;
  viajes: Viaje[];
  sinEvaluar: number;
  kgBrutos: number;
  kgPagables: number;
  importeBruto: number;
  descuentos: number;
  importeNeto: number;
}

/** Totales de una semana de pago. Solo cuentan los kilos e importes de los viajes evaluados. */
export function resumenSemanaPago(viajes: Viaje[], jueves: string): ResumenPago {
  const vs = viajes.filter((v) => semanaPago(v.fecha) === jueves);
  const ev = vs.map((v) => v.evaluacion).filter((e): e is EvaluacionViaje => !!e);
  const suma = (f: (e: EvaluacionViaje) => number) => redondear(ev.reduce((s, e) => s + f(e), 0));
  return {
    jueves,
    fin: finSemanaPago(jueves),
    viajes: vs.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)),
    sinEvaluar: vs.filter((v) => v.status === "transito").length,
    kgBrutos: suma((e) => e.kgBrutos),
    kgPagables: suma((e) => e.kgPagables),
    importeBruto: suma((e) => e.importeBruto),
    descuentos: suma((e) => e.descuento),
    importeNeto: suma((e) => e.importeNeto),
  };
}

export const KG_POR_BIN = 200;

/** Kg que el rancho dijo que mandó (bins × kg por bin), por lote y total. 0 si el viaje no tiene bins. */
export function estimadoViaje(v: Viaje): { bins: number; kg: number; porLote: Record<string, { bins: number; kg: number }> } {
  const kgBin = v.kgPorBin ?? KG_POR_BIN;
  const porLote: Record<string, { bins: number; kg: number }> = {};
  let bins = 0;
  for (const id of v.loteIds) {
    const b = v.bins?.[id] ?? 0;
    porLote[id] = { bins: b, kg: b * kgBin };
    bins += b;
  }
  return { bins, kg: bins * kgBin, porLote };
}

/** Lo que el rancho dijo que mandó contra lo que llegó (kg brutos), solo de viajes evaluados con bins. */
export function enviadoVsLlegado(viajes: Viaje[]): { bins: number; kgDicho: number; kgLlegado: number; diferencia: number; pct: number } {
  let bins = 0, kgDicho = 0, kgLlegado = 0;
  for (const v of viajes) {
    if (!v.evaluacion || !v.bins) continue;
    const e = estimadoViaje(v);
    if (e.bins === 0) continue;
    bins += e.bins;
    kgDicho += e.kg;
    kgLlegado += v.evaluacion.kgBrutos;
  }
  const diferencia = redondear(kgLlegado - kgDicho);
  return { bins, kgDicho, kgLlegado: redondear(kgLlegado), diferencia, pct: kgDicho > 0 ? redondear((diferencia / kgDicho) * 100, 1) : 0 };
}

/** Semanas de pago con viajes, de la más reciente a la más antigua. */
export function semanasDePago(viajes: Viaje[]): string[] {
  return [...new Set(viajes.map((v) => semanaPago(v.fecha)))].sort().reverse();
}

/** Desglose por tabla de una lista de viajes evaluados. */
export function porTablaViajes(viajes: Viaje[]): { tablaId: string; kgBrutos: number; kgPagables: number; importe: number }[] {
  const m = new Map<string, { tablaId: string; kgBrutos: number; kgPagables: number; importe: number }>();
  for (const v of viajes)
    for (const r of v.evaluacion?.reparto ?? []) {
      const f = m.get(r.tablaId) ?? { tablaId: r.tablaId, kgBrutos: 0, kgPagables: 0, importe: 0 };
      f.kgBrutos = redondear(f.kgBrutos + r.kgBrutos);
      f.kgPagables = redondear(f.kgPagables + r.kgPagables);
      f.importe = redondear(f.importe + r.importe);
      m.set(r.tablaId, f);
    }
  return [...m.values()];
}

/** Abierta mientras corre la semana; luego Por cobrar hasta capturar el pago. */
export function estatusLiquidacion(r: ResumenPago, liq: Liquidacion | undefined, hoy: string): EstatusLiquidacion {
  if (!liq) return hoy <= r.fin ? "abierta" : "por_cobrar";
  return Math.abs(liq.pagado - r.importeNeto) < 1 ? "pagada" : "pagada_diferencia";
}

export function validarPago(d: { pagado: number; fecha: string; comprobante?: string | undefined }): string | null {
  if (!(d.pagado >= 0) || Number.isNaN(d.pagado)) return "Captura el monto pagado.";
  if (!d.fecha) return "Captura la fecha del pago.";
  if (!d.comprobante) return "Falta el comprobante.";
  return null;
}

export interface RendimientoLote {
  loteId: string;
  ha: number;
  viajes: number;
  kgBrutos: number;
  kgPagables: number;
  brutosHa: number;
  pagablesHa: number;
  meta: number;
  pctMeta: number;
  merma: number;
  /** Calificación promedio de sus viajes (null sin viajes). */
  calidad: number | null;
  ingreso: number;
  gasto: number;
  utilidad: number;
  /** Ingreso ÷ gasto (null sin gasto). */
  retorno: number | null;
  utilidadHa: number;
  /** Kg pagables por ha necesarios para cubrir el gasto directo. */
  equilibrioKgHa: number;
}

/** Rendimiento y retorno de un lote con sus viajes evaluados y su gasto directo. */
export function rendimientoLote(l: Lote, viajes: Viaje[], parametros: Parametro[], gasto: number): RendimientoLote {
  const filas = viajes.flatMap((v) => (v.evaluacion?.reparto ?? []).filter((r) => r.loteId === l.id).map((r) => ({ r, v })));
  const ha = plantadasLote(l);
  const kgBrutos = redondear(filas.reduce((s, x) => s + x.r.kgBrutos, 0));
  const kgPagables = redondear(filas.reduce((s, x) => s + x.r.kgPagables, 0));
  const ingreso = redondear(filas.reduce((s, x) => s + x.r.importe, 0));
  const fecha = fechaCosechaLote(l);
  const meta = parametroVigente(parametros, "metaKgHa", fecha, l.variedadId);
  const precio = parametroVigente(parametros, "precioKg", fecha, l.variedadId);
  const pagablesHa = ha > 0 ? redondear(kgPagables / ha) : 0;
  const cal = filas.map((x) => x.v.evaluacion!.calificacion);
  const utilidad = redondear(ingreso - gasto);
  return {
    loteId: l.id,
    ha,
    viajes: filas.length,
    kgBrutos,
    kgPagables,
    brutosHa: ha > 0 ? redondear(kgBrutos / ha) : 0,
    pagablesHa,
    meta,
    pctMeta: meta > 0 ? redondear((pagablesHa / meta) * 100, 1) : 0,
    merma: mermaPct(kgBrutos, kgPagables),
    calidad: cal.length > 0 ? redondear(cal.reduce((s, c) => s + c, 0) / cal.length, 1) : null,
    ingreso,
    gasto: redondear(gasto),
    utilidad,
    retorno: gasto > 0 ? redondear(ingreso / gasto, 2) : null,
    utilidadHa: ha > 0 ? redondear(utilidad / ha) : 0,
    equilibrioKgHa: ha > 0 && precio > 0 ? redondear(gasto / precio / ha) : 0,
  };
}

/** Acumulado de varios lotes (por tabla, rancho o ingeniero). */
export function sumarRendimientos(rs: RendimientoLote[]): Omit<RendimientoLote, "loteId"> {
  const s = (f: (r: RendimientoLote) => number) => redondear(rs.reduce((a, r) => a + f(r), 0));
  const ha = s((r) => r.ha);
  const kgBrutos = s((r) => r.kgBrutos);
  const kgPagables = s((r) => r.kgPagables);
  const ingreso = s((r) => r.ingreso);
  const gasto = s((r) => r.gasto);
  const metaHa = s((r) => r.meta * r.ha);
  const pagablesHa = ha > 0 ? redondear(kgPagables / ha) : 0;
  const cal = rs.filter((r) => r.calidad !== null);
  const ingresoPorKg = kgPagables > 0 ? ingreso / kgPagables : 0;
  return {
    ha,
    viajes: s((r) => r.viajes),
    kgBrutos,
    kgPagables,
    brutosHa: ha > 0 ? redondear(kgBrutos / ha) : 0,
    pagablesHa,
    meta: ha > 0 ? redondear(metaHa / ha) : 0,
    pctMeta: metaHa > 0 ? redondear((kgPagables / metaHa) * 100, 1) : 0,
    merma: mermaPct(kgBrutos, kgPagables),
    calidad: cal.length > 0 ? redondear(cal.reduce((a, r) => a + r.calidad!, 0) / cal.length, 1) : null,
    ingreso,
    gasto,
    utilidad: redondear(ingreso - gasto),
    retorno: gasto > 0 ? redondear(ingreso / gasto, 2) : null,
    utilidadHa: ha > 0 ? redondear((ingreso - gasto) / ha) : 0,
    equilibrioKgHa: ha > 0 && ingresoPorKg > 0 ? redondear(gasto / ingresoPorKg / ha) : 0,
  };
}

/** Verde ≥ 100% de la meta, amarillo 80–99%, rojo < 80%. */
export function semaforoMeta(pct: number): Semaforo {
  return pct >= 100 ? "verde" : pct >= 80 ? "amarillo" : "rojo";
}

/** Kg pagables por ha acumulados por semana (fecha de salida) para la gráfica contra la meta. */
export function curvaAcumulada(loteIds: string[], viajes: Viaje[], ha: number): { semana: number; kgHa: number }[] {
  const porSemana = new Map<number, number>();
  for (const v of viajes)
    for (const r of v.evaluacion?.reparto ?? [])
      if (loteIds.includes(r.loteId)) porSemana.set(semanaDeFecha(v.fecha), (porSemana.get(semanaDeFecha(v.fecha)) ?? 0) + r.kgPagables);
  let acum = 0;
  return [...porSemana.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([semana, kg]) => {
      acum += kg;
      return { semana, kgHa: ha > 0 ? redondear(acum / ha) : 0 };
    });
}

/** Lotes con la cosecha terminada que cerraron abajo de su meta de kg pagables por ha (única alerta de rendimiento). */
export function cerradosBajoMeta(lotes: Lote[], viajes: Viaje[], parametros: Parametro[]): RendimientoLote[] {
  return lotes
    .filter((l) => l.cosechaTerminada && !l.cancelado)
    .map((l) => rendimientoLote(l, viajes, parametros, 0))
    .filter((r) => r.pagablesHa < r.meta);
}

export interface ReporteCalidad {
  problemas: { problemaId: string; veces: number; kg: number }[];
  porTabla: { tablaId: string; kgBrutos: number; kgPagables: number; merma: number }[];
  porIngeniero: { ingeniero: string; kgBrutos: number; kgPagables: number; merma: number }[];
  semanal: { semana: number; kgBrutos: number; kgPagables: number; merma: number }[];
}

/** Calidad de los viajes evaluados; cada reparto pasa por `pasa` (filtros de fecha, rancho, tabla, lote, ingeniero). */
export function reporteCalidad(
  viajes: Viaje[],
  lotes: Lote[],
  pasa: (r: RepartoKg, v: Viaje) => boolean = () => true,
): ReporteCalidad {
  const probs = new Map<string, { problemaId: string; veces: number; kg: number }>();
  const grupo = <K,>(m: Map<K, { kgBrutos: number; kgPagables: number }>, k: K, base: object, r: RepartoKg) => {
    const f = m.get(k) ?? { ...base, kgBrutos: 0, kgPagables: 0 };
    f.kgBrutos += r.kgBrutos;
    f.kgPagables += r.kgPagables;
    m.set(k, f);
  };
  const tablas = new Map<string, { kgBrutos: number; kgPagables: number }>();
  const ings = new Map<string, { kgBrutos: number; kgPagables: number }>();
  const sems = new Map<number, { kgBrutos: number; kgPagables: number }>();
  for (const v of viajes) {
    const e = v.evaluacion;
    if (!e) continue;
    for (const r of e.reparto) {
      if (!pasa(r, v)) continue;
      const f = r.pct / 100;
      for (const p of e.problemas) {
        const x = probs.get(p.problemaId) ?? { problemaId: p.problemaId, veces: 0, kg: 0 };
        x.veces += 1;
        x.kg = redondear(x.kg + p.kg * f);
        probs.set(p.problemaId, x);
      }
      grupo(tablas, r.tablaId, { tablaId: r.tablaId }, r);
      const ing = lotes.find((l) => l.id === r.loteId)?.ingeniero || "Sin ingeniero";
      grupo(ings, ing, { ingeniero: ing }, r);
      const w = semanaDeFecha(v.fecha);
      grupo(sems, w, { semana: w }, r);
    }
  }
  const conMerma = <T extends { kgBrutos: number; kgPagables: number }>(xs: T[]) =>
    xs.map((x) => ({ ...x, kgBrutos: redondear(x.kgBrutos), kgPagables: redondear(x.kgPagables), merma: mermaPct(x.kgBrutos, x.kgPagables) }));
  return {
    problemas: [...probs.values()].sort((a, b) => b.veces - a.veces || b.kg - a.kg),
    porTabla: conMerma([...tablas.values()] as { tablaId: string; kgBrutos: number; kgPagables: number }[]),
    porIngeniero: conMerma([...ings.values()] as { ingeniero: string; kgBrutos: number; kgPagables: number }[]),
    semanal: conMerma([...sems.values()] as { semana: number; kgBrutos: number; kgPagables: number }[]).sort((a, b) => a.semana - b.semana),
  };
}

/* ───────────── Estatus: cosecha de la semana ───────────── */

export interface KgSemana {
  kgBrutos: number;
  kgPagables: number;
  /** Viajes evaluados que aportaron kilos. */
  viajes: number;
  /** Salidas de la semana que aún no tienen evaluación (sus kilos todavía no cuentan). */
  sinEvaluar: number;
}

/** Kilos cosechados en la semana (por fecha de salida), solo de viajes evaluados; `pasa` filtra cada lote. */
export function kgCosechadosSemana(
  viajes: Viaje[],
  semana: number,
  pasa: (r: RepartoKg) => boolean = () => true,
): KgSemana {
  let kgBrutos = 0;
  let kgPagables = 0;
  let n = 0;
  let sinEvaluar = 0;
  for (const v of viajes) {
    if (semanaDeFecha(v.fecha) !== semana) continue;
    if (!v.evaluacion) {
      sinEvaluar += 1;
      continue;
    }
    const rs = v.evaluacion.reparto.filter(pasa);
    if (rs.length === 0) continue;
    n += 1;
    for (const r of rs) {
      kgBrutos += r.kgBrutos;
      kgPagables += r.kgPagables;
    }
  }
  return { kgBrutos: redondear(kgBrutos), kgPagables: redondear(kgPagables), viajes: n, sinEvaluar };
}

export interface PorCosechar {
  lote: Lote;
  ha: number;
}

/**
 * Hectáreas que entran a cosecha en la semana: cada avance de plantación llega a su cosecha
 * `semanaCosechaLote` semanas después (así 6 ha plantadas en sem 30 y 6 ha en sem 31 se cosechan
 * en semanas distintas). Excluye lotes cancelados, finalizados o con la cosecha ya terminada.
 */
export function haPorCosecharSemana(lotes: Lote[], semana: number): PorCosechar[] {
  const out: PorCosechar[] = [];
  for (const l of lotes) {
    if (l.cancelado || l.finalizado || l.cosechaTerminada || l.avances.length === 0) continue;
    const ciclo = semanaCosechaLote(l);
    const ha = redondear(l.avances.filter((a) => a.semana + ciclo === semana).reduce((s, a) => s + a.ha, 0));
    if (ha > 0) out.push({ lote: l, ha });
  }
  return out;
}

export interface RepartoDevolucion {
  loteId: string;
  tablaId: string;
  ranchoId: string;
  cantidad: number;
}

/**
 * Reparte lo devuelto de un producto entre los lotes que lo recibieron en la semana elegida,
 * en proporción a lo que se le entregó a cada uno. Error si se devuelve más de lo entregado.
 */
export function repartirDevolucion(
  lineas: LineaDemanda[],
  productoId: string,
  cantidad: number,
): { reparto: RepartoDevolucion[]; entregado: number; error: string | null } {
  const porLote = new Map<string, RepartoDevolucion>();
  for (const l of lineas.filter((x) => x.productoId === productoId && x.cantidad > 0)) {
    const r = porLote.get(l.loteId) ?? { loteId: l.loteId, tablaId: l.tablaId, ranchoId: l.ranchoId, cantidad: 0 };
    r.cantidad += l.cantidad;
    porLote.set(l.loteId, r);
  }
  const base = [...porLote.values()];
  const entregado = base.reduce((s, r) => s + r.cantidad, 0);
  if (entregado <= 0) return { reparto: [], entregado: 0, error: "Ese producto no se entregó a ninguna tabla esa semana." };
  if (cantidad > entregado + 1e-9)
    return { reparto: [], entregado, error: `No puedes devolver más de lo entregado esa semana (${Math.round(entregado * 100) / 100}).` };
  const reparto = base.map((r) => ({ ...r, cantidad: Math.round((cantidad * r.cantidad) / entregado * 1000) / 1000 }));
  const dif = Math.round((cantidad - reparto.reduce((s, r) => s + r.cantidad, 0)) * 1000) / 1000;
  if (reparto.length && dif !== 0) reparto[reparto.length - 1]!.cantidad = Math.round((reparto[reparto.length - 1]!.cantidad + dif) * 1000) / 1000;
  return { reparto, entregado, error: null };
}

// ───────────────────────── Fase 5: cierre de ciclo e históricos ─────────────────────────

export interface PuntoCierre {
  clave: "cosecha" | "viajes" | "pagos" | "extraordinarios" | "alertas";
  texto: string;
  ok: boolean;
  detalle?: string | undefined;
}

/** Lista de verificación para cerrar un lote: todo en verde para cerrar sin pendientes. */
export function checklistCierre(
  l: Lote,
  ctx: {
    viajes: Viaje[];
    liquidaciones: Liquidacion[];
    extraordinarios: Extraordinario[];
    alertasDireccion: AlertaDireccion[];
    hoy: string;
  },
): PuntoCierre[] {
  const vs = ctx.viajes.filter((v) => v.loteIds.includes(l.id));
  const sinEvaluar = vs.filter((v) => v.status !== "evaluado").length;
  const semanas = [...new Set(vs.map((v) => semanaPago(v.fecha)))];
  const sinPagar = semanas.filter((j) => {
    const st = estatusLiquidacion(resumenSemanaPago(ctx.viajes, j), ctx.liquidaciones.find((x) => x.id === j), ctx.hoy);
    return st !== "pagada" && st !== "pagada_diferencia";
  });
  const desde = fechaPlantacionLote(l);
  const extras = ctx.extraordinarios.filter(
    (e) => e.tablaIds.includes(l.tablaId) && e.fecha >= desde && (e.status === "por_autorizar" || e.status === "autorizada" || (e.status === "surtida" && !e.mejora)),
  );
  const alertas = ctx.alertasDireccion.filter((a) => a.tablaIds.includes(l.tablaId) && a.status === "abierta");
  return [
    { clave: "cosecha", texto: "Cosecha terminada", ok: !!l.cosechaTerminada },
    { clave: "viajes", texto: "Todos los viajes evaluados", ok: sinEvaluar === 0, detalle: sinEvaluar ? `${sinEvaluar} sin evaluar` : undefined },
    { clave: "pagos", texto: "Semanas de pago pagadas", ok: sinPagar.length === 0, detalle: sinPagar.length ? `${sinPagar.length} semana(s) sin pagar` : undefined },
    { clave: "extraordinarios", texto: "Sin extraordinarios abiertos ni mejoras pendientes", ok: extras.length === 0, detalle: extras.length ? extras.map((e) => e.folio).join(", ") : undefined },
    { clave: "alertas", texto: "Sin alertas de reubicación abiertas", ok: alertas.length === 0, detalle: alertas.length ? `${alertas.length} abierta(s)` : undefined },
  ];
}

/** Foto fija del lote al cerrar. `planta` es el costo real de planta incluido en `gasto`. */
export function snapshotCiclo(
  l: Lote,
  r: RendimientoLote,
  extra: { planta: number; gastosComunes?: number; fin: string },
): Omit<CicloCerrado, "conPendientes" | "bitacora"> {
  const gastosComunes = extra.gastosComunes ?? 0;
  return {
    id: l.id,
    tipo: "sistema",
    loteId: l.id,
    ranchoId: l.ranchoId,
    tablaId: l.tablaId,
    codigo: l.codigo,
    cultivo: l.cultivo,
    variedadId: l.variedadId,
    ingeniero: l.ingeniero,
    ha: r.ha,
    plantas: l.plantas ?? 0,
    fechaPlantacion: fechaPlantacionLote(l),
    fechaFinCosecha: extra.fin,
    viajes: r.viajes,
    kgBrutos: r.kgBrutos,
    kgPagables: r.kgPagables,
    brutosHa: r.brutosHa,
    pagablesHa: r.pagablesHa,
    meta: r.meta,
    pctMeta: r.pctMeta,
    merma: r.merma,
    calidad: r.calidad,
    ingreso: r.ingreso,
    insumos: redondear(r.gasto - extra.planta),
    planta: redondear(extra.planta),
    gastosComunes,
    utilidadDirecta: r.utilidad,
    utilidadReal: redondear(r.utilidad - gastosComunes),
    retorno: r.retorno,
    utilidadHa: r.ha > 0 ? redondear((r.utilidad - gastosComunes) / r.ha) : 0,
  };
}

export interface DatosHistorico {
  ranchoId: string;
  tablaId: string;
  codigo?: string;
  cultivo: string;
  variedadId?: string;
  ingeniero: string;
  ha: number;
  plantas: number;
  fechaPlantacion: string;
  fechaFinCosecha: string;
  /** Insumos totales capturados a mano (MXN). */
  insumos: number;
  /** Costo de planta; si no se da, ha × costo de planta por ha vigente a la fecha de plantación. */
  planta?: number;
  viajes: ViajeHistorico[];
  pagos?: Record<string, number>;
}

/** Costo de planta sugerido para un ciclo histórico. */
export function plantaHistorica(parametros: Parametro[], ha: number, fecha: string, variedadId?: string): number {
  return redondear(ha * parametroVigente(parametros, "costoPlantaHa", fecha, variedadId));
}

/** Valida y arma un ciclo histórico con los parámetros vigentes en cada fecha. */
export function cicloHistorico(
  d: DatosHistorico,
  ctx: { parametros: Parametro[]; ciclos: CicloCerrado[]; lotes: Lote[]; id: string },
): { ciclo: Omit<CicloCerrado, "bitacora"> } | { error: string } {
  if (!d.ranchoId || !d.tablaId) return { error: "Elige el rancho y la tabla." };
  if (!(d.ha > 0)) return { error: "Las hectáreas deben ser mayores a 0." };
  if (!d.fechaPlantacion || !d.fechaFinCosecha) return { error: "Faltan las fechas de plantación y de fin de cosecha." };
  if (d.fechaFinCosecha < d.fechaPlantacion) return { error: "El fin de cosecha no puede ser antes de la plantación." };
  if (!(d.insumos >= 0)) return { error: "Los insumos no pueden ser negativos." };
  for (const v of d.viajes) {
    if (!v.fecha) return { error: "Cada viaje necesita su fecha." };
    if (!(v.kgBrutos > 0) || !(v.kgPagables >= 0) || v.kgPagables > v.kgBrutos)
      return { error: `Viaje ${v.folio || v.fecha}: los kg pagables deben estar entre 0 y los kg brutos.` };
    if (v.calidad !== undefined && !(v.calidad >= 1 && v.calidad <= 10)) return { error: `Viaje ${v.folio || v.fecha}: la calidad va de 1 a 10.` };
  }
  const choca = (a: string, b: string) => a <= d.fechaFinCosecha && b >= d.fechaPlantacion;
  const otro = ctx.ciclos.find((c) => !c.reabierto && c.tipo === "historico" && c.tablaId === d.tablaId && choca(c.fechaPlantacion, c.fechaFinCosecha));
  if (otro) return { error: `Las fechas se enciman con otro ciclo de esta tabla (${otro.fechaPlantacion} a ${otro.fechaFinCosecha}).` };
  const lote = ctx.lotes.find((l) => l.tablaId === d.tablaId && !l.cancelado && l.avances.length > 0 && choca(fechaPlantacionLote(l), l.cosechaTerminada ?? fechaCosechaLote(l)));
  if (lote) return { error: `Las fechas se enciman con el lote ${lote.codigo} de esta tabla.` };

  const kgBrutos = redondear(d.viajes.reduce((s, v) => s + v.kgBrutos, 0));
  const kgPagables = redondear(d.viajes.reduce((s, v) => s + v.kgPagables, 0));
  const ingreso = redondear(d.viajes.reduce((s, v) => s + v.kgPagables * parametroVigente(ctx.parametros, "precioKg", v.fecha, d.variedadId), 0));
  const planta = redondear(d.planta ?? plantaHistorica(ctx.parametros, d.ha, d.fechaPlantacion, d.variedadId));
  const gasto = redondear(d.insumos + planta);
  const meta = parametroVigente(ctx.parametros, "metaKgHa", d.fechaFinCosecha, d.variedadId);
  const pagablesHa = redondear(kgPagables / d.ha);
  const cal = d.viajes.map((v) => v.calidad).filter((c): c is number => c !== undefined);
  const utilidad = redondear(ingreso - gasto);
  return {
    ciclo: {
      id: ctx.id,
      tipo: "historico",
      ranchoId: d.ranchoId,
      tablaId: d.tablaId,
      codigo: d.codigo?.trim() || "Histórico",
      cultivo: d.cultivo,
      variedadId: d.variedadId,
      ingeniero: d.ingeniero.trim(),
      ha: d.ha,
      plantas: d.plantas,
      fechaPlantacion: d.fechaPlantacion,
      fechaFinCosecha: d.fechaFinCosecha,
      viajes: d.viajes.length,
      kgBrutos,
      kgPagables,
      brutosHa: redondear(kgBrutos / d.ha),
      pagablesHa,
      meta,
      pctMeta: meta > 0 ? redondear((pagablesHa / meta) * 100, 1) : 0,
      merma: mermaPct(kgBrutos, kgPagables),
      calidad: cal.length ? redondear(cal.reduce((s, c) => s + c, 0) / cal.length, 1) : null,
      ingreso,
      insumos: redondear(d.insumos),
      planta,
      gastosComunes: 0,
      utilidadDirecta: utilidad,
      utilidadReal: utilidad,
      retorno: gasto > 0 ? redondear(ingreso / gasto, 2) : null,
      utilidadHa: redondear(utilidad / d.ha),
      conPendientes: false,
      viajesHistoricos: d.viajes,
      pagos: d.pagos,
    },
  };
}

export interface TotalesCiclos {
  ciclos: number;
  ha: number;
  kgBrutos: number;
  kgPagables: number;
  ingreso: number;
  gastos: number;
  utilidad: number;
  kgHa: number;
  pagablesHa: number;
  utilidadHa: number;
  pctMeta: number;
}

/** Suma ha, kg, ingreso, gastos y utilidad; los "por ha" y el % de meta son promedio ponderado por ha. */
export function totalesCiclos(cs: CicloCerrado[]): TotalesCiclos {
  const s = (f: (c: CicloCerrado) => number) => redondear(cs.reduce((a, c) => a + f(c), 0));
  const ha = s((c) => c.ha);
  const kgPagables = s((c) => c.kgPagables);
  const kgBrutos = s((c) => c.kgBrutos);
  const utilidad = s((c) => c.utilidadReal);
  const metaHa = s((c) => c.meta * c.ha);
  return {
    ciclos: cs.length,
    ha,
    kgBrutos,
    kgPagables,
    ingreso: s((c) => c.ingreso),
    gastos: s((c) => c.insumos + c.planta + c.gastosComunes),
    utilidad,
    kgHa: ha > 0 ? redondear(kgBrutos / ha) : 0,
    pagablesHa: ha > 0 ? redondear(kgPagables / ha) : 0,
    utilidadHa: ha > 0 ? redondear(utilidad / ha) : 0,
    pctMeta: metaHa > 0 ? redondear((kgPagables / metaHa) * 100, 1) : 0,
  };
}

/** Variación % de b contra a (null si a es 0). */
export function variacionPct(a: number, b: number): number | null {
  return a === 0 ? null : redondear(((b - a) / Math.abs(a)) * 100, 1);
}

/** Separa una fila de CSV respetando comillas. */
function celdasCsv(linea: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (ch === '"') {
      if (q && linea[i + 1] === '"') { cur += '"'; i++; } else q = !q;
    } else if (ch === sep && !q) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export const PLANTILLA_VIAJES_CSV = "fecha,folio,chofer,kg_brutos,kg_pagables,calidad\n2025-03-10,F-001,,8200,7600,8\n";

/** Lee viajes históricos de un CSV (plantilla: fecha,folio,chofer,kg_brutos,kg_pagables,calidad). Acepta coma, punto y coma o tabulador. */
export function leerViajesCsv(texto: string): { viajes: ViajeHistorico[] } | { error: string } {
  const lineas = texto.replace(/^\uFEFF/, "").split(/\r?\n/).filter((x) => x.trim());
  if (lineas.length === 0) return { error: "El archivo está vacío." };
  const primera = lineas[0] ?? "";
  const sep = primera.includes("\t") ? "\t" : primera.includes(";") ? ";" : ",";
  const enc = celdasCsv(primera, sep).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const col = (n: string) => enc.indexOf(n);
  const cF = col("fecha"), cFo = col("folio"), cC = col("chofer"), cB = col("kg_brutos"), cP = col("kg_pagables"), cQ = col("calidad");
  if (cF < 0 || cB < 0 || cP < 0) return { error: "Faltan columnas: usa la plantilla (fecha, folio, chofer, kg_brutos, kg_pagables, calidad)." };
  const num = (x: string | undefined) => Number((x ?? "").replace(/[,$\s]/g, ""));
  const viajes: ViajeHistorico[] = [];
  for (let i = 1; i < lineas.length; i++) {
    const c = celdasCsv(lineas[i] ?? "", sep);
    const fecha = c[cF] ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: `Renglón ${i + 1}: la fecha debe ser AAAA-MM-DD.` };
    const cal = cQ >= 0 && c[cQ] ? num(c[cQ]) : undefined;
    viajes.push({
      fecha,
      folio: cFo >= 0 ? (c[cFo] ?? "") : "",
      chofer: cC >= 0 && c[cC] ? c[cC] : undefined,
      kgBrutos: num(c[cB]),
      kgPagables: num(c[cP]),
      calidad: cal,
    });
  }
  return { viajes };
}

/** Semanas máximas de cosecha por lote (temporada = de la plantación al cierre de cosecha). */
export const SEMANAS_MAX_COSECHA = 2;

/** Lote que ya lleva 2 semanas o más cosechándose sin marcar "Cosecha terminada": debe cerrarse. */
export function cosechaVencida(l: Lote, viajes: Viaje[], hoy: string): boolean {
  if (l.cancelado || l.cerrado || l.cosechaTerminada || l.avances.length === 0) return false;
  const fechas = viajes.filter((v) => v.loteIds.includes(l.id)).map((v) => v.fecha).sort();
  const inicio = fechas[0] ?? fechaCosechaLote(l);
  return sumarDias(inicio, SEMANAS_MAX_COSECHA * 7) <= hoy;
}

/* ───────────── Fase 6: gastos comunes por rancho y cultivo ───────────── */

/** Cultivo "*" = total del rancho, que se reparte entre cultivos con los % vigentes. */
export const CULTIVO_TOTAL = "*";

/** Conceptos de gasto común del rancho y su etiqueta. */
export const CONCEPTOS_GASTO: { id: ConceptoGasto; nombre: string; requiereDetalle?: boolean }[] = [
  { id: "nomina", nombre: "Nómina" },
  { id: "diesel", nombre: "Diésel" },
  { id: "gasolina", nombre: "Gasolina" },
  { id: "mano_obra_extra", nombre: "Mano de obra extra" },
  { id: "mantenimiento", nombre: "Mantenimiento de tractores y vehículos" },
  { id: "otros", nombre: "Otros", requiereDetalle: true },
];

export function nombreConceptoGasto(c: ConceptoGasto): string {
  return CONCEPTOS_GASTO.find((x) => x.id === c)?.nombre ?? c;
}

/** Minúsculas sin acentos, para reconocer nombres escritos a mano. */
function sinAcentos(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Divide una línea de CSV respetando las celdas que Excel escribe entre comillas. */
function dividir(linea: string): string[] {
  const celdas: string[] = [];
  let actual = "";
  let dentro = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i] ?? "";
    if (dentro) {
      if (ch === '"') {
        if ((linea[i + 1] ?? "") === '"') {
          actual += '"';
          i++;
        } else dentro = false;
      } else actual += ch;
    } else if (ch === '"') dentro = true;
    else if (ch === ",") {
      celdas.push(actual);
      actual = "";
    } else actual += ch;
  }
  celdas.push(actual);
  return celdas.map((c) => c.trim());
}

/** % de reparto de un rancho para una semana: el ajuste de esa semana si existe, si no los generales. */
export function repartoVigente(r: RepartoCultivo | undefined, semana: number): Record<string, number> {
  if (!r) return {};
  const aj = r.ajustes?.[String(semana)];
  return aj && Object.keys(aj).length > 0 ? aj : r.pct;
}

/** Los % de reparto entre cultivos deben sumar 100. */
export function validarReparto(pct: Record<string, number>): string | null {
  const valores = Object.values(pct);
  if (valores.length === 0) return "Define al menos un cultivo con su % de reparto.";
  if (valores.some((v) => !Number.isFinite(v) || v < 0 || v > 100)) return "Cada % debe estar entre 0 y 100.";
  const suma = redondear(valores.reduce((s, v) => s + v, 0), 2);
  if (suma !== 100) return `los % de reparto deben sumar 100 (suman ${formatoNum(suma)}%)`;
  return null;
}

/** id fijo del gasto: evita duplicar semana + rancho + cultivo + concepto. */
export function idGasto(d: {
  semana: number;
  ranchoId: string;
  cultivo: string;
  concepto: ConceptoGasto;
  detalle?: string | undefined;
}): string {
  const extra = d.concepto === "otros" ? `|${(d.detalle ?? "").trim().toLowerCase()}` : "";
  return `${d.semana}|${d.ranchoId}|${d.cultivo}|${d.concepto}${extra}`;
}

export interface DatosGasto {
  semana: number;
  ranchoId: string;
  cultivo: string;
  concepto: ConceptoGasto;
  monto: number;
  /** "directo" = monto de un cultivo; "total" = total del rancho repartido por %. */
  modo: "directo" | "total";
  detalle?: string | undefined;
  comentario?: string | undefined;
  comprobante?: string | undefined;
}

/** Valida la captura de un gasto común de rancho. */
export function validarGasto(
  d: DatosGasto,
  ctx: { gastos: GastoRancho[]; reparto?: RepartoCultivo | undefined; cultivos: string[] },
): string | null {
  if (!d.ranchoId) return "Elige el rancho.";
  if (!(d.monto > 0)) return "El monto debe ser mayor a 0.";
  if (d.modo === "total") {
    const error = validarReparto(repartoVigente(ctx.reparto, d.semana));
    if (error) return `No se puede repartir el total del rancho: ${error}.`;
  } else {
    if (!d.cultivo || d.cultivo === CULTIVO_TOTAL) return "Elige el cultivo del gasto.";
    if (!ctx.cultivos.includes(d.cultivo)) return "Ese cultivo no está en la lista del rancho.";
  }
  if (d.concepto === "otros" && !d.detalle?.trim()) return "En «Otros» escribe el concepto.";
  const id = idGasto(d);
  if (ctx.gastos.some((g) => g.id === id))
    return `Ya existe un gasto de ${nombreConceptoGasto(d.concepto)} para esa semana${
      d.modo === "total" ? " del total del rancho" : ` de ${d.cultivo}`
    }. Edítalo en lugar de duplicarlo.`;
  return null;
}

export interface GastoCultivo {
  cultivo: string;
  concepto: ConceptoGasto;
  monto: number;
  /** Gastos que lo originaron (para avisos y trazabilidad). */
  ids: string[];
}

/**
 * Gastos de una semana y rancho vueltos montos por cultivo y concepto: los directos tal cual
 * y los "total del rancho" repartidos con los % vigentes esa semana.
 */
export function gastosPorCultivo(
  gastos: GastoRancho[],
  reparto: RepartoCultivo | undefined,
  semana: number,
  ranchoId: string,
): GastoCultivo[] {
  const deSemana = gastos.filter((g) => g.semana === semana && g.ranchoId === ranchoId);
  const pct = repartoVigente(reparto, semana);
  const porClave = new Map<string, GastoCultivo>();
  const poner = (cultivo: string, concepto: ConceptoGasto, monto: number, id: string) => {
    const k = `${cultivo}|${concepto}`;
    const actual = porClave.get(k);
    if (actual) {
      actual.monto = redondear(actual.monto + monto);
      actual.ids.push(id);
    } else porClave.set(k, { cultivo, concepto, monto: redondear(monto), ids: [id] });
  };
  for (const g of deSemana) {
    if (g.modo === "total") {
      for (const [cultivo, p] of Object.entries(pct)) if (p > 0) poner(cultivo, g.concepto, (g.monto * p) / 100, g.id);
    } else poner(g.cultivo, g.concepto, g.monto, g.id);
  }
  return [...porClave.values()];
}

/** Semana en que cierra un lote (su fin de cosecha). null = sigue abierto. */
export function semanaCierreLote(l: Lote): number | null {
  if (l.cosechaTerminada) return semanaDeFecha(l.cosechaTerminada);
  if (l.cerrado) return semanaDeFecha(fechaCosechaLote(l));
  return null;
}

/** Un lote está activo desde la semana en que se planea hasta la semana en que cierra. */
export function loteActivoEnSemana(l: Lote, semana: number): boolean {
  if (semana < l.semanaPlaneada) return false;
  const cierre = semanaCierreLote(l);
  return cierre === null || semana <= cierre;
}

/** Si el lote estuvo activo en alguna semana del rango. */
export function loteActivoEnRango(l: Lote, desde: number, hasta: number): boolean {
  const cierre = semanaCierreLote(l);
  return l.semanaPlaneada <= hasta && (cierre === null || cierre >= desde);
}

/** Lotes del rancho y cultivo que entran al reparto de una semana (incluidos los cancelados). */
export function lotesBaseSemana(lotes: Lote[], ranchoId: string, cultivo: string, semana: number): Lote[] {
  return lotes.filter((l) => l.ranchoId === ranchoId && l.cultivo === cultivo && loteActivoEnSemana(l, semana));
}

export interface NoAsignado {
  cultivo: string;
  concepto: ConceptoGasto;
  monto: number;
  motivo: string;
}

export interface ProrrateoSemana {
  semana: number;
  ranchoId: string;
  /** loteId → monto asignado */
  porLote: Record<string, number>;
  /** loteId → concepto → monto */
  porLoteConcepto: Record<string, Partial<Record<ConceptoGasto, number>>>;
  /** Gasto que no se pudo repartir */
  noAsignado: NoAsignado[];
  total: number;
}

/**
 * Reparte el gasto de cada cultivo de una semana solo entre los lotes de ese cultivo y rancho
 * activos esa semana, proporcional a hectáreas. Lo que tocaba a un lote cancelado, y lo de un
 * cultivo sin lotes activos, queda como gasto no asignado del rancho y cultivo.
 */
export function prorrateoSemana(ctx: {
  semana: number;
  ranchoId: string;
  lotes: Lote[];
  gastos: GastoRancho[];
  reparto?: RepartoCultivo | undefined;
}): ProrrateoSemana {
  const { semana, ranchoId } = ctx;
  const porLote: Record<string, number> = {};
  const porLoteConcepto: Record<string, Partial<Record<ConceptoGasto, number>>> = {};
  const noAsignado: NoAsignado[] = [];
  let total = 0;
  for (const g of gastosPorCultivo(ctx.gastos, ctx.reparto, semana, ranchoId)) {
    total = redondear(total + g.monto);
    const base = lotesBaseSemana(ctx.lotes, ranchoId, g.cultivo, semana);
    const ha = redondear(base.reduce((s, l) => s + l.ha, 0), 4);
    if (base.length === 0 || ha <= 0) {
      noAsignado.push({ cultivo: g.cultivo, concepto: g.concepto, monto: g.monto, motivo: "Sin lotes activos esa semana" });
      continue;
    }
    for (const l of base) {
      const monto = redondear(g.monto * (l.ha / ha));
      if (l.cancelado) {
        noAsignado.push({ cultivo: g.cultivo, concepto: g.concepto, monto, motivo: `Lote ${l.codigo} cancelado` });
        continue;
      }
      porLote[l.id] = redondear((porLote[l.id] ?? 0) + monto);
      const antes = porLoteConcepto[l.id]?.[g.concepto] ?? 0;
      porLoteConcepto[l.id] = { ...(porLoteConcepto[l.id] ?? {}), [g.concepto]: redondear(antes + monto) };
    }
  }
  return { semana, ranchoId, porLote, porLoteConcepto, noAsignado, total };
}

export interface ProrrateoRango {
  porSemana: ProrrateoSemana[];
  /** loteId → monto total del rango */
  porLote: Record<string, number>;
  /** loteId → concepto → monto */
  porLoteConcepto: Record<string, Partial<Record<ConceptoGasto, number>>>;
  noAsignado: (NoAsignado & { semana: number; ranchoId: string })[];
  total: number;
}

/** Prorrateo de varias semanas de una sola vez (semanas y ranchos con gasto capturado). */
export function prorrateoRango(ctx: {
  desde: number;
  hasta: number;
  lotes: Lote[];
  gastos: GastoRancho[];
  repartos: RepartoCultivo[];
}): ProrrateoRango {
  const semanas = new Set<number>();
  const ranchos = new Set<string>();
  for (const g of ctx.gastos) {
    if (g.semana < ctx.desde || g.semana > ctx.hasta) continue;
    semanas.add(g.semana);
    ranchos.add(g.ranchoId);
  }
  const porLote: Record<string, number> = {};
  const porLoteConcepto: Record<string, Partial<Record<ConceptoGasto, number>>> = {};
  const noAsignado: (NoAsignado & { semana: number; ranchoId: string })[] = [];
  const porSemana: ProrrateoSemana[] = [];
  let total = 0;
  for (const semana of [...semanas].sort((a, b) => a - b)) {
    for (const ranchoId of [...ranchos].sort()) {
      const p = prorrateoSemana({
        semana,
        ranchoId,
        lotes: ctx.lotes,
        gastos: ctx.gastos,
        reparto: ctx.repartos.find((r) => r.ranchoId === ranchoId),
      });
      porSemana.push(p);
      total = redondear(total + p.total);
      for (const [loteId, monto] of Object.entries(p.porLote)) porLote[loteId] = redondear((porLote[loteId] ?? 0) + monto);
      for (const [loteId, conceptos] of Object.entries(p.porLoteConcepto))
        for (const [c, monto] of Object.entries(conceptos)) {
          const clave = c as ConceptoGasto;
          porLoteConcepto[loteId] = { ...(porLoteConcepto[loteId] ?? {}), [clave]: redondear((porLoteConcepto[loteId]?.[clave] ?? 0) + (monto ?? 0)) };
        }
      for (const n of p.noAsignado) noAsignado.push({ ...n, semana, ranchoId });
    }
  }
  return { porSemana, porLote, porLoteConcepto, noAsignado, total };
}

/** Gastos comunes asignados a un lote (monto total y desglose por concepto). */
export function gastosComunesLote(
  loteId: string,
  p: Pick<ProrrateoRango, "porLote" | "porLoteConcepto">,
): { total: number; porConcepto: Record<ConceptoGasto, number> } {
  const porConcepto = Object.fromEntries(CONCEPTOS_GASTO.map((c) => [c.id, 0])) as Record<ConceptoGasto, number>;
  for (const [c, monto] of Object.entries(p.porLoteConcepto[loteId] ?? {}))
    porConcepto[c as ConceptoGasto] = redondear(monto ?? 0);
  return { total: p.porLote[loteId] ?? 0, porConcepto };
}

export interface UtilidadLote {
  loteId: string;
  ha: number;
  ingreso: number;
  insumos: number;
  planta: number;
  gastoDirecto: number;
  utilidadDirecta: number;
  gastosComunes: number;
  utilidadReal: number;
  utilidadDirectaHa: number;
  utilidadRealHa: number;
  retornoDirecto: number | null;
  retornoReal: number | null;
}

/** Utilidad directa (ingreso − insumos − planta) y real (menos gastos comunes), con su retorno y por ha. */
export function utilidadLote(r: RendimientoLote, extra: { planta: number; gastosComunes: number }): UtilidadLote {
  const planta = redondear(extra.planta);
  const gastosComunes = redondear(extra.gastosComunes);
  const utilidadDirecta = redondear(r.ingreso - r.gasto);
  const utilidadReal = redondear(utilidadDirecta - gastosComunes);
  const gastoTotal = redondear(r.gasto + gastosComunes);
  return {
    loteId: r.loteId,
    ha: r.ha,
    ingreso: r.ingreso,
    insumos: redondear(r.gasto - planta),
    planta,
    gastoDirecto: r.gasto,
    utilidadDirecta,
    gastosComunes,
    utilidadReal,
    utilidadDirectaHa: r.ha > 0 ? redondear(utilidadDirecta / r.ha) : 0,
    utilidadRealHa: r.ha > 0 ? redondear(utilidadReal / r.ha) : 0,
    retornoDirecto: r.gasto > 0 ? redondear(r.ingreso / r.gasto, 2) : null,
    retornoReal: gastoTotal > 0 ? redondear(r.ingreso / gastoTotal, 2) : null,
  };
}

export interface FilaResultados {
  /** `rancho|cultivo` */
  clave: string;
  ranchoId: string;
  cultivo: string;
  lotes: number;
  ha: number;
  ingreso: number;
  insumos: number;
  planta: number;
  porConcepto: Record<ConceptoGasto, number>;
  gastosComunes: number;
  noAsignado: number;
  utilidadDirecta: number;
  utilidadReal: number;
  utilidadRealHa: number;
  retornoReal: number | null;
}

export interface EstadoResultados {
  filas: FilaResultados[];
  totales: Omit<FilaResultados, "clave" | "ranchoId" | "cultivo" | "retornoReal">;
  desde: number;
  hasta: number;
}

const filaVacia = (ranchoId: string, cultivo: string): FilaResultados => ({
  clave: `${ranchoId}|${cultivo}`,
  ranchoId,
  cultivo,
  lotes: 0,
  ha: 0,
  ingreso: 0,
  insumos: 0,
  planta: 0,
  porConcepto: Object.fromEntries(CONCEPTOS_GASTO.map((c) => [c.id, 0])) as Record<ConceptoGasto, number>,
  gastosComunes: 0,
  noAsignado: 0,
  utilidadDirecta: 0,
  utilidadReal: 0,
  utilidadRealHa: 0,
  retornoReal: null,
});

/**
 * Estado de resultados por rancho y cultivo en un rango de semanas:
 * ingreso − insumos − planta − cada concepto − gasto no asignado = utilidad real.
 */
export function estadoResultados(ctx: {
  desde: number;
  hasta: number;
  lotes: Lote[];
  viajes: Viaje[];
  parametros: Parametro[];
  gastos: GastoRancho[];
  repartos: RepartoCultivo[];
  costoLote: (loteId: string) => number;
  plantaLote: (loteId: string) => number;
  pasa?: ((l: Lote) => boolean) | undefined;
}): EstadoResultados {
  const p = prorrateoRango(ctx);
  const grupos = new Map<string, FilaResultados>();
  const fila = (ranchoId: string, cultivo: string): FilaResultados => {
    const clave = `${ranchoId}|${cultivo}`;
    const f = grupos.get(clave) ?? filaVacia(ranchoId, cultivo);
    grupos.set(clave, f);
    return f;
  };
  for (const l of ctx.lotes) {
    if (l.cancelado || !loteActivoEnRango(l, ctx.desde, ctx.hasta)) continue;
    if (ctx.pasa && !ctx.pasa(l)) continue;
    const r = rendimientoLote(l, ctx.viajes, ctx.parametros, ctx.costoLote(l.id));
    const f = fila(l.ranchoId, l.cultivo);
    const planta = ctx.plantaLote(l.id);
    f.lotes += 1;
    f.ha = redondear(f.ha + r.ha, 2);
    f.ingreso = redondear(f.ingreso + r.ingreso);
    f.insumos = redondear(f.insumos + (r.gasto - planta));
    f.planta = redondear(f.planta + planta);
    f.gastosComunes = redondear(f.gastosComunes + (p.porLote[l.id] ?? 0));
    for (const [c, monto] of Object.entries(p.porLoteConcepto[l.id] ?? {}))
      f.porConcepto[c as ConceptoGasto] = redondear((f.porConcepto[c as ConceptoGasto] ?? 0) + (monto ?? 0));
    f.utilidadDirecta = redondear(f.utilidadDirecta + (r.ingreso - r.gasto));
  }
  for (const n of p.noAsignado) {
    const f = fila(n.ranchoId, n.cultivo);
    f.noAsignado = redondear(f.noAsignado + n.monto);
  }
  const filas = [...grupos.values()].map((f) => {
    const utilidadReal = redondear(f.utilidadDirecta - f.gastosComunes - f.noAsignado);
    const gastoTotal = redondear(f.insumos + f.planta + f.gastosComunes + f.noAsignado);
    return {
      ...f,
      utilidadReal,
      utilidadRealHa: f.ha > 0 ? redondear(utilidadReal / f.ha) : 0,
      retornoReal: gastoTotal > 0 ? redondear(f.ingreso / gastoTotal, 2) : null,
    };
  });
  filas.sort((a, b) => a.ranchoId.localeCompare(b.ranchoId) || a.cultivo.localeCompare(b.cultivo));
  const suma = (f: (x: FilaResultados) => number) => redondear(filas.reduce((s, x) => s + f(x), 0));
  const totales = {
    lotes: filas.reduce((s, x) => s + x.lotes, 0),
    ha: suma((x) => x.ha),
    ingreso: suma((x) => x.ingreso),
    insumos: suma((x) => x.insumos),
    planta: suma((x) => x.planta),
    porConcepto: Object.fromEntries(
      CONCEPTOS_GASTO.map((c) => [c.id, suma((x) => x.porConcepto[c.id] ?? 0)]),
    ) as Record<ConceptoGasto, number>,
    gastosComunes: suma((x) => x.gastosComunes),
    noAsignado: suma((x) => x.noAsignado),
    utilidadDirecta: suma((x) => x.utilidadDirecta),
    utilidadReal: suma((x) => x.utilidadReal),
    utilidadRealHa: 0,
  };
  totales.utilidadRealHa = totales.ha > 0 ? redondear(totales.utilidadReal / totales.ha) : 0;
  return { filas, totales, desde: ctx.desde, hasta: ctx.hasta };
}

/** Cultivos con lotes (planeados o plantados) de un rancho, para las filas de la cuadrícula. */
export function cultivosDelRancho(lotes: Lote[], ranchoId: string, semana?: number): string[] {
  const xs = lotes.filter(
    (l) => l.ranchoId === ranchoId && (semana === undefined || loteActivoEnSemana(l, semana)),
  );
  return [...new Set(xs.map((l) => l.cultivo))].sort();
}

export const PLANTILLA_GASTOS_CSV = "semana,rancho,cultivo,concepto,monto\n45,Dolores,Brócoli,Nómina,60000\n";

export interface FilaGastoCsv {
  semana: number;
  ranchoId: string;
  cultivo: string;
  concepto: ConceptoGasto;
  monto: number;
}

/**
 * Lee la cuadrícula de gastos desde Excel/CSV: semana, rancho, cultivo, concepto, monto.
 * Acepta el id o el nombre escrito a mano de rancho, cultivo y concepto.
 */
export function leerGastosCsv(
  texto: string,
  ctx: { ranchos: Rancho[]; cultivos: CultivoCat[] },
): { filas: FilaGastoCsv[]; errores: string[] } {
  const filas: FilaGastoCsv[] = [];
  const errores: string[] = [];
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== "");
  const busca = <T extends { id: string; nombre: string }>(
    lista: T[],
    valor: string,
    fila: number,
    que: string,
  ): string | null => {
    const v = sinAcentos(valor.trim());
    const porId = lista.find((x) => x.id.toLowerCase() === v);
    if (porId) return porId.id;
    const porNombre = lista.find((x) => sinAcentos(x.nombre) === v);
    if (porNombre) return porNombre.id;
    errores.push(`Línea ${fila}: no encuentro ${que} «${valor}».`);
    return null;
  };
  lineas.forEach((linea, i) => {
    const n = i + 1;
    const celdas = dividir(linea);
    if (celdas.length < 5) {
      if (sinAcentos(celdas[0] ?? "") === "semana") return;
      errores.push(`Línea ${n}: hacen falta semana, rancho, cultivo, concepto y monto.`);
      return;
    }
    const semana = Number(celdas[0]);
    if (!Number.isFinite(semana)) {
      if (sinAcentos(celdas[0]) === "semana") return;
      errores.push(`Línea ${n}: la semana «${celdas[0]}» no es un número.`);
      return;
    }
    const ranchoId = busca(ctx.ranchos, celdas[1], n, "el rancho");
    const cultivo = busca(ctx.cultivos, celdas[2], n, "el cultivo");
    const cv = sinAcentos(celdas[3]);
    const concepto = CONCEPTOS_GASTO.find((c) => c.id === cv || sinAcentos(c.nombre) === cv)?.id;
    if (!concepto) {
      errores.push(`Línea ${n}: no conozco el concepto «${celdas[3]}».`);
      return;
    }
    const monto = Number(String(celdas[4]).replace(/[$, ]/g, ""));
    if (!(monto > 0)) {
      errores.push(`Línea ${n}: el monto «${celdas[4]}» debe ser mayor a 0.`);
      return;
    }
    if (!ranchoId || !cultivo) return;
    filas.push({ semana, ranchoId, cultivo, concepto, monto: redondear(monto) });
  });
  return { filas, errores };
}
