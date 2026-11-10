import { describe, expect, it } from "vitest";
import { retirarTabla, tablaDisponible, validarApartado, validarPlantacionPrevia } from "@/lib/campo/calc";
import type { Tabla } from "@/lib/campo/types";

const tabla: Tabla = { id: "agrupada", ranchoId: "dolores", nombre: "9, 10, 11", hectareas: 7.5 };
describe("Retirar tablas sin perder históricos", () => {
  it("conserva identidad, nombre y hectáreas y deja de estar disponible", () => {
    const resultado = retirarTabla(tabla, []);
    expect(resultado).toEqual({ tabla: { ...tabla, archivada: true } });
    if ("error" in resultado) throw new Error(resultado.error);
    expect(tablaDisponible(resultado.tabla)).toBe(false);
    expect(tablaDisponible(tabla)).toBe(true);
  });
  it("no permite retirar una tabla con plantación vigente", () => {
    expect(retirarTabla(tabla, [{ tablaId: "agrupada" }])).toHaveProperty("error");
  });
  it("conserva los registros de lotes anteriores al retirar", () => {
    const lotes = [{ tablaId: "agrupada", cerrado: true }, { tablaId: "agrupada", finalizado: true, cerrado: true }];
    const originales = structuredClone(lotes);
    expect(retirarTabla(tabla, lotes)).toHaveProperty("tabla.archivada", true);
    expect(lotes).toEqual(originales);
  });
  it("impide nuevas planeaciones en tablas retiradas", () => {
    expect(validarApartado({ ...tabla, archivada: true }, [], 45, 2, 45)).not.toBeNull();
    expect(validarApartado(tabla, [], 45, 2, 45)).toBeNull();
  });
  it("impide registrar plantaciones en tablas retiradas", () => {
    expect(validarPlantacionPrevia({ ...tabla, archivada: true }, [], 2, "2026-11-01", "2026-11-08")).not.toBeNull();
    expect(validarPlantacionPrevia(tabla, [], 2, "2026-11-01", "2026-11-08")).toBeNull();
  });
});