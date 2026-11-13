import { describe, expect, it } from "vitest";
import { quitarProductoPaquete } from "@/lib/campo/calc";
import { puedeOperacionCampo } from "@/lib/campo/roles";
import type { Recetas, Role } from "@/lib/campo/types";

describe("Productos de paquetes", () => {
  it("solo Super Admin agrega dosis y elimina productos del paquete", () => {
    expect(puedeOperacionCampo(["admin"], "setDosis")).toBe(true);
    expect(puedeOperacionCampo(["admin"], "eliminarProductoPaquete")).toBe(true);
    for (const role of ["administrador", "ingeniero", "encargado", "compras", "almacen", "direccion", "autorizador"] as Role[]) {
      expect(puedeOperacionCampo([role], "setDosis")).toBe(false);
      expect(puedeOperacionCampo([role], "eliminarProductoPaquete")).toBe(false);
    }
  });
  it("quita todas sus semanas solo del paquete elegido y no modifica el original", () => {
    const recetas: Recetas = { brocoli: { dosis: {} }, coliflor: { dosis: {}, variantes: [
      { id: "trejo", nombre: "Trejo", ranchoId: "trejo", tablaIds: [], desde: "2026-11-10", dosis: { 1: { fosfo: 150, otro: 2 }, 4: { fosfo: 200 } } },
      { id: "otros", nombre: "Otros", ranchoId: "", tablaIds: [], desde: "2026-11-10", dosis: { 1: { fosfo: 70 } } },
    ] } };
    const result = quitarProductoPaquete(recetas, "coliflor", "trejo", "fosfo");
    expect(result['coliflor']?.variantes?.[0]?.dosis).toEqual({ 1: { otro: 2 }, 4: {} });
    expect(result['coliflor']?.variantes?.[1]?.dosis[1]?.['fosfo']).toBe(70);
    expect(recetas['coliflor']?.variantes?.[0]?.dosis[1]?.['fosfo']).toBe(150);
    expect(result['brocoli']).toBe(recetas['brocoli']);
  });
});