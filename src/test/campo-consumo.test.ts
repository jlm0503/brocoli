import { describe, expect, it } from "vitest";
import { consumoProductosLote } from "@/lib/campo/calc";
import type { Lote } from "@/lib/campo/types";

const lote = { id: "L1", ha: 4, insumos: [{ pedidoId: "P1", productoId: "cinta", cantidad: 8 }] } as unknown as Lote;

describe("consumo real de una tabla cerrada", () => {
  it("resta lo devuelto a lo recibido de cada producto", () => {
    const r = consumoProductosLote(lote, {
      lineas: [
        { key: "a", loteId: "L1", tablaId: "T", ranchoId: "R", productoId: "urea", semana: 40, semanaReceta: 1, cantidad: 100 },
        { key: "b", loteId: "L1", tablaId: "T", ranchoId: "R", productoId: "urea", semana: 41, semanaReceta: 2, cantidad: 50 },
      ],
      recepciones: {},
      pedidos: [{ id: "P1", status: "entregado" }] as never,
      extraordinarios: [],
      devoluciones: [{ loteId: "L1", productoId: "urea", cantidad: 30 }] as never,
    });
    const urea = r.find((x) => x.productoId === "urea")!;
    expect(urea.neto).toBe(120);
    expect(urea.porHa).toBe(30);
    expect(r.find((x) => x.productoId === "cinta")!.neto).toBe(8);
  });
});
