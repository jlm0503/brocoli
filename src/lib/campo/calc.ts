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
  { nombre: string; unidad: string; defecto: number }
> = {
  plantasPorHa: { nombre: "Plantas por hectárea (sugerido)", unidad: "plantas", defecto: 60000 },
  costoPlantaHa: { nombre: "Costo de planta por hectárea", unidad: "MXN", defecto: 16200 },
  precioKg: { nombre: "Precio por kg pagable", unidad: "MXN", defecto: 10.5 },
  descuentoViaje: { nombre: "Descuento de planta por viaje", unidad: "MXN", defecto: 10000 },
  metaKgHa: {
    nombre: "Meta de rendimiento por ha (alerta si cierra abajo)",
    unidad: "kg",
    defecto: 16000,
  },
  rollosCintaHa: { nombre: "Rollos de cinta por hectárea", unidad: "rollos", defecto: 2.1 },
  diasSinEvaluacion: { nombre: "Días sin evaluación antes de alerta", unidad: "días", defecto: 3 },
};

export const CLAVES_PARAMETRO = Object.keys(PARAMETROS_INFO) as ClaveParametro[];

/** Valor que aplica en `fecha`: el último cambio con fecha de vigencia igual o anterior. */
export function parametroVigente(
  params: Parametro[],
  clave: ClaveParametro,
  fecha: string,
): number {
  let mejor: Parametro | undefined;
  for (const p of params) {
    if (p.clave !== clave || p.desde > fecha) continue;
    if (!mejor || p.desde >= mejor.desde) mejor = p;
  }
  return mejor?.valor ?? PARAMETROS_INFO[clave].defecto;
}

/** Costo por planta = costo de planta por ha ÷ plantas por ha (16,200 ÷ 60,000 = $0.27). */
export function costoPorPlanta(params: Parametro[], fecha: string): number {
  const porHa = parametroVigente(params, "plantasPorHa", fecha);
  return porHa > 0 ? redondear(parametroVigente(params, "costoPlantaHa", fecha) / porHa, 4) : 0;
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

/** Renglones de la solicitud (copia de los datos del lote). Sin plantas capturadas, se usan las sugeridas. */
export function lineasSolicitud(
  seleccion: Lote[],
  ctx: {
    ranchos: Rancho[];
    tablas: Tabla[];
    variedades: Variedad[];
    plantasPorHa: number;
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
    plantas: ctx.plantas?.[l.id] ?? l.plantas ?? plantasSugeridas(l.ha, ctx.plantasPorHa),
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
  plantasPorHa: number,
): string | null {
  for (const l of seleccion) {
    const n = plantas[l.id];
    if (n === undefined) continue;
    const motivo = motivos[l.id] ?? l.motivoPlantas;
    const err = validarPlantas(n, plantasSugeridas(l.ha, plantasPorHa), motivo);
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
            return {
              fecha: e.fecha,
              tipo: "cargo" as const,
              monto: redondear(n * e.costoPlanta),
              plantas: n,
              ha: e.plantasPorHa > 0 ? redondear(n / e.plantasPorHa, 4) : 0,
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
