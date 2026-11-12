import { describe, expect, it } from "vitest";
import { PERMISOS_COSECHA, puedeCapturar, puedeVer, tiene } from "@/lib/campo/roles";

describe("Ingeniero de campo · viajes e históricos", () => {
  it("puede registrar salidas de campo", () => {
    expect(tiene(["ingeniero"], ...PERMISOS_COSECHA.viajes)).toBe(true);
  });
  it("puede consultar Cosecha e históricos de viajes y rendimiento", () => {
    expect(puedeVer(["ingeniero"], "/cosecha")).toBe(true);
    expect(puedeVer(["ingeniero"], "/rendimiento")).toBe(true);
  });
  it("no puede evaluar ni acceder a liquidaciones o cierres administrativos", () => {
    expect(tiene(["ingeniero"], ...PERMISOS_COSECHA.evaluaciones)).toBe(false);
    expect(puedeVer(["ingeniero"], "/liquidacion")).toBe(false);
    expect(puedeVer(["ingeniero"], "/historicos")).toBe(true);
    expect(puedeCapturar(["ingeniero"], "/historicos")).toBe(false);
  });
  it("Compras no registra viajes", () => {
    expect(tiene(["compras"], ...PERMISOS_COSECHA.viajes)).toBe(false);
  });
});