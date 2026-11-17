import { describe, expect, it } from "vitest";
import { agregarPagoLiquidacion, cobrosLiquidacion, estatusLiquidacion, resumenSemanaPago } from "@/lib/campo/calc";
import type { Liquidacion, Viaje } from "@/lib/campo/types";

const viajes: Viaje[] = [1, 2, 3].map((n) => ({
  id: `v${n}`, folio: `B${n}`, fecha: "2026-11-12", hora: "12:00", loteIds: ["l1"], choferId: "c1", congeladoraId: "f1", foto: "f.jpg", por: "J", status: "evaluado",
  evaluacion: { fecha: "2026-11-12", por: "J", kgBrutos: 1000, kgPagables: 900, calificacion: 8, problemas: [], reporte: "r.jpg", reparto: [], merma: 100, importeBruto: 1200, descuento: 200, importeNeto: 1000 },
}));
const r = resumenSemanaPago(viajes, "2026-11-12");
const datos = { id: "p1", fecha: "2026-11-17", comprobante: "p.pdf", por: "J", viajes: [{ viajeId: "v1", monto: 1000 }] };
function pago(d = datos, anterior?: Liquidacion) {
  const result = agregarPagoLiquidacion(r, anterior, d);
  if (typeof result === "string") throw new Error(result);
  return result;
}
describe("Liquidaciones con viajes y abonos", () => {
  it("pagar un viaje deja los otros dos pendientes de esa semana", () => {
    const l = pago();
    expect(l.pagado).toBe(1000);
    expect(cobrosLiquidacion(r, l).porViaje.map((v) => v.pendiente)).toEqual([0, 1000, 1000]);
    expect(estatusLiquidacion(r, l, "2026-11-17")).toBe("parcial");
  });
  it("acumula pagos parciales del mismo viaje sin reemplazar el anterior", () => {
    const l = pago({ ...datos, viajes: [{ viajeId: "v1", monto: 400 }] });
    const l2 = pago({ ...datos, id: "p2", viajes: [{ viajeId: "v1", monto: 600 }] }, l);
    expect(l2.pagado).toBe(1000);
    expect(l2.pagos).toHaveLength(2);
    expect(cobrosLiquidacion(r, l2).porViaje[0]?.pendiente).toBe(0);
    expect(l.pagado).toBe(400);
  });
  it("permite seleccionar varios viajes y cierra solo al pagar todos", () => {
    const l = pago({ ...datos, viajes: viajes.map((v) => ({ viajeId: v.id, monto: 1000 })) });
    expect(l.pagado).toBe(3000);
    expect(estatusLiquidacion(r, l, "2026-11-17")).toBe("pagada");
  });
  it("no duplica pagos ni admite viajes de otra semana o montos inválidos", () => {
    expect(agregarPagoLiquidacion(r, pago(), datos)).toBe("El pago supera el saldo pendiente de un viaje.");
    for (const monto of [0, -1, Infinity, NaN]) expect(typeof agregarPagoLiquidacion(r, undefined, { ...datos, viajes: [{ viajeId: "v1", monto }] })).toBe("string");
    expect(typeof agregarPagoLiquidacion(r, undefined, { ...datos, viajes: [{ viajeId: "otro", monto: 100 }] })).toBe("string");
  });
  it("conserva pagos antiguos sin inventar viajes pagados y desglosa sin duplicar", () => {
    const anterior = { id: r.jueves, pagado: 1000, fecha: "2026-11-16", comprobante: "original.pdf", por: "J" };
    expect(cobrosLiquidacion(r, anterior).sinAsignar).toBe(1000);
    const l = agregarPagoLiquidacion(r, anterior, { ...datos, desglosarAnterior: true });
    if (typeof l === "string") throw new Error(l);
    expect(l.pagado).toBe(1000);
    expect(l.comprobante).toBe("original.pdf");
    expect(cobrosLiquidacion(r, l).sinAsignar).toBe(0);
    expect(cobrosLiquidacion(r, l).porViaje[0]?.pagado).toBe(1000);
    expect(pago({ ...datos, id: "p2", viajes: [{ viajeId: "v2", monto: 500 }] }, anterior).pagado).toBe(1500);
  });
});