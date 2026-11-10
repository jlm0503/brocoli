import { describe, expect, it } from "vitest";
import { estadoResultados, fechaPlantacionLote, perteneceCicloPlantacion, rangoFechasResultados } from "@/lib/campo/calc";
import type { Lote, GastoRancho } from "@/lib/campo/types";

const base: Lote = { id: "a", codigo: "a", tablaId: "t1", ranchoId: "trejo", ha: 4, semanaPlaneada: 27, ingeniero: "Jaime", cultivo: "brocoli", variedadId: "v", cicloDias: 84, avances: [{ id: "a1", fecha: "2026-07-01", semana: 27, ha: 4 }], insumos: [] };
const lotes = [base, { ...base, id: "b", tablaId: "t2", ha: 6, avances: [{ id: "b1", fecha: "2026-07-01", semana: 27, ha: 6 }] }, { ...base, id: "pasado", tablaId: "t3", semanaPlaneada: 20, avances: [{ id: "c1", fecha: "2026-05-11", semana: 20, ha: 4 }], cosechaTerminada: "2026-06-01" }];
const gasto: GastoRancho = { id: "g", ranchoId: "trejo", cultivo: "brocoli", semana: 28, concepto: "nomina", monto: 10000, modo: "directo", por: "u", fecha: "2026-07-06" };
const ctx = { desde: 1, hasta: 46, lotes, viajes: [], parametros: [], gastos: [gasto], repartos: [], costoLote: () => 1000, plantaLote: () => 0 };
describe("Filtros del estado de resultados", () => {
  it("sin fechas incluye todo el periodo registrado, no solo las últimas semanas", () => {
    const rango = rangoFechasResultados("", "", [-2, 20, 27, 60]);
    expect(rango).toEqual({ desde: -2, hasta: 60 });
    expect(estadoResultados({ ...ctx, ...rango }).totales.lotes).toBe(3);
  });
  it("permite solo fecha inicial o solo fecha final", () => {
    expect(rangoFechasResultados("2026-07-01", "", [20, 60])).toEqual({ desde: 27, hasta: 60 });
    expect(rangoFechasResultados("", "2026-06-15", [20, 60])).toEqual({ desde: 1, hasta: 25 });
  });
  it("las fechas conservan el cálculo por semanas de los gastos", () => {
    const rango = rangoFechasResultados("2026-07-06", "2026-07-12", [20, 60]);
    expect(rango).toEqual({ desde: 28, hasta: 28 });
    expect(estadoResultados({ ...ctx, ...rango }).totales.gastosComunes).toBe(10000);
  });
  it("seleccionar una tabla conserva su reparto original, no le carga todo el rancho", () => {
    const r = estadoResultados({ ...ctx, pasa: (l) => l.tablaId === "t1" });
    expect(r.totales.ha).toBe(4);
    expect(r.totales.gastosComunes).toBe(4000);
  });
  it("seleccionar varias tablas suma únicamente esas plantaciones del segundo ciclo", () => {
    const r = estadoResultados({ ...ctx, pasa: (l) => ["t1", "t2"].includes(l.tablaId) && perteneceCicloPlantacion(fechaPlantacionLote(l), "2026-2") });
    expect(r.totales.lotes).toBe(2);
    expect(r.totales.ha).toBe(10);
    expect(r.totales.gastosComunes).toBe(10000);
  });
  it("combina rancho, cultivo y primer ciclo por fecha de plantación", () => {
    const r = estadoResultados({ ...ctx, pasa: (l) => l.ranchoId === "trejo" && l.cultivo === "brocoli" && perteneceCicloPlantacion(fechaPlantacionLote(l), "2026-1") });
    expect(r.totales.lotes).toBe(1);
    expect(r.totales.ha).toBe(4);
  });
  it("gastos sin tabla asignada no aparecen como propios de una selección de tablas o ciclo", () => {
    const r = estadoResultados({ ...ctx, gastos: [gasto, { ...gasto, id: "sin", ranchoId: "otro", monto: 3000 }], pasa: (l) => l.tablaId === "t1", pasaNoAsignado: () => false });
    expect(r.filas.map((f) => f.ranchoId)).toEqual(["trejo"]);
    expect(r.totales.noAsignado).toBe(0);
    expect(estadoResultados({ ...ctx, gastos: [{ ...gasto, ranchoId: "otro", monto: 3000 }] }).totales.noAsignado).toBe(3000);
  });
});