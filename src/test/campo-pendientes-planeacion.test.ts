import { describe, expect, it } from "vitest";
import { pedidosQueLleganEnSemana } from "@/lib/campo/calc";
import type { PedidoPlaneacion } from "@/lib/campo/types";

const pedido = (semanaPlantacion: number, status: PedidoPlaneacion["status"] = "pendiente"): PedidoPlaneacion => ({ id: `p-${semanaPlantacion}-${status}`, loteId: "l", tablaId: "t", ranchoId: "r", semanaPlantacion, status, ha: 6, lineas: [{ productoId: "cinta", cantidad: 9 }], fecha: "2026-11-10", ingeniero: "", urgente: false });
describe("Preparación pendiente y futura", () => {
  it("semana 46 conserva pendientes de plantar en 46, 47 y 48, no adelanta los de 49", () => {
    expect(pedidosQueLleganEnSemana([46,47,48,49].map(w => pedido(w)), 46).map(p => p.semanaPlantacion)).toEqual([46,47,48]);
  });
  it("semana 47 incluye preparación futura de semana 49 y atrasados aún sin recibir", () => {
    expect(pedidosQueLleganEnSemana([pedido(46),pedido(49)],47).map(p=>p.semanaPlantacion)).toEqual([46,49]);
  });
  it("no vuelve a mostrar pedidos antiguos recibidos ni cancelados", () => {
    expect(pedidosQueLleganEnSemana([pedido(46,"entregado"),pedido(46,"cancelado")],46)).toEqual([]);
  });
  it("semana 48 funciona normalmente con preparación de semana 50", () => {
    expect(pedidosQueLleganEnSemana([pedido(50),pedido(51)],48).map(p=>p.semanaPlantacion)).toEqual([50]);
  });
});