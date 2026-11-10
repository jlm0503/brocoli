import { describe, expect, it } from "vitest";
import { repartirRecepcion } from "../lib/campo/calc";

describe("Recepciones reales", () => {
  const lineas = [{ key: "a", cantidad: 6 }, { key: "b", cantidad: 4 }];
  it("cierra al recibir más y conserva todo lo ingresado", () => {
    const r = repartirRecepcion(lineas, 13, 10);
    expect(r["a"]?.status).toBe("recibido");
    expect(r["a"]?.cantidadRecibida).toBe(7.8);
    expect((r["a"]?.cantidadRecibida ?? 0) + (r["b"]?.cantidadRecibida ?? 0)).toBe(13);
  });
  it("marca parcialmente recibido si llega menos", () => {
    const r = repartirRecepcion(lineas, 8, 10);
    expect(r["a"]?.status).toBe("parcial");
    expect(r["b"]?.status).toBe("parcial");
    expect((r["a"]?.cantidadRecibida ?? 0) + (r["b"]?.cantidadRecibida ?? 0)).toBe(8);
  });
  it("cierra con la cantidad exacta", () => {
    expect(repartirRecepcion(lineas, 10, 10)["a"]?.status).toBe("recibido");
  });
  it("compara rollos con el pedido redondeado", () => {
    expect(repartirRecepcion([{ key: "a", cantidad: 8.06 }], 8.5, 9)["a"]?.status).toBe("parcial");
  });
});