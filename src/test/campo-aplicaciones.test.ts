import { describe, expect, it } from "vitest";
import { fuentesAplicacion, saldoAplicacion, validarAplicacion } from "../lib/campo/calc";
import { puedeVer } from "../lib/campo/roles";
import type { FuenteAplicacion, AplicacionCampo } from "../lib/campo/aplicaciones-types";
import type { LineaDemanda } from "../lib/campo/types";

const f: FuenteAplicacion = { key: "l|p|46", loteId:"l", tablaId:"t", ranchoId:"r", productoId:"p", semana:46, tipo:"Receta", esperado:20, recibido:25, ha:4 };
const a: AplicacionCampo = { id:"a", fuenteKey:f.key, loteId:"l", tablaId:"t", ranchoId:"r", productoId:"p", semanaOrigen:46, fecha:"2026-11-10", ha:2, cantidad:10, dosis:5, unidad:"kg", por:"Ingeniero" };
describe("Aplicaciones en rancho", () => {
  it("dosis por tabla y saldo usan recibido real, no lo pedido", () => {
    const s = saldoAplicacion(f,[a],[],[],46);
    expect(s.dosis).toBe(5); expect(s.saldo).toBe(15); expect(s.haAplicadas).toBe(2);
  });
  it("al cierre marca sobrante sin devolver ni consumir automáticamente", () => {
    const s = saldoAplicacion(f,[a],[],[],47);
    expect(s.pendienteDevolver).toBe(true); expect(s.puedeAplicar).toBe(false); expect(s.saldo).toBe(15);
  });
  it("continuar mantiene la entrega original y requiere decisión nuevamente la semana siguiente", () => {
    const c = [{id:f.key, semanaHasta:47, fecha:"2026-11-16", por:"Ingeniero"}];
    expect(saldoAplicacion(f,[a],[],c,47).puedeAplicar).toBe(true);
    expect(saldoAplicacion(f,[a],[],c,47).saldo).toBe(15);
    expect(saldoAplicacion(f,[a],[],c,48).pendienteDevolver).toBe(true);
  });
  it("rechaza aplicaciones que superan lo disponible o las hectáreas", () => {
    const s = saldoAplicacion(f,[a],[],[],46);
    expect(validarAplicacion(f,s,{cantidad:16,ha:2,fecha:"2026-11-10"},"2026-11-10")).not.toBeNull();
    expect(validarAplicacion(f,s,{cantidad:5,ha:3,fecha:"2026-11-10"},"2026-11-10")).not.toBeNull();
    expect(validarAplicacion(f,s,{cantidad:10,ha:2,fecha:"2026-11-10"},"2026-11-10")).toBeNull();
  });
  it("no inventa recepciones anteriores y conserva parciales", () => {
    const linea: LineaDemanda = {key:f.key,loteId:"l",tablaId:"t",ranchoId:"r",productoId:"p",semana:46,semanaReceta:1,cantidad:20};
    expect(fuentesAplicacion([], [linea], {}, [], [], [])[0]?.recibido).toBe(0);
    expect(fuentesAplicacion([], [linea], {[f.key]:{status:"parcial",cantidadRecibida:8}}, [], [], [])[0]?.recibido).toBe(8);
  });
  it("solo los perfiles solicitados y Super Admin acceden", () => {
    expect(puedeVer(["ingeniero"],"/aplicaciones")).toBe(true);
    expect(puedeVer(["administrador"],"/aplicaciones")).toBe(true);
    expect(puedeVer(["admin"],"/aplicaciones")).toBe(true);
    expect(puedeVer(["compras"],"/aplicaciones")).toBe(false);
  });
});