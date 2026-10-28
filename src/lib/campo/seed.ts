import { cerrarSemana, fechaEnSemana, lineasPlaneacion, recetaEfectiva } from "./calc";
import type {
  Adicional,
  AlertaInsumos,
  Avance,
  Lote,
  PedidoPlaneacion,
  PlaneacionTardia,
  Producto,
  Rancho,
  Receta,
  Tabla,
} from "./types";

/** "Hoy" en el prototipo al abrir: miércoles 28 de octubre de 2026, semana 44. */
export const SEMANA_INICIAL = 44;
export const HOY_INICIAL = "2026-10-28";

export const PRODUCTOS_INICIALES: Producto[] = [
  { id: "yeso", codigo: "SUE-001", nombre: "Yeso agrícola", familia: "Suelo", unidad: "kg", precio: 4.5 },
  { id: "starkop", codigo: "SUE-002", nombre: "Starkop (corrector de pH)", familia: "Suelo", unidad: "L", precio: 180 },
  { id: "metam", codigo: "AGQ-001", nombre: "Metam sodio", familia: "Agroquímico", unidad: "L", precio: 95 },
  { id: "trif", codigo: "AGQ-002", nombre: "Trifluralina", familia: "Agroquímico", unidad: "L", precio: 260 },
  { id: "cinta", codigo: "RIE-001", nombre: "Cinta de riego (rollo)", familia: "Riego", unidad: "rollo", precio: 1850 },
  { id: "map", codigo: "FER-001", nombre: "MAP 11-52-00", familia: "Fertilizante", unidad: "kg", precio: 18 },
  { id: "urea", codigo: "FER-002", nombre: "Urea 46%", familia: "Fertilizante", unidad: "kg", precio: 9.5 },
  { id: "nca", codigo: "FER-003", nombre: "Nitrato de calcio", familia: "Fertilizante", unidad: "kg", precio: 14 },
  { id: "sk", codigo: "FER-004", nombre: "Sulfato de potasio", familia: "Fertilizante", unidad: "kg", precio: 22 },
  { id: "hum", codigo: "BIO-001", nombre: "Ácido húmico", familia: "Bioestimulante", unidad: "L", precio: 85 },
  { id: "boro", codigo: "MIC-001", nombre: "Boro 10%", familia: "Micronutriente", unidad: "L", precio: 120 },
  { id: "clo", codigo: "FUN-001", nombre: "Clorotalonil 720", familia: "Fungicida", unidad: "L", precio: 210 },
  { id: "man", codigo: "FUN-002", nombre: "Mancozeb 80%", familia: "Fungicida", unidad: "kg", precio: 95 },
  { id: "spi", codigo: "INS-001", nombre: "Spinosad", familia: "Insecticida", unidad: "L", precio: 1450 },
  { id: "imi", codigo: "INS-002", nombre: "Imidacloprid", familia: "Insecticida", unidad: "L", precio: 680 },
  { id: "pen", codigo: "HER-001", nombre: "Pendimetalina", familia: "Herbicida", unidad: "L", precio: 240 },
];

export const RECETA_INICIAL: Receta = {
  dosis: {
    [-2]: { yeso: 500, metam: 60, trif: 1.5, cinta: 2.1 },
    [-1]: {},
    0: { map: 50, hum: 3, imi: 0.5, pen: 2 },
    1: { map: 40, urea: 30, hum: 3, man: 2 },
    2: { map: 25, urea: 40, nca: 20, hum: 2, clo: 1.5 },
    3: { urea: 50, nca: 25, hum: 2, man: 2, spi: 0.2 },
    4: { urea: 50, nca: 30, sk: 20, boro: 1, clo: 1.5 },
    5: { urea: 40, nca: 30, sk: 30, boro: 1, man: 2, imi: 0.5 },
    6: { urea: 30, nca: 30, sk: 40, boro: 1.5, clo: 1.5, spi: 0.2 },
    7: { urea: 20, nca: 25, sk: 40, boro: 1.5, man: 2 },
    8: { nca: 20, sk: 35, boro: 1, clo: 1.5 },
    9: { nca: 15, sk: 30, man: 2, spi: 0.2 },
    10: { sk: 20, clo: 1.5 },
    11: {},
    12: {},
  },
};

