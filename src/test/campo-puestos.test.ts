import { describe, expect, it } from "vitest";
import { NAV, alcanceRanchos, puedeCapturar, puedeOperacionCampo, puedeResolverSobrantes, puedeVer, PERMISOS_COSECHA } from "@/lib/campo/roles";
import type { Role } from "@/lib/campo/types";

const matriz: Record<string, { consulta: string[]; captura: string[] }> = {
  ingeniero: { captura: ["/aplicaciones", "/planeacion", "/solicitudes", "/extraordinarios", "/cosecha"], consulta: ["/llegadas", "/rendimiento", "/ranchos", "/consumo", "/cuenta-planta", "/historicos", "/paquete"] },
  encargado: { captura: ["/aplicaciones", "/llegadas", "/cosecha", "/gastos"], consulta: ["/planeacion", "/solicitudes", "/consumo", "/historicos", "/paquete"] },
  compras: { captura: ["/compras"], consulta: ["/llegadas", "/paquete"] },
  almacen: { captura: ["/llegadas", "/devoluciones"], consulta: ["/compras", "/alertas", "/gastos", "/consumo", "/historicos", "/paquete"] },
  administrador: { captura: ["/aplicaciones", "/gastos", "/catalogos"], consulta: ["/planeacion", "/solicitudes", "/llegadas", "/extraordinarios", "/cosecha", "/compras", "/devoluciones", "/alertas", "/ranchos", "/consumo", "/liquidacion", "/cuenta-planta", "/resultados", "/historicos", "/paquete"] },
  autorizador: { captura: ["/extraordinarios"], consulta: [] },
  direccion: { captura: [], consulta: ["/panel", "/direccion"] },
};
describe("Matriz de puestos del 11 de noviembre", () => {
  for (const [puesto, permisos] of Object.entries(matriz)) {
    for (const pantalla of NAV) {
      it(`${puesto}: ${pantalla.to} respeta visibilidad y captura`, () => {
        const roles = [puesto as Role];
        expect(puedeVer(roles, pantalla.to)).toBe([...permisos.consulta, ...permisos.captura].includes(pantalla.to));
        expect(puedeCapturar(roles, pantalla.to)).toBe(permisos.captura.includes(pantalla.to));
      });
    }
  }
  it("Super Admin conserva todas las pantallas y capturas", () => {
    for (const n of NAV) { expect(puedeVer(["admin"], n.to)).toBe(true); expect(puedeCapturar(["admin"], n.to)).toBe(true); }
  });
  it.each(["ingeniero", "encargado"] as Role[])("%s sin asignación no ve ningún rancho", role => {
    expect(alcanceRanchos([role], [])).toEqual([]);
    expect(alcanceRanchos([role], ["trejo"])).toEqual(["trejo"]);
  });
  it.each(["admin", "administrador", "compras", "almacen", "direccion", "autorizador"] as Role[])("%s ve todos los ranchos", role => expect(alcanceRanchos([role], [])).toBeNull());
  it("Encargado solo avanza aplicaciones y no decide sobrantes", () => {
    expect(puedeCapturar(["encargado"], "/aplicaciones")).toBe(true);
    expect(puedeResolverSobrantes(["encargado"])).toBe(false);
  });
  it("Ingeniero y Encargado registran salidas pero no evaluaciones", () => {
    for (const r of ["ingeniero", "encargado"] as Role[]) {
      expect(PERMISOS_COSECHA.viajes.includes(r)).toBe(true);
      expect(PERMISOS_COSECHA.evaluaciones.includes(r)).toBe(false);
    }
  });
  it("Ingeniero no recibe y Administrativo no modifica receta ni planeación", () => {
    expect(puedeOperacionCampo(["ingeniero"], "recibir")).toBe(false);
    expect(puedeOperacionCampo(["ingeniero"], "recibirPlanta")).toBe(false);
    expect(puedeOperacionCampo(["administrador"], "setDosis")).toBe(false);
    expect(puedeOperacionCampo(["administrador"], "planearLote")).toBe(false);
    expect(puedeOperacionCampo(["administrador"], "agregarProducto")).toBe(true);
  });
  it("Varios puestos suman captura sin ampliar asignaciones entre puestos de campo", () => {
    expect(puedeCapturar(["ingeniero", "almacen"], "/llegadas")).toBe(true);
    expect(alcanceRanchos(["ingeniero", "encargado"], ["trejo"])).toEqual(["trejo"]);
  });
});