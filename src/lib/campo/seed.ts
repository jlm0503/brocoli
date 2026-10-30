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
 * Punto de partida: solo productos, variedades y paquete tecnológico (hoja "Paquete Tecnologico"
 * del usuario). Ranchos, tablas y plantaciones los captura el usuario en la app.
 * Los códigos de producto y la familia de cada producto son provisionales.
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

export const RANCHOS_INICIALES: Rancho[] = [];
export const TABLAS_INICIALES: Tabla[] = [];
export const LOTES_INICIALES: Lote[] = [];
export const PEDIDOS_INICIALES: PedidoPlaneacion[] = [];
export const ALERTAS_INICIALES: AlertaInsumos[] = [];
export const TARDIAS_INICIALES: PlaneacionTardia[] = [];
