import { describe, expect, it } from "vitest";
import { perteneceCicloPlantacion } from "@/lib/campo/calc";

describe("Ciclos de plantación 2026", () => {
  it("primer ciclo incluye del 1 enero al 30 junio 2026", () => {
    expect(perteneceCicloPlantacion("2026-01-01", "2026-1")).toBe(true);
    expect(perteneceCicloPlantacion("2026-06-30", "2026-1")).toBe(true);
    expect(perteneceCicloPlantacion("2025-12-31", "2026-1")).toBe(false);
    expect(perteneceCicloPlantacion("2026-07-01", "2026-1")).toBe(false);
  });
  it("segundo ciclo incluye del 1 julio al 31 diciembre 2026", () => {
    expect(perteneceCicloPlantacion("2026-07-01", "2026-2")).toBe(true);
    expect(perteneceCicloPlantacion("2026-12-31", "2026-2")).toBe(true);
    expect(perteneceCicloPlantacion("2026-06-30", "2026-2")).toBe(false);
    expect(perteneceCicloPlantacion("2027-01-01", "2026-2")).toBe(false);
  });
  it("Santa Mónica de junio pertenece al primero aunque se coseche en septiembre", () => {
    expect(perteneceCicloPlantacion("2026-06-20", "2026-1")).toBe(true);
    expect(perteneceCicloPlantacion("2026-06-27", "2026-2")).toBe(false);
  });
});