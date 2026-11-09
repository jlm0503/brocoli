import { describe, expect, it } from "vitest";
import { recetaDe, lineasLote, lineasPlaneacion, cintaPlaneacion } from "@/lib/campo/calc";
import type { Lote, Recetas, Producto } from "@/lib/campo/types";

const recetas: Recetas = { coliflor: { dosis: {}, variantes: [
  { id: "lamas", nombre: "Lamas y Torres", ranchoId: "trejo", tablaIds: ["lamas1", "torres1"], desde: "2026-11-09", dosis: { 1: { fosfo: 150 }, 4: { fosfo: 200 } } },
  { id: "resto", nombre: "Resto", ranchoId: "trejo", tablaIds: ["rios1"], desde: "2026-11-09", dosis: { 1: { fosfo: 100 }, 4: { fosfo: 150 } } },
] } };
const lote: Lote = { id: "l1", codigo: "Lamas 1", tablaId: "lamas1", ranchoId: "trejo", ha: 6, avances: [{ id: "a", fecha: "2026-11-09", semana: 46, ha: 0.5 }], semanaPlaneada: 46, ingeniero: "", insumos: [], cultivo: "coliflor", variedadId: "altamira", cicloDias: 95 };
describe("Paquetes por tabla", () => {
  it("usa el aumento de fosfonitrato solo para Lamas y Torres", () => {
    expect(recetaDe(recetas, "coliflor", "lamas1", "trejo").dosis[1]?.['fosfo']).toBe(150);
    expect(recetaDe(recetas, "coliflor", "torres1", "trejo").dosis[4]?.['fosfo']).toBe(200);
    expect(recetaDe(recetas, "coliflor", "rios1", "trejo").dosis[1]?.['fosfo']).toBe(100);
    expect(recetaDe(recetas, "coliflor", "rios1", "trejo").dosis[4]?.['fosfo']).toBe(150);
  });
  it("no asigna el paquete de Trejo a otro rancho o antes de su vigencia", () => {
    expect(recetaDe(recetas, "coliflor", "lamas1", "otro").dosis).toEqual({});
    expect(recetaDe(recetas, "coliflor", "lamas1", "trejo", "2026-11-08").dosis).toEqual({});
  });
  it("calcula solo las hectáreas plantadas, no las seis planeadas", () => {
    expect(lineasLote(lote, recetas, [], 47)[0]?.cantidad).toBe(75);
  });
  it("conserva semanas anteriores y comienza el paquete nuevo en semana 46", () => {
    const anterior = { ...lote, avances: [{ id: "a", fecha: "2026-11-02", semana: 45, ha: 0.5 }], receta: { 0: { fosfo: 100 }, 1: { fosfo: 150 } }, recetaDesde: "2026-11-09" };
    expect(lineasLote(anterior, recetas, [], 45)).toEqual([]);
    expect(lineasLote(anterior, recetas, [], 46)[0]?.cantidad).toBe(75);
  });
  it("la cinta de coliflor se pide a 1.5 rollos por hectárea", () => {
    const productos: Producto[] = [{ id: "cinta", codigo: "C", nombre: "Cinta", familia: "Riego", unidad: "rollo", precio: 0 }];
    expect(lineasPlaneacion({ dosis: {} }, [], "lamas1", 6, cintaPlaneacion(productos, 1.5))[0]?.cantidad).toBe(9);
  });
});