export const ADICIONALES_INICIALES: Adicional[] = [
  {
    id: "ad-1",
    ranchoId: "isidro",
    tablaIds: ["s01", "s02"],
    productoId: "starkop",
    semanas: [2, 3, 4],
    dosis: 3,
    motivo: "Corrección de pH",
  },
  {
    id: "ad-2",
    ranchoId: "loma",
    tablaIds: ["l03"],
    productoId: "yeso",
    semanas: [-2],
    dosis: 200,
    motivo: "Suelo salino",
  },
];

export const RANCHOS: Rancho[] = [
  { id: "mirador", nombre: "El Mirador", zona: "Valle de Zamora" },
  { id: "isidro", nombre: "San Isidro", zona: "Tanhuato" },
  { id: "loma", nombre: "La Loma", zona: "Yurécuaro" },
];

export const TABLAS_INICIALES: Tabla[] = [
  { id: "m01", ranchoId: "mirador", nombre: "Tabla 1", hectareas: 6, gps: { lat: 19.9862, lng: -102.2834 } },
  { id: "m02", ranchoId: "mirador", nombre: "Tabla 2", hectareas: 5, gps: { lat: 19.9841, lng: -102.2801 } },
  { id: "m03", ranchoId: "mirador", nombre: "Tabla 3", hectareas: 4 },
  { id: "m04", ranchoId: "mirador", nombre: "Tabla 4", hectareas: 5 },
  { id: "m05", ranchoId: "mirador", nombre: "Tabla 5", hectareas: 4.5 },
  { id: "m06", ranchoId: "mirador", nombre: "Tabla 6", hectareas: 3 },
  { id: "s01", ranchoId: "isidro", nombre: "Tabla 1", hectareas: 7 },
  { id: "s02", ranchoId: "isidro", nombre: "Tabla 2", hectareas: 6 },
  { id: "s03", ranchoId: "isidro", nombre: "Tabla 3", hectareas: 5 },
  { id: "s04", ranchoId: "isidro", nombre: "Tabla 4", hectareas: 4 },
  { id: "s05", ranchoId: "isidro", nombre: "Tabla 5", hectareas: 12, radio: 250 },
  { id: "l01", ranchoId: "loma", nombre: "Tabla 1", hectareas: 8 },
  { id: "l02", ranchoId: "loma", nombre: "Tabla 2", hectareas: 6 },
  { id: "l03", ranchoId: "loma", nombre: "Tabla 3", hectareas: 10 },
  { id: "l04", ranchoId: "loma", nombre: "Tabla 4", hectareas: 4 },
  { id: "l05", ranchoId: "loma", nombre: "Tabla 5", hectareas: 5 },
];

/* ── Lotes y pedidos de ejemplo ── */

let n = 0;
const sid = (p: string) => `${p}-s${++n}`;

const lotes: Lote[] = [];
const pedidos: PedidoPlaneacion[] = [];

interface OpcLote {
  ingeniero?: string;
  /** [semana, ha, día de la semana] */
  avances?: [number, number, number][];
  entregado?: boolean;
  urgente?: boolean;
}

function lote(tablaId: string, codigo: string, semana: number, ha: number, o: OpcLote = {}): Lote {
  const t = TABLAS_INICIALES.find((x) => x.id === tablaId)!;
  const ingeniero = o.ingeniero ?? (t.ranchoId === "loma" ? "Ramiro" : "Israel");
  const loteId = sid("lt");
  const pedido: PedidoPlaneacion = {
    id: sid("pp"),
    loteId,
    tablaId,
    ranchoId: t.ranchoId,
    semanaPlantacion: semana,
    ha,
    lineas: lineasPlaneacion(RECETA_INICIAL, ADICIONALES_INICIALES, tablaId, ha),
    fecha: fechaEnSemana(semana - 3, 1),
    ingeniero,
    urgente: !!o.urgente,
    status: o.entregado ? "entregado" : "pendiente",
    fechaEntrega: o.entregado ? fechaEnSemana(semana - 2, 2) : undefined,
  };
  pedidos.push(pedido);
  const avances: Avance[] = (o.avances ?? []).map(([w, h, d]) => ({
    id: sid("av"),
    semana: w,
    ha: h,
    fecha: fechaEnSemana(w, d),
  }));
  const l: Lote = {
    id: loteId,
    codigo,
    tablaId,
    ranchoId: t.ranchoId,
    ha,
    semanaPlaneada: semana,
    ingeniero,
    avances,
    insumos: pedido.lineas.map((x) => ({ ...x, pedidoId: pedido.id })),
    receta: avances.length > 0 ? recetaEfectiva(RECETA_INICIAL, ADICIONALES_INICIALES, tablaId) : undefined,
  };
  lotes.push(l);
  return l;
}

const completa = (w: number, ha: number): [number, number, number][] => {
  const a = Math.round(ha * 0.6 * 2) / 2;
  return [
    [w, a, 0],
    [w, ha - a, 2],
  ];
};

// El Mirador
lote("m01", "1-A", 36, 6, { entregado: true, avances: completa(36, 6) });
lote("m02", "2-A", 39, 5, { entregado: true, avances: completa(39, 5) });
lote("m03", "3-A", 44, 4, { entregado: true, avances: [[44, 1, 0], [44, 1.5, 1]] });
lote("m04", "4-A", 43, 5, { entregado: true, avances: [[43, 2, 1], [43, 1, 3]] }); // 2 ha se arrastran → 4-A2
lote("m05", "5-A", 46, 4.5);
const cancelado = lote("m06", "6-A", 43, 3, { entregado: true });
// San Isidro
lote("s01", "1-A", 34, 7, { entregado: true, avances: completa(34, 7) });
lote("s02", "2-A", 38, 6, { entregado: true, avances: completa(38, 6) });
const tardio = lote("s03", "3-A", 45, 5, { urgente: true });
pedidos.find((p) => p.loteId === tardio.id)!.fecha = "2026-10-26"; // se planeó tarde, esta semana
// La Loma
lote("l01", "1-A", 41, 8, { entregado: true, avances: completa(41, 8) });
lote("l02", "2-A", 46, 6, { entregado: true });
lote("l03", "3-A", 46, 5);
lote("l03", "3-B", 47, 5);
lote("l04", "4-A", 37, 4, { entregado: true, avances: completa(37, 4) });
lote("l05", "5-A", 42, 5, { entregado: true }); // no se plantó: pendiente arrastrado con insumos

// La Tabla 6 de El Mirador se canceló con sus insumos ya entregados.
const alertaItems = cancelado.insumos;
cancelado.cancelado = true;
cancelado.insumos = [];

export const LOTES_INICIALES: Lote[] = cerrarSemana(lotes, 43, () => sid("lt"));
export const PEDIDOS_INICIALES: PedidoPlaneacion[] = pedidos;

export const ALERTAS_INICIALES: AlertaInsumos[] = [
  {
    id: "al-1",
    fecha: "2026-10-19",
    ranchoId: "mirador",
    tablaId: "m06",
    loteCodigo: cancelado.codigo,
    items: alertaItems,
    status: "abierta",
  },
];

export const TARDIAS_INICIALES: PlaneacionTardia[] = [
  {
    id: "pt-1",
    fecha: "2026-10-26",
    ingeniero: "Israel",
    ranchoId: "isidro",
    tablaId: "s03",
    loteCodigo: tardio.codigo,
    semanasAnticipacion: 1,
    opcion: "sin-pendientes",
  },
];
