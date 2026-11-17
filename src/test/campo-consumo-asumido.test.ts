import { describe, it, expect } from "vitest";
import { consumoAsumidoAplicaciones } from "@/lib/campo/calc";
import type { FuenteAplicacion } from "@/lib/campo/aplicaciones-types";

const f = (key: string, tablaId: string, ha: number, esperado: number, recibido: number): FuenteAplicacion =>
  ({ key, loteId: key, tablaId, ranchoId: "r1", productoId: "fosfo", semana: 46, tipo: "Receta", esperado, recibido, ha });

describe("consumo asumido en aplicaciones", () => {
  it("todo lo recibido y no devuelto se asume consumido, repartido proporcional entre tablas", () => {
    // 3 ha y 1 ha a 10 kg/ha → 30 y 10 programado; llegó todo junto a una tabla (40) y regresaron 8
    const r = consumoAsumidoAplicaciones([f("a", "t1", 3, 30, 40), f("b", "t2", 1, 10, 0)], [{ ranchoId: "r1", productoId: "fosfo", semana: 46, cantidad: 8 }]);
    expect(r.map(x => x.consumido)).toEqual([24, 8]);
    expect(r.map(x => x.devuelto)).toEqual([6, 2]);
  });
  it("sin devoluciones se consume todo lo recibido", () => {
    const r = consumoAsumidoAplicaciones([f("a", "t1", 2, 20, 20)], []);
    expect(r[0]!.consumido).toBe(20);
  });
});
