import { describe, expect, it } from "vitest";

import { checklistCierre, cicloHistorico, leerViajesCsv, totalesCiclos, variacionPct } from "@/lib/campo/calc";
import type { CicloCerrado, Lote, Parametro, Viaje } from "@/lib/campo/types";

const lote: Lote = {
  id: "l1",
  codigo: "1-A",
  tablaId: "t1",
  ranchoId: "r",
  ha: 5,
  semanaPlaneada: 33,
  ingeniero: "Israel",
  avances: [{ id: "a", fecha: "2026-08-10", semana: 33, ha: 5 }],
  insumos: [],
  variedadId: "tlaloc",
  cultivo: "brocoli",
  cicloDias: 84,
};

const params: Parametro[] = [
  { id: "p", clave: "precioKg", valor: 10, desde: "2020-01-01" },
  { id: "c", clave: "costoPlantaHa", valor: 16200, desde: "2020-01-01" },
  { id: "m", clave: "metaKgHa", valor: 16000, desde: "2020-01-01" },
];

describe("Fase 5 · cierre de ciclo", () => {
  it("no se puede cerrar sin cosecha terminada ni con viajes sin evaluar", () => {
    const viaje = { id: "v", folio: "1", fecha: "2026-11-02", hora: "", loteIds: ["l1"], choferId: "", congeladoraId: "", foto: "", por: "", status: "transito" } as Viaje;
    const c = checklistCierre(lote, { viajes: [viaje], liquidaciones: [], extraordinarios: [], alertasDireccion: [], hoy: "2026-11-05" });
    expect(c.find((x) => x.clave === "cosecha")!.ok).toBe(false);
    expect(c.find((x) => x.clave === "viajes")!.ok).toBe(false);
  });

  it("sin viajes y con cosecha terminada todo queda en verde", () => {
    const c = checklistCierre({ ...lote, cosechaTerminada: "2026-11-01" }, { viajes: [], liquidaciones: [], extraordinarios: [], alertasDireccion: [], hoy: "2026-11-05" });
    expect(c.every((x) => x.ok)).toBe(true);
  });
});

describe("Fase 5 · captura histórica", () => {
  const base = {
    ranchoId: "r", tablaId: "t1", cultivo: "brocoli", ingeniero: "Israel", ha: 10, plantas: 600000,
    fechaPlantacion: "2025-01-06", fechaFinCosecha: "2025-04-01", insumos: 100000,
    viajes: [{ fecha: "2025-03-20", folio: "A", kgBrutos: 90000, kgPagables: 80000 }],
  };

  it("calcula planta a 16,200/ha, ingreso a precio vigente y kg pagables/ha", () => {
    const r = cicloHistorico(base, { parametros: params, ciclos: [], lotes: [], id: "h1" });
    if ("error" in r) throw new Error(r.error);
    expect(r.ciclo.planta).toBe(162000);
    expect(r.ciclo.ingreso).toBe(800000);
    expect(r.ciclo.pagablesHa).toBe(8000);
    expect(r.ciclo.utilidadDirecta).toBe(800000 - 262000);
  });

  it("no deja que se enciman fechas en la misma tabla", () => {
    const r1 = cicloHistorico(base, { parametros: params, ciclos: [], lotes: [], id: "h1" });
    if ("error" in r1) throw new Error(r1.error);
    const previo = { ...r1.ciclo, bitacora: [] } as CicloCerrado;
    const r2 = cicloHistorico({ ...base, fechaPlantacion: "2025-03-01", fechaFinCosecha: "2025-06-01" }, { parametros: params, ciclos: [previo], lotes: [], id: "h2" });
    expect("error" in r2).toBe(true);
  });

  it("lee viajes desde CSV con la plantilla", () => {
    const r = leerViajesCsv("fecha,folio,chofer,kg_brutos,kg_pagables,calidad\n2025-03-10,F-1,,8200,7600,8\n");
    if ("error" in r) throw new Error(r.error);
    expect(r.viajes[0]).toMatchObject({ fecha: "2025-03-10", kgBrutos: 8200, kgPagables: 7600, calidad: 8 });
  });
});

describe("Fase 5 · históricos", () => {
  it("kg/ha es promedio ponderado por hectárea, no promedio simple", () => {
    const c = (ha: number, kg: number) => ({ ha, kgPagables: kg, kgBrutos: kg, meta: 16000, utilidadReal: 0, ingreso: 0, insumos: 0, planta: 0, gastosComunes: 0 }) as CicloCerrado;
    const t = totalesCiclos([c(10, 200000), c(2, 10000)]);
    expect(t.pagablesHa).toBe(17500); // 210,000 ÷ 12, no (20,000 + 5,000) ÷ 2
  });

  it("variación % entre ciclos", () => {
    expect(variacionPct(16000, 18000)).toBe(12.5);
  });
});

import { cosechaVencida } from "@/lib/campo/calc";
describe("Fase 5 · máximo 2 semanas de cosecha", () => {
  const l = { id: "x", avances: [{ id: "a", fecha: "2026-08-10", semana: 33, ha: 5 }], cicloDias: 84, semanaPlaneada: 33 } as unknown as Parameters<typeof cosechaVencida>[0];
  const v = (fecha: string) => ({ loteIds: ["x"], fecha }) as Viaje;
  it("a los 14 días del primer viaje la cosecha está vencida", () => {
    expect(cosechaVencida(l, [v("2026-11-01")], "2026-11-15")).toBe(true);
  });
  it("a los 13 días todavía no", () => {
    expect(cosechaVencida(l, [v("2026-11-01")], "2026-11-14")).toBe(false);
  });
});
