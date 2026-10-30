import {
  fechaDeHoja,
  fechaEnSemana,
  finalizarCosechados,
  lineasPlaneacion,
  recetaEfectiva,
  semanaDeFecha,
} from "./calc";
import type {
  Adicional,
  AlertaInsumos,
  Lote,
  PedidoPlaneacion,
  PlaneacionTardia,
  Producto,
  Rancho,
  Recetas,
  Tabla,
  Variedad,
} from "./types";

/**
 * Datos reales compartidos por el usuario (hojas "BROCOLI", "COLIFLOR" y "Paquete Tecnologico"
 * de BROCOLI_DASHBOARD_CON_DETALLES, 28 oct 2026). Los códigos de producto y la familia de cada
 * producto son provisionales; el precio unitario = costo por ha de la hoja ÷ dosis.
 */

/** "Hoy" en el prototipo al abrir: jueves 29 de octubre de 2026, semana 44. */
export const SEMANA_INICIAL = 44;
export const HOY_INICIAL = "2026-10-29";

export const VARIEDADES: Variedad[] = [
  { id: "diamante", nombre: "Diamante", cultivo: "brocoli", cicloDias: 70 },
  { id: "tlaloc", nombre: "Tlaloc", cultivo: "brocoli", cicloDias: 84 },
  { id: "altamira", nombre: "Altamira", cultivo: "coliflor", cicloDias: 95 },
];

export const PRODUCTOS_INICIALES: Producto[] = [
  { id: "goal", codigo: "HER-001", nombre: "GOAL 2XL", familia: "Herbicida", unidad: "L", precio: 580 },
  { id: "dualgold", codigo: "HER-002", nombre: "Dual Gold", familia: "Herbicida", unidad: "L", precio: 1250 },
  { id: "cintilla", codigo: "RIE-001", nombre: "Cintilla", familia: "Riego", unidad: "rollo", precio: 3461.54 },
  { id: "silifosca", codigo: "SUE-001", nombre: "Silifosca", familia: "Suelo", unidad: "kg", precio: 21.78 },
  { id: "oneact", codigo: "BIO-001", nombre: "ONE Activation", familia: "Bioestimulante", unidad: "L", precio: 270 },
  { id: "onedef", codigo: "BIO-002", nombre: "ONE Defesne", familia: "Bioestimulante", unidad: "L", precio: 560 },
  { id: "map", codigo: "FER-001", nombre: "MAP", familia: "Fertilizante", unidad: "kg", precio: 28.17 },
  { id: "fosfo", codigo: "FER-002", nombre: "Fosfonitrato", familia: "Fertilizante", unidad: "kg", precio: 13.13 },
  { id: "sulmag", codigo: "FER-003", nombre: "Sulmag", familia: "Fertilizante", unidad: "kg", precio: 7.9 },
  { id: "nca", codigo: "FER-004", nombre: "N CA", familia: "Fertilizante", unidad: "kg", precio: 10.5 },
  { id: "nk", codigo: "FER-005", nombre: "N K", familia: "Fertilizante", unidad: "kg", precio: 26 },
  { id: "sferroso", codigo: "MIC-001", nombre: "Sulfato Ferroso", familia: "Micronutriente", unidad: "kg", precio: 11.1 },
  { id: "szinc", codigo: "MIC-002", nombre: "Sulfato de Zinc", familia: "Micronutriente", unidad: "kg", precio: 33.3 },
  { id: "starkop", codigo: "FUN-001", nombre: "Starkop (Plasmodiofora)", familia: "Fungicida", unidad: "L", precio: 180 },
  { id: "oneneem", codigo: "INS-001", nombre: "ONE Neem", familia: "Insecticida", unidad: "L", precio: 120 },
  { id: "xentari", codigo: "INS-002", nombre: "Xentari (BT)", familia: "Insecticida", unidad: "kg", precio: 1188.26 },
  { id: "massada", codigo: "INS-003", nombre: "Massada 1000 (Novaluron)", familia: "Insecticida", unidad: "L", precio: 1040 },
  { id: "obug1", codigo: "INS-004", nombre: "O. Bug 1", familia: "Insecticida", unidad: "L", precio: 270 },
  { id: "obug2", codigo: "INS-005", nombre: "O. Bug 2", familia: "Insecticida", unidad: "L", precio: 270 },
  { id: "tracer", codigo: "INS-006", nombre: "Tracer", familia: "Insecticida", unidad: "kg", precio: 8620 },
  { id: "avaunt", codigo: "INS-007", nombre: "Avaunt", familia: "Insecticida", unidad: "L", precio: 2088 },
  { id: "incipio", codigo: "INS-008", nombre: "Incipio", familia: "Insecticida", unidad: "L", precio: 7480 },
  { id: "toretto", codigo: "INS-009", nombre: "Toretto", familia: "Insecticida", unidad: "L", precio: 3392.25 },
  { id: "proclaim", codigo: "INS-010", nombre: "Proclaim Opti", familia: "Insecticida", unidad: "kg", precio: 3498 },
  { id: "movento", codigo: "INS-011", nombre: "Movento", familia: "Insecticida", unidad: "L", precio: 3652 },
  { id: "exalt", codigo: "INS-012", nombre: "Exalt", familia: "Insecticida", unidad: "L", precio: 2685.84 },
  { id: "breakthru", codigo: "COA-001", nombre: "Break Thru", familia: "Coadyuvante", unidad: "L", precio: 743.2 },
  { id: "inexa", codigo: "COA-002", nombre: "IneX-A", familia: "Coadyuvante", unidad: "L", precio: 120 },
];

/** Paquete tecnológico de brócoli por ha. La hoja marca la presiembra como semana -1; aquí va en el pedido de planeación (2 semanas antes). */
export const RECETAS_INICIALES: Recetas = {
  brocoli: {
    dosis: {
      [-2]: { goal: 1, dualgold: 1, cintilla: 2, silifosca: 300 },
      [-1]: {},
      0: { oneact: 20, onedef: 2, oneneem: 6, map: 10, fosfo: 52 },
      1: { onedef: 2, oneneem: 6, map: 10, fosfo: 52 },
      2: { onedef: 2, oneneem: 6, map: 10, sulmag: 15, fosfo: 52 },
      3: { xentari: 0.5, breakthru: 0.25, massada: 0.2, obug1: 2, obug2: 2, sferroso: 5, szinc: 5, sulmag: 15, fosfo: 52 },
      4: { obug1: 2, obug2: 2, breakthru: 0.3, tracer: 0.05, sferroso: 5, szinc: 5, sulmag: 15, fosfo: 52, starkop: 5 },
      5: { obug1: 2, obug2: 2, breakthru: 0.55, avaunt: 0.3, sferroso: 5, szinc: 5, sulmag: 15, fosfo: 52 },
      6: { obug1: 2, obug2: 2, breakthru: 0.55, incipio: 0.2, toretto: 0.08, sulmag: 15, fosfo: 52, nca: 20, nk: 30, starkop: 2 },
      7: { proclaim: 0.2, movento: 0.3, breakthru: 0.25, sulmag: 15, fosfo: 52, nca: 20, nk: 30, starkop: 2 },
      8: { avaunt: 0.25, toretto: 0.08, breakthru: 0.25, sferroso: 5, szinc: 5, sulmag: 15, fosfo: 52, nca: 20, nk: 30 },
      9: { exalt: 0.25, inexa: 0.35, movento: 0.3, fosfo: 52, nca: 20, nk: 30, starkop: 2 },
      10: { tracer: 0.07, breakthru: 0.25, nca: 20, nk: 30, starkop: 2 },
      11: { exalt: 0.25, breakthru: 0.25, starkop: 2 },
      12: {},
    },
  },
  // Pendiente: el usuario lo va a calcular.
  coliflor: { dosis: {} },
};

export const ADICIONALES_INICIALES: Adicional[] = [];

export const RANCHOS: Rancho[] = [
  { id: "smonica", nombre: "Santa Mónica", zona: "Dolores" },
  { id: "dolores", nombre: "Dolores", zona: "Dolores" },
  { id: "trejo", nombre: "Trejo", zona: "Trejo" },
];

const T = (ranchoId: string, id: string, nombre: string, hectareas: number): Tabla => ({
  id,
  ranchoId,
  nombre,
  hectareas,
});

export const TABLAS_INICIALES: Tabla[] = [
  T("smonica", "sm-1", "Tabla 1", 4),
  T("smonica", "sm-2", "Tabla 2", 4),
  T("smonica", "sm-6", "Tabla 6", 6.5),
  T("smonica", "sm-7", "Tabla 7", 6.5),
  T("smonica", "sm-9-10", "Tabla 9-10", 9),
  T("smonica", "sm-11", "Tabla 11", 4),
  T("smonica", "sm-12", "Tabla 12", 4),
  T("dolores", "do-1", "Tabla 1", 3.2),
  T("dolores", "do-2", "Tabla 2", 4),
  T("dolores", "do-3", "Tabla 3", 5.5),
  T("dolores", "do-4", "Tabla 4", 6.3),
  T("dolores", "do-5-6", "Tabla 5-6", 6.3),
  T("dolores", "do-7", "Tabla 7", 2.6),
  T("dolores", "do-9-10-11", "Tabla 9-10-11", 7.5),
  T("dolores", "do-12-13", "Tabla 12-13", 3.8),
  T("dolores", "do-14-16", "Tabla 14-16", 4.3),
  T("dolores", "do-15", "Tabla 15", 2.5),
  T("dolores", "do-17", "Tabla 17", 1.6),
  T("dolores", "do-18", "Tabla 18", 5.2),
  T("trejo", "tr-r1", "Ríos 1", 12.5),
  T("trejo", "tr-r2", "Ríos 2", 7.4),
  T("trejo", "tr-r3", "Ríos 3", 9),
  T("trejo", "tr-r4", "Ríos 4", 6.2),
  T("trejo", "tr-t3", "Torres 3", 7),
  T("trejo", "tr-t4", "Torres 4", 6.5),
  T("trejo", "tr-t5", "Torres 5", 6),
  T("trejo", "tr-t6", "Torres 6", 7),
  T("trejo", "tr-t7", "Torres 7", 6.5),
  T("trejo", "tr-pa", "Por asignar", 6),
];

/* ── Plantaciones de las hojas BROCOLI y COLIFLOR ── */

/** [tablaId, ha, variedad, fecha de plantación, fecha estimada de cosecha] */
const PLANTACIONES: [string, number, string, string, string][] = [
  // Brócoli
  ["sm-7", 6.5, "tlaloc", "20/06/26", "15/09/26"],
  ["sm-1", 4, "tlaloc", "27/06/26", "15/09/26"],
  ["tr-r3", 4.5, "tlaloc", "15/07/26", "29/09/26"],
  ["tr-r3", 4.5, "tlaloc", "23/07/26", "29/09/26"],
  ["do-9-10-11", 7.5, "tlaloc", "31/07/26", "26/10/26"],
  ["tr-r2", 3.7, "tlaloc", "04/08/26", "21/10/26"],
  ["tr-r2", 2.7, "tlaloc", "04/08/26", "21/10/26"],
  ["tr-r4", 3.8, "tlaloc", "13/08/26", "30/10/26"],
  ["do-15", 2.5, "diamante", "14/08/26", "31/10/26"],
  ["tr-r2", 1, "tlaloc", "14/08/26", "31/10/26"],
  ["do-7", 2.6, "diamante", "19/08/26", "09/11/26"],
  ["tr-r4", 2.4, "tlaloc", "25/08/26", "11/11/26"],
  ["do-1", 3.2, "diamante", "31/08/26", "21/11/26"],
  ["do-2", 4, "diamante", "06/09/26", "27/11/26"],
  ["do-3", 5.5, "diamante", "12/09/26", "03/12/26"],
  ["do-4", 6.3, "diamante", "25/09/26", "16/12/26"],
  ["do-5-6", 6.3, "diamante", "01/10/26", "22/12/26"],
  ["do-12-13", 3.8, "diamante", "09/10/26", "30/12/26"],
  // Coliflor
  ["sm-9-10", 4, "altamira", "20/08/26", "23/11/26"],
  ["tr-t4", 6.5, "altamira", "25/08/26", "28/11/26"],
  ["sm-9-10", 5, "altamira", "26/08/26", "29/11/26"],
  ["sm-11", 4, "altamira", "03/09/26", "07/12/26"],
  ["tr-t3", 7, "altamira", "04/09/26", "08/12/26"],
  ["tr-r1", 6, "altamira", "10/09/26", "14/12/26"],
  ["tr-r1", 6.5, "altamira", "20/09/26", "24/12/26"],
  ["sm-2", 4, "altamira", "21/09/26", "25/12/26"],
  ["tr-t5", 6, "altamira", "02/10/26", "05/01/27"],
  ["sm-7", 6.5, "altamira", "12/10/26", "15/01/27"],
  ["sm-1", 4, "altamira", "15/10/26", "18/01/27"],
  ["tr-t6", 7, "altamira", "17/10/26", "20/01/27"],
  ["sm-6", 6.5, "altamira", "27/10/26", "30/01/27"],
  ["tr-t7", 6.5, "altamira", "29/10/26", "31/01/27"],
  ["sm-12", 4, "altamira", "29/10/26", "01/02/27"],
];

let n = 0;
const sid = (p: string) => `${p}-s${++n}`;

const lotes: Lote[] = [];
const pedidos: PedidoPlaneacion[] = [];

for (const [tablaId, ha, variedadId, fp, fc] of [...PLANTACIONES].sort(
  (a, b) => fechaDeHoja(a[3]).localeCompare(fechaDeHoja(b[3])),
)) {
  const t = TABLAS_INICIALES.find((x) => x.id === tablaId)!;
  const v = VARIEDADES.find((x) => x.id === variedadId)!;
  const fecha = fechaDeHoja(fp);
  const semana = semanaDeFecha(fecha);
  const previos = lotes.filter((l) => l.tablaId === tablaId).length;
  const loteId = sid("lt");
  const lineas = lineasPlaneacion(RECETAS_INICIALES[v.cultivo], ADICIONALES_INICIALES, tablaId, ha);
  const pedido: PedidoPlaneacion | null =
    lineas.length > 0
      ? {
          id: sid("pp"),
          loteId,
          tablaId,
          ranchoId: t.ranchoId,
          semanaPlantacion: semana,
          ha,
          lineas,
          fecha: fechaEnSemana(semana - 3, 1),
          ingeniero: "Israel",
          urgente: false,
          status: "entregado",
          fechaEntrega: fechaEnSemana(semana - 2, 2),
        }
      : null;
  if (pedido) pedidos.push(pedido);
  lotes.push({
    id: loteId,
    codigo: `${t.nombre.replace(/^Tabla\s*/i, "")}-${String.fromCharCode(65 + previos)}`,
    tablaId,
    ranchoId: t.ranchoId,
    ha,
    semanaPlaneada: semana,
    ingeniero: "Israel",
    avances: [{ id: sid("av"), fecha, semana, ha }],
    insumos: pedido ? pedido.lineas.map((x) => ({ ...x, pedidoId: pedido.id })) : [],
    receta: recetaEfectiva(RECETAS_INICIALES[v.cultivo], ADICIONALES_INICIALES, tablaId),
    variedadId,
    cultivo: v.cultivo,
    cicloDias: v.cicloDias,
    fechaCosecha: fechaDeHoja(fc),
  });
}

export const LOTES_INICIALES: Lote[] = finalizarCosechados(lotes, SEMANA_INICIAL);
export const PEDIDOS_INICIALES: PedidoPlaneacion[] = pedidos;
export const ALERTAS_INICIALES: AlertaInsumos[] = [];
export const TARDIAS_INICIALES: PlaneacionTardia[] = [];
