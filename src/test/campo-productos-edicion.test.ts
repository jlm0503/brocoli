import { describe, expect, it } from "vitest";
import { editarClasificacionProducto } from "@/lib/campo/calc";
import type { Producto } from "@/lib/campo/types";

const producto: Producto = { id: "p1", codigo: "P1", nombre: "Producto", familia: "Insumo", unidad: "L", precio: 250, precios: [{ desde: "2026-11-09", precio: 300 }] };

describe("Edición de clasificación de productos", () => {
  it("permite corregir la unidad a kg conservando precios e identidad", () => {
    expect(editarClasificacionProducto(producto, { familia: producto.familia, unidad: "kg" })).toEqual({ ...producto, unidad: "kg" });
    expect(producto.unidad).toBe("L");
  });
  it("permite corregir la familia sin cambiar la unidad ni el historial de precios", () => {
    expect(editarClasificacionProducto(producto, { familia: "Insecticida", unidad: producto.unidad })).toEqual({ ...producto, familia: "Insecticida" });
    expect(producto.familia).toBe("Insumo");
  });
});