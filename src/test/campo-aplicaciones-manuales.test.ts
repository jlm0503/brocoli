import { describe, it, expect } from "vitest";
import { costoAplicacionesManuales, fuentesManuales, validarAplicacionManual, saldoAplicacion, consumoProductosLote } from "@/lib/campo/calc";
import type { AplicacionCampo, FuenteAplicacion } from "@/lib/campo/aplicaciones-types";
import type { Lote, Producto } from "@/lib/campo/types";

const lote = { id: "l", tablaId: "t", ranchoId: "r", ha: 4, avances: [{ ha: 4, semana: 40, fecha: "2026-10-01" }], insumos: [] } as Lote;
const producto = { id: "xhanto", unidad: "L" } as Producto;
const datos = { recibido: 8, dosis: 2, cantidad: 4, ha: 2, fecha: "2026-11-14", motivo: "Xhanto llegó tarde" };
const fuente: FuenteAplicacion = { key: "l|manual-a|xhanto", loteId: "l", tablaId: "t", ranchoId: "r", productoId: "xhanto", semana: 46, tipo: "Fuera de paquete", esperado: 8, recibido: 8, ha: 4 };
const avance: AplicacionCampo = { id: "a", fuenteKey: fuente.key, loteId: "l", tablaId: "t", ranchoId: "r", productoId: "xhanto", semanaOrigen: 46, fecha: datos.fecha, ha: 2, cantidad: 4, dosis: 2, unidad: "L", por: "Jimena", fuenteManual: fuente, precioManual: 100, motivo: datos.motivo };
const { fuenteManual: _fuente, ...posterior } = avance;

describe("Aplicaciones fuera del paquete", () => {
  it("permite Xhanto aunque el lote no tenga receta ni planeación para ese producto", () => {
    expect(validarAplicacionManual(lote, producto, datos, "2026-11-14")).toBeNull();
  });
  it("conserva 8 litros confirmados y 4 disponibles después del avance", () => {
    expect(fuentesManuales([avance, { ...posterior, id: "b" }])).toEqual([fuente]);
    expect(saldoAplicacion(fuente, [avance], [], [], 46).saldo).toBe(4);
  });
  it("no permite aplicar más de los 8 litros disponibles", () => {
    expect(validarAplicacionManual(lote, producto, { ...datos, cantidad: 9 }, "2026-11-14")).not.toBeNull();
  });
  it("no permite superar las 4 hectáreas plantadas", () => {
    expect(validarAplicacionManual(lote, producto, { ...datos, ha: 5 }, "2026-11-14")).not.toBeNull();
  });
  it("no permite aplicar en un ciclo cerrado", () => {
    expect(validarAplicacionManual({ ...lote, cerrado: true }, producto, datos, "2026-11-14")).not.toBeNull();
  });
  it("cobra una sola vez la disponibilidad con el precio registrado", () => {
    expect(costoAplicacionesManuales("l", [avance, { ...posterior, id: "b", cantidad: 2 }])).toBe(800);
  });
  it("integra el consumo fuera del paquete sin duplicar avances posteriores", () => {
    const c = consumoProductosLote(lote, { lineas: [], recepciones: {}, pedidos: [], extraordinarios: [], devoluciones: [], aplicaciones: [avance, { ...posterior, id: "b" }] });
    expect(c[0]?.fueraPaquete).toBe(8);
    expect(c[0]?.neto).toBe(8);
  });
  it("al cierre semanal los 4 litros sobrantes requieren devolver o continuar", () => {
    expect(saldoAplicacion(fuente, [avance], [], [], 47).pendienteDevolver).toBe(true);
  });
});