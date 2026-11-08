import { describe, expect, it } from "vitest";
import { perteneceCicloPlantacion } from "@/lib/campo/calc";

describe("Ciclos de plantación 2026", () => {
  it("todos los ciclos conserva también plantaciones entre el 16 y el 30 de junio", () => {
    expect(perteneceCicloPlantacion("2026-06-16", "todos")).toBe(true);
    expect(perteneceCicloPlantacion("2026-06-30", "todos")).toBe(true);
  });
  it("primer ciclo incluye del 1 enero al 15 junio 2026", () => {
    expect(perteneceCicloPlantacion("2026-01-01", "2026-1")).toBe(true);
    expect(perteneceCicloPlantacion("2026-06-15", "2026-1")).toBe(true);
    expect(perteneceCicloPlantacion("2026-06-16", "2026-1")).toBe(false);
    expect(perteneceCicloPlantacion("2026-06-30", "2026-1")).toBe(false);
    expect(perteneceCicloPlantacion("2025-12-31", "2026-1")).toBe(false);
    expect(perteneceCicloPlantacion("2026-07-01", "2026-1")).toBe(false);
  });
  it("segundo ciclo incluye del 1 julio al 31 diciembre 2026", () => {
    expect(perteneceCicloPlantacion("2026-07-01", "2026-2")).toBe(true);
    expect(perteneceCicloPlantacion("2026-12-31", "2026-2")).toBe(true);
    expect(perteneceCicloPlantacion("2026-06-30", "2026-2")).toBe(false);
    expect(perteneceCicloPlantacion("2027-01-01", "2026-2")).toBe(false);
  });
  it("plantaciones posteriores al 15 junio quedan fuera del primero independientemente de su cosecha", () => {
    expect(perteneceCicloPlantacion("2026-06-20", "2026-1")).toBe(false);
    expect(perteneceCicloPlantacion("2026-06-27", "2026-2")).toBe(false);
  });
});