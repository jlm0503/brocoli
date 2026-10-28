import type {
  Cohorte,
  EstatusRecepcion,
  EstatusTabla,
  LineaDemanda,
  Plan,
  Producto,
  Receta,
  Recepcion,
  Tabla,
} from "./types";

/** Semanas mínimas de anticipación para apartar una tabla. */
export const ANTICIPACION_SEMANAS = 2;
export const CICLO_MIN = 10;
export const CICLO_MAX = 12;

const LUNES_SEMANA_1_2026 = Date.UTC(2025, 11, 29);
const DIA = 24 * 60 * 60 * 1000;

/** Lunes de la semana ISO `w` de 2026. */
export function inicioSemana(w: number): Date {
  return new Date(LUNES_SEMANA_1_2026 + (w - 1) * 7 * DIA);
}

export function semanaDeFecha(iso: string): number {
  const t = Date.parse(iso + "T00:00:00Z");
  return Math.floor((t - LUNES_SEMANA_1_2026) / (7 * DIA)) + 1;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function fechaCorta(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d + "T00:00:00Z") : d;
  return `${date.getUTCDate()} ${MESES[date.getUTCMonth()]}`;
}

/** Fecha límite de entrega: el lunes de la semana en que se aplica. */
export function fechaLimite(semana: number): string {
  return fechaCorta(inicioSemana(semana));
}

export function hectareasPlantadas(plan?: Plan): number {
  if (!plan) return 0;
  return redondear(plan.avances.reduce((s, a) => s + a.ha, 0));
}

export function hectareasPendientes(plan?: Plan): number {
  if (!plan) return 0;
  return redondear(Math.max(0, plan.ha - hectareasPlantadas(plan)));
}

export function estatusTabla(t: Tabla): EstatusTabla {
  if (!t.plan) return "libre";
  return hectareasPlantadas(t.plan) > 0 ? "plantada" : "planeada";
}

/**
 * Semana a la que se arrastran los pendientes: si la semana planeada ya pasó,
 * lo no plantado se mueve a la semana actual.
 */
export function semanaPendiente(plan: Plan, semanaActual: number): number {
  return Math.max(plan.semana, semanaActual);
}

export function pendienteArrastrado(plan: Plan | undefined, semanaActual: number): boolean {
  if (!plan) return false;
  return hectareasPendientes(plan) > 0 && plan.semana < semanaActual;
}

/** Grupos de hectáreas por semana de plantación: lo real + lo pendiente proyectado. */
export function cohortes(t: Tabla, semanaActual: number): Cohorte[] {
  const plan = t.plan;
  if (!plan) return [];
  const porSemana = new Map<number, number>();
  for (const a of plan.avances) porSemana.set(a.semana, (porSemana.get(a.semana) ?? 0) + a.ha);
  const out: Cohorte[] = [...porSemana.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([semana, ha]) => ({ semana, ha: redondear(ha), real: true }));
  const pend = hectareasPendientes(plan);
  if (pend > 0) out.push({ semana: semanaPendiente(plan, semanaActual), ha: pend, real: false });
  return out;
}

export function semanaCultivo(semanaPlantacion: number, semana: number): number {
  return semana - semanaPlantacion + 1;
}

/** Semana de cultivo actual de la tabla (según su primera plantación real). */
export function semanaCultivoTabla(t: Tabla, semanaActual: number): number | null {
  const reales = cohortes(t, semanaActual).filter((c) => c.real);
  if (reales.length === 0) return null;
  return semanaCultivo(reales[0].semana, semanaActual);
}

/** Hectáreas activas: plantadas y aún dentro del ciclo. */
export function hectareasActivas(t: Tabla, receta: Receta, semanaActual: number): number {
  return redondear(
    cohortes(t, semanaActual)
      .filter((c) => c.real)
      .filter((c) => {
        const sc = semanaCultivo(c.semana, semanaActual);
        return sc >= 1 && sc <= receta.semanas;
      })
      .reduce((s, c) => s + c.ha, 0),
  );
}

export function dosisEnSemana(receta: Receta, productoId: string, semanaCultivo: number): number {
  if (semanaCultivo < 1 || semanaCultivo > receta.semanas) return 0;
  return receta.dosis[productoId]?.[semanaCultivo - 1] ?? 0;
}

/** Demanda de insumos de una tabla en una semana: hectáreas en cada etapa × receta. */
export function lineasTabla(
  t: Tabla,
  receta: Receta,
  semana: number,
  semanaActual: number,
): LineaDemanda[] {
  const acumulado = new Map<string, { cantidad: number; sc: number }>();
  for (const c of cohortes(t, semanaActual)) {
    const sc = semanaCultivo(c.semana, semana);
    if (sc < 1 || sc > receta.semanas) continue;
    for (const pid of Object.keys(receta.dosis)) {
      const d = dosisEnSemana(receta, pid, sc);
      if (d <= 0) continue;
      const prev = acumulado.get(pid);
      acumulado.set(pid, { cantidad: (prev?.cantidad ?? 0) + d * c.ha, sc: prev?.sc ?? sc });
    }
  }
  return [...acumulado.entries()].map(([productoId, v]) => ({
    key: `${t.id}|${productoId}|${semana}`,
    tablaId: t.id,
    ranchoId: t.ranchoId,
    productoId,
    semana,
    semanaCultivo: v.sc,
    cantidad: redondear(v.cantidad),
  }));
}

export function lineasSemanas(
  tablas: Tabla[],
  receta: Receta,
  semanas: number[],
  semanaActual: number,
): LineaDemanda[] {
  return tablas.flatMap((t) => semanas.flatMap((w) => lineasTabla(t, receta, w, semanaActual)));
}

/** Lo anterior a la semana actual se da por recibido en el prototipo. */
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
  cantidad: number;
  keys: string[];
  status: EstatusRecepcion | "parcial";
}

export function consolidar(
  lineas: LineaDemanda[],
  recepciones: Record<string, Recepcion>,
  semanaActual: number,
): Consolidado[] {
  const map = new Map<string, Consolidado & { statuses: Set<EstatusRecepcion> }>();
  for (const l of lineas) {
    const k = `${l.ranchoId}|${l.productoId}|${l.semana}`;
    const cur = map.get(k) ?? {
      ranchoId: l.ranchoId,
      productoId: l.productoId,
      semana: l.semana,
      cantidad: 0,
      keys: [],
      status: "pendiente" as const,
      statuses: new Set<EstatusRecepcion>(),
    };
    cur.cantidad = redondear(cur.cantidad + l.cantidad);
    cur.keys.push(l.key);
    cur.statuses.add(estatusLinea(l, recepciones, semanaActual));
    map.set(k, cur);
  }
  return [...map.values()].map(({ statuses, ...c }) => ({
    ...c,
    status: statuses.size === 1 ? [...statuses][0] : "parcial",
  }));
}

/** Errores de validación al apartar una tabla. `null` si es válido. */
export function validarApartado(
  t: Tabla,
  semana: number,
  ha: number,
  semanaActual: number,
): string | null {
  if (estatusTabla(t) !== "libre") return "Solo se pueden apartar tablas libres.";
  if (semana < semanaActual + ANTICIPACION_SEMANAS)
    return `Se aparta con al menos ${ANTICIPACION_SEMANAS} semanas de anticipación (semana ${semanaActual + ANTICIPACION_SEMANAS} o posterior).`;
  if (!(ha > 0)) return "Indica cuántas hectáreas se van a plantar.";
  if (ha > t.hectareas) return `La tabla solo tiene ${t.hectareas} ha.`;
  return null;
}

/** Errores al registrar un avance diario. `null` si es válido. */
export function validarAvance(t: Tabla, ha: number, semanaActual: number): string | null {
  if (!t.plan) return "La tabla no tiene una plantación planeada.";
  if (t.plan.semana > semanaActual)
    return `La plantación está planeada para la semana ${t.plan.semana}.`;
  if (!(ha > 0)) return "Indica las hectáreas plantadas hoy.";
  const pend = hectareasPendientes(t.plan);
  if (ha > pend) return `Solo quedan ${pend} ha por plantar.`;
  return null;
}

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
