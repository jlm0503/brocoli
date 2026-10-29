import type {
  Adicional,
  AlertaInsumos,
  Cultivo,
  DosisPorSemana,
  EstatusRecepcion,
  EstatusTabla,
  InsumoAsignado,
  LineaDemanda,
  Lote,
  PedidoPlaneacion,
  Producto,
  Familia,
  Receta,
  Recetas,
  Recepcion,
  Semaforo,
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

export const CULTIVO_LABEL: Record<Cultivo, string> = { brocoli: "Brócoli", coliflor: "Coliflor" };

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

export function codigoDisponible(productos: Producto[], codigo: string, exceptoId?: string): boolean {
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

/** La receta de un lote plantado es su copia guardada; si aún no se planta, la vigente de su cultivo. */
export function recetaLote(lote: Lote, recetas: Recetas, adicionales: Adicional[]): DosisPorSemana {
  return lote.receta ?? recetaEfectiva(recetas[lote.cultivo], adicionales, lote.tablaId);
}

/** Paquete de planeación (semana -2) × hectáreas. */
export function lineasPlaneacion(
  receta: Receta,
  adicionales: Adicional[],
  tablaId: string,
  ha: number,
): { productoId: string; cantidad: number }[] {
  const sem = recetaEfectiva(receta, adicionales, tablaId)[SEMANA_PLANEACION] ?? {};
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
    return semanaActual >= real + semanaCosechaLote(l) + SEMANAS_CIERRE ? { ...l, finalizado: true } : l;
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

export function estatusTabla(t: Tabla, lotes: Lote[]): EstatusTabla {
  const planeadas = hectareasPlaneadas(lotes, t.id);
  const plantadas = hectareasPlantadas(lotes, t.id);
  if (planeadas <= 0) return "libre";
  if (plantadas > 0) return plantadas >= t.hectareas ? "plantada" : "plantada-parcial";
  return planeadas >= t.hectareas ? "planeada" : "parcial-planeada";
}

export const ESTATUS_TABLA_LABEL: Record<EstatusTabla, string> = {
  libre: "Libre",
  "parcial-planeada": "Parcialmente planeada",
  planeada: "Planeada completa",
  "plantada-parcial": "Plantada parcial",
  plantada: "Plantada completa",
};

/** Semana de cultivo de la tabla según su primer lote plantado. */
export function semanaCultivoTabla(lotes: Lote[], tablaId: string, semanaActual: number): number | null {
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
  if (ha > disponibles) return `Solo quedan ${formatoNum(disponibles)} ha disponibles en esta tabla.`;
  return null;
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

export function sumarPorProducto(items: { productoId: string; cantidad: number }[]): Map<string, number> {
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
    .map((n) => ({ productoId: n.productoId, cantidad: redondear(Math.max(0, n.cantidad - (disp.get(n.productoId) ?? 0))) }))
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
    out.push({ ...l, ha: plantadas, insumos: escalar(l.insumos, fPlant) });
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
      cantidadPedido: unidad.get(c.productoId) === "rollo" ? Math.ceil(c.cantidad - 1e-9) : c.cantidad,
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
  const suma = sumarPorProducto(pedidos.filter((p) => p.status !== "cancelado").flatMap((p) => p.lineas));
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
  const precio = new Map(productos.map((p) => [p.id, p.precio]));
  return lineas.reduce(
    (s, l) => s + cantidadRecibida(l, recepciones) * (precio.get(l.productoId) ?? 0),
    0,
  );
}

/** Costo de los insumos de planeación entregados al lote. */
export function costoPlaneacionLote(l: Lote, pedidos: PedidoPlaneacion[], productos: Producto[]): number {
  const precio = new Map(productos.map((p) => [p.id, p.precio]));
  return insumosEntregados(l, pedidos).reduce(
    (s, i) => s + i.cantidad * (precio.get(i.productoId) ?? 0),
    0,
  );
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
