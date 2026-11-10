import { describe, expect, it } from "vitest";
import { filasSuperficieTablas, totalesSuperficieTablas } from "@/lib/campo/calc";
import type { Lote, Tabla } from "@/lib/campo/types";

const tabla: Tabla = { id: "t", ranchoId: "r", nombre: "1", hectareas: 20 };
const base: Lote = { id: "p", tablaId: "t", ranchoId: "r", codigo: "p", ha: 4, semanaPlaneada: 46, cultivo: "brocoli", variedadId: "v", cicloDias: 84, avances: [], insumos: [] };
const lotes: Lote[] = [base, { ...base, id: "plantado", ha: 6, semanaPlaneada: 44, avances: [{ id: "a", fecha: "2026-10-26", semana: 44, ha: 6 }] }, { ...base, id: "cosecha", ha: 8, semanaPlaneada: 27, avances: [{ id: "b", fecha: "2026-07-01", semana: 27, ha: 8 }] }];

describe("Totales de superficie por filtros de estatus", () => {
  const filas = filasSuperficieTablas([tabla], lotes, 46);
  it("todos incluye planeadas, plantadas, cosecha y el remanente libre sin duplicar tabla", () => {
    expect(totalesSuperficieTablas([tabla], filas, [])).toEqual({ total: 20, planeadas: 4, plantadas: 6, cosecha: 8, disponibles: 2, seleccion: 20 });
  });
  it("planeado y plantado suma solo esas hectáreas", () => {
    expect(totalesSuperficieTablas([tabla], filas, ["planeada", "plantada"]).seleccion).toBe(10);
  });
  it("plantado y cosecha suma solo esas hectáreas", () => {
    expect(totalesSuperficieTablas([tabla], filas, ["plantada", "en-cosecha"]).seleccion).toBe(14);
  });
  it("libre cuenta solo el remanente disponible de la tabla parcialmente ocupada", () => {
    expect(totalesSuperficieTablas([tabla], filas, ["libre"]).seleccion).toBe(2);
  });
  it("un lote sin cerrar no libera superficie aunque esté finalizado por calendario", () => {
    const filas = filasSuperficieTablas([tabla], [{ ...base, ha: 20, finalizado: true }], 46);
    expect(totalesSuperficieTablas([tabla], filas, []).disponibles).toBe(0);
  });
  it("los filtros de cultivo no convierten otros cultivos en disponibles y las tablas desactivadas no se cuentan", () => {
    const filas = filasSuperficieTablas([tabla], lotes, 46, () => false);
    expect(totalesSuperficieTablas([tabla, { ...tabla, id: "retirada", archivada: true }], filas, [])).toMatchObject({ total: 20, disponibles: 2, seleccion: 2 });
  });
});