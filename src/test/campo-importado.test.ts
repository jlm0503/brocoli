import { describe, expect, it } from "vitest";
import { completarImportado } from "@/lib/campo/calc";
import type { CicloCerrado } from "@/lib/campo/types";

const c = { ha: 5.6, insumos: 361785.14, meta: 16000,
  importacion: { archivo: "historio_Brocoli_cerrado.xlsx", folios: ["PC-ALD-042026-054", "PC-SMO-062026-001"], variedad: "S DIAMANTE", fechaInicioCosecha: "2026-06-16", pendiente: true, productos: [], gastos: [] }
} as unknown as CicloCerrado;
const d = { kgBrutos: 100000, kgPagables: 90000, ingreso: 945000, planta: 0, fechaFinCosecha: "", gastos: [{ concepto: "nomina" as const, fecha: "2026-04-01", monto: 60000 }], cerrar: false };
describe("historial importado", () => {
  it("suma 8A y 8B sin dividir o duplicar los consumos originales", () => {
    const r = completarImportado(c, d);
    if ("error" in r) throw new Error(r.error);
    expect(r.ciclo.ha).toBe(2.8 + 2.8);
    expect(r.ciclo.insumos).toBeCloseTo(225718.97 + 136066.17);
    expect(r.ciclo.utilidadReal).toBeCloseTo(945000 - 361785.14 - 60000);
    expect(r.ciclo.planta).toBe(0);
  });
  it("conserva el inicio y no inventa fin de cosecha al guardar avances", () => {
    const r = completarImportado(c, d);
    if ("error" in r) throw new Error(r.error);
    expect(r.ciclo.fechaFinCosecha).toBe("");
    expect(r.ciclo.importacion?.fechaInicioCosecha).toBe("2026-06-16");
    expect(r.ciclo.importacion?.pendiente).toBe(true);
  });
  it("no cierra antes del inicio de cosecha", () => {
    expect(completarImportado(c, { ...d, cerrar: true, fechaFinCosecha: "2026-06-15" })).toHaveProperty("error");
  });
  it("congela el histórico al terminar la captura", () => {
    const r = completarImportado(c, { ...d, cerrar: true, fechaFinCosecha: "2026-06-29" });
    if ("error" in r) throw new Error(r.error);
    expect(r.ciclo.importacion?.pendiente).toBe(false);
    expect(completarImportado(r.ciclo, d)).toHaveProperty("error");
  });
});