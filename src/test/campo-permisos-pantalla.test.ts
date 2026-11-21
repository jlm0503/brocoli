import { describe, expect, it } from "vitest";
import { accesoPersonalizado, alcanceRanchos, inicioDe, normalizarNivel, permite, puedeCapturar, puedeVer, puedeOperacionCampo, resolverAcceso } from "@/lib/campo/roles";

const n = (x: Partial<Record<"ver" | "capturar" | "editar" | "borrar", boolean>>) => normalizarNivel(x);

describe("Permisos personalizados por pantalla", () => {
  it("Román puede registrar avances con sus permisos aunque conserve el puesto encargado", () => {
    const a = resolverAcceso(["encargado"], { "/planeacion": n({ ver: true, capturar: true, editar: true }) });
    expect(puedeCapturar(a, "/planeacion")).toBe(true);
    expect(puedeOperacionCampo(a, "registrarAvance")).toBe(true);
    expect(alcanceRanchos(a, ["trejo"])).toEqual(["trejo"]);
  });
  it("un puesto anterior no concede acciones ni ranchos fuera de las casillas asignadas", () => {
    const a = resolverAcceso(["compras"], { "/compras": n({ ver: true }) });
    expect(puedeCapturar(a, "/compras")).toBe(false);
    expect(puedeVer(a, "/planeacion")).toBe(false);
    expect(alcanceRanchos(a, ["trejo"])).toEqual(["trejo"]);
  });
  it("desmarcar Ver no restaura el acceso del puesto antiguo", () => {
    const a = resolverAcceso(["ingeniero"], { "/planeacion": n({ ver: false }) });
    expect(puedeVer(a, "/planeacion")).toBe(false);
    expect(puedeOperacionCampo(a, "registrarAvance")).toBe(false);
  });
  it("las casillas no limitan al Super Admin", () => {
    const a = resolverAcceso(["admin"], { "/planeacion": n({ ver: false }) });
    expect(puedeOperacionCampo(a, "registrarAvance")).toBe(true);
  });
  it("sin Ver no hay otra acción", () => {
    expect(n({ capturar: true, borrar: true })).toEqual({ ver: false, capturar: false, editar: false, borrar: false });
  });
  it("cada acción se concede por separado", () => {
    const a = accesoPersonalizado({ "/gastos": n({ ver: true, capturar: true }) });
    expect(permite(a, "/gastos", "ver")).toBe(true);
    expect(permite(a, "/gastos", "capturar")).toBe(true);
    expect(permite(a, "/gastos", "editar")).toBe(false);
    expect(permite(a, "/gastos", "borrar")).toBe(false);
    expect(puedeVer(a, "/compras")).toBe(false);
  });
  it("solo ver no permite capturar", () => {
    const a = accesoPersonalizado({ "/cosecha": n({ ver: true }) });
    expect(puedeCapturar(a, "/cosecha")).toBe(false);
  });
  it("Super Admin conserva todo", () => {
    expect(permite(["admin"], "/parametros", "borrar")).toBe(true);
  });
  it("ranchos: todos o solo los marcados", () => {
    expect(alcanceRanchos(accesoPersonalizado({}, true), ["a"])).toBeNull();
    expect(alcanceRanchos(accesoPersonalizado({}, false), ["a"])).toEqual(["a"]);
  });
  it("entra a su primera pantalla autorizada", () => {
    expect(inicioDe(accesoPersonalizado({ "/gastos": n({ ver: true }) }))).toBe("/gastos");
  });
});
