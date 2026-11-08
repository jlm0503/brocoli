import { describe, expect, it } from "vitest";
import { plantacionPanel, totalesPanel } from "@/lib/campo/calc";
import { puedeVer } from "@/lib/campo/roles";
import type { Lote } from "@/lib/campo/types";
const lote: Lote = { id: "l", codigo: "L", tablaId: "t", ranchoId: "r", ha: 5, semanaPlaneada: 46, ingeniero: "", avances: [{ id: "a", semana: 45, fecha: "2026-11-02", ha: 2 }], insumos: [], variedadId: "v", cultivo: "brocoli", cicloDias: 84 };
describe("Panel de Dirección", () => {
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