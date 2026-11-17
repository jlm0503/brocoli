import { describe, expect, it } from "vitest";
import { accesoPersonalizado, alcanceRanchos, inicioDe, normalizarNivel, permite, puedeCapturar, puedeVer } from "@/lib/campo/roles";

const n = (x: Partial<Record<"ver" | "capturar" | "editar" | "borrar", boolean>>) => normalizarNivel(x);

describe("Permisos personalizados por pantalla", () => {
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
