import { describe, expect, it } from "vitest";
import { lineasLote, recetaDe, recetaEfectiva } from "@/lib/campo/calc";
import type { Lote, Recetas } from "@/lib/campo/types";

const recetas: Recetas = {
  coliflor: { dosis: {}, variantes: [
    { id: "trejo-coliflor", nombre: "Trejo", ranchoId: "trejo", tablaIds: [], desde: "2026-11-10", dosis: { 1: { fosfo: 150 }, 4: { fosfo: 200 } } },
    { id: "otros-coliflor", nombre: "Otros", ranchoId: "", excluirRanchoIds: ["trejo"], tablaIds: [], desde: "2026-11-10", dosis: { 1: { fosfo: 70 } } },
  ] },
  brocoli: { dosis: {}, variantes: [
    { id: "otros-brocoli", nombre: "Otros", ranchoId: "", excluirRanchoIds: ["trejo"], tablaIds: [], desde: "2026-11-10", dosis: { 1: { fosfo: 70 } } },
  ] },
};

describe("Paquetes automáticos por rancho y cultivo", () => {
  it("todas las coliflores de Trejo usan 150 en semana 1 y 200 en semana 4, sin excepciones", () => {
    for (const tabla of ["lamas1", "torres1", "rios1"]) {
      expect(recetaDe(recetas, "coliflor", tabla, "trejo", "2026-11-10").dosis[1]?.["fosfo"]).toBe(150);
      expect(recetaDe(recetas, "coliflor", tabla, "trejo", "2026-11-10").dosis[4]?.["fosfo"]).toBe(200);
    }
  });
  it("Otros coliflor aplica a ranchos actuales y nuevos, nunca a Trejo", () => {
    for (const rancho of ["dolores", "santa-monica", "vergel", "nuevo"]) {
      expect(recetaDe(recetas, "coliflor", "tabla", rancho).dosis[1]?.["fosfo"]).toBe(70);
    }
    expect(recetaDe(recetas, "coliflor", "tabla", "trejo").dosis[1]?.["fosfo"]).toBe(150);
  });
  it("Otros brócoli excluye Trejo sin usar el paquete de coliflor", () => {
    expect(recetaDe(recetas, "brocoli", "tabla", "dolores").dosis[1]?.["fosfo"]).toBe(70);
    expect(recetaDe(recetas, "brocoli", "tabla", "trejo").dosis).toEqual({});
  });
  it("el reemplazo no demanda semanas anteriores ni altera la copia del brócoli Trejo", () => {
    const lote: Lote = { id: "l", codigo: "Rios", tablaId: "tabla", ranchoId: "trejo", cultivo: "brocoli", variedadId: "tlaloc", cicloDias: 90, ha: 4, semanaPlaneada: 45, ingeniero: "", insumos: [], avances: [{ id: "a", fecha: "2026-11-02", semana: 45, ha: 4 }], receta: { 1: { fosfo: 50 } } };
    expect(lineasLote(lote, recetas, [], 46)[0]?.cantidad).toBe(200);
    const nuevo = { ...lote, cultivo: "coliflor", receta: { 1: { fosfo: 150 } }, recetaDesde: "2026-11-10" };
    expect(lineasLote(nuevo, recetas, [], 45)).toEqual([]);
    expect(lineasLote(nuevo, recetas, [], 46)[0]?.cantidad).toBe(600);
  });
  it("preserva todas las semanas cargadas del archivo", () => {
    expect(recetaEfectiva({ dosis: { 13: { exalt: 0.25 } } }, [], "tabla")[13]?.["exalt"]).toBe(0.25);
  });
});