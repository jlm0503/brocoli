import { describe, expect, it } from "vitest";
import { cosechaPanel, superficiePanel, plantacionPanel, totalesPanel } from "@/lib/campo/calc";
import { puedeVer } from "@/lib/campo/roles";
import type { CicloCerrado, Lote, Viaje } from "@/lib/campo/types";
const lote: Lote = { id: "l", codigo: "L", tablaId: "t", ranchoId: "r", ha: 5, semanaPlaneada: 46, ingeniero: "", avances: [{ id: "a", semana: 45, fecha: "2026-11-02", ha: 2 }], insumos: [], variedadId: "v", cultivo: "brocoli", cicloDias: 84 };
describe("Panel de Dirección", () => {
  it("separa 123 hectáreas activas de futuras y cosechas vencidas", () => {
    const activo = { ...lote, ha: 123, avances: [{ id: "a", semana: 40, fecha: "2026-09-28", ha: 123 }], fechaCosecha: "2026-12-01" };
    const vencido = { ...lote, id: "viejo", ha: 13.8, avances: [{ id: "b", semana: 32, fecha: "2026-08-03", ha: 13.8 }], fechaCosecha: "2026-10-31" };
    expect(superficiePanel([activo, vencido, { ...lote, avances: [], ha: 48.71 }, { ...activo, finalizado: true }, { ...activo, cancelado: true }], 45)).toEqual({ activas: 123, plantadas: 136.8, porPlantar: 48.71, fueraCiclo: 13.8 });
  });
  it("proyecta la semana próxima sin presentarla como kilos reales", () => {
    const l = { ...lote, ha: 2, fechaCosecha: "2026-11-09" };
    const r = cosechaPanel([l], [], [], [], 46, "2026-11-08");
    expect(r.kgEsperados).toBe(16000);
    expect(r.pagoEsperado).toBe(168000);
    expect(r.kgHaEsperados).toBe(8000);
    expect(r.kgBrutos).toBe(0);
  });
  it("usa kilos y pago congelados y cuenta una sola vez las hectáreas del lote", () => {
    const v: Viaje = { id: "v", folio: "V", fecha: "2026-11-02", hora: "10:00", loteIds: [lote.id], choferId: "", congeladoraId: "", foto: "", por: "", status: "evaluado", evaluacion: { fecha: "2026-11-03", por: "", kgBrutos: 12000, kgPagables: 10000, calificacion: 10, problemas: [], reporte: "", reparto: [{ loteId: lote.id, tablaId: "t", ranchoId: "r", pct: 100, kgBrutos: 12000, kgPagables: 10000, precio: 9, importe: 90000 }], merma: 0, importeBruto: 90000, descuento: 10000, importeNeto: 80000 } };
    const r = cosechaPanel([lote], [v, { ...v, id: "v2" }], [], [{ id: "p", clave: "precioKg", desde: "2026-01-01", valor: 99 }], 45, "2026-11-08");
    expect(r.kgBrutos).toBe(24000);
    expect(r.pago).toBe(160000);
    expect(r.ha).toBe(2);
    expect(r.kgHa).toBe(10000);
  });
  it("incluye viajes históricos fechados sin inventar precios faltantes", () => {
    const c = { id: "hist", tipo: "historico", ha: 4, viajesHistoricos: [{ fecha: "2026-10-30", folio: "H", kgBrutos: 5000, kgPagables: 4000 }] } as CicloCerrado;
    const r = cosechaPanel([], [], [c], [], 44, "2026-11-08");
    expect(r.kgBrutos).toBe(5000);
    expect(r.kgHa).toBe(1000);
    expect(r.pago).toBeNull();
  });
  it("cuenta ha realmente plantadas y solo ha pendientes", () => {
    expect(plantacionPanel([lote], 45)).toEqual({ plantadas: 2, planeadas: 0 });
    expect(plantacionPanel([lote], 46)).toEqual({ plantadas: 0, planeadas: 3 });
  });
  it("no incluye cancelados ni finalizados en futuras plantaciones", () => {
    expect(plantacionPanel([{ ...lote, cancelado: true }, { ...lote, finalizado: true }], 46).planeadas).toBe(0);
  });
  it("pondera kilos, gasto y nómina por hectáreas", () => {
    const r = totalesPanel([{ ha: 2, kgBrutos: 25000, kgPagables: 20000, costo: 20000, nomina: 4000 }, { ha: 8, kgBrutos: 170000, kgPagables: 160000, costo: 160000, nomina: 16000 }]);
    expect(r.kgHa).toBe(18000);
    expect(r.costoHa).toBe(18000);
    expect(r.nominaHa).toBe(2000);
  });
  it("Dirección consulta el panel pero no resultados ni captura gastos", () => {
    expect(puedeVer(["direccion"], "/panel")).toBe(true);
    expect(puedeVer(["direccion"], "/resultados")).toBe(false);
    expect(puedeVer(["direccion"], "/gastos")).toBe(false);
  });
});