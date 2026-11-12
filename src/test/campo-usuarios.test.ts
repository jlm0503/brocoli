import { describe, expect, it } from "vitest";
import { exigirAdmin, nuevoUsuario, claveUsuario } from "@/lib/campo/usuarios-reglas";

describe("Administración de cuentas", () => {
  it("reserva administración al Super Admin", () => {
    expect(() => exigirAdmin(false)).toThrow();
    expect(() => exigirAdmin(true)).not.toThrow();
  });
  it("rechaza puestos que no existen", () => {
    expect(nuevoUsuario.safeParse({ nombre: "Persona", email: "persona@example.com", password: "clave-segura", puestos: ["dueño"], ranchoIds: [] }).success).toBe(false);
  });
  it("conserva los puestos y ranchos elegidos", () => {
    const data = nuevoUsuario.parse({ nombre: "Persona", email: "persona@example.com", password: "clave-segura", puestos: ["ingeniero"], ranchoIds: ["trejo"] });
    expect(data.puestos).toEqual(["ingeniero"]);
    expect(data.ranchoIds).toEqual(["trejo"]);
  });
  it("no permite cuentas sin puesto", () => {
    expect(nuevoUsuario.safeParse({ nombre: "Persona", email: "persona@example.com", password: "clave-segura", puestos: [], ranchoIds: [] }).success).toBe(false);
  });
  it("valida contraseñas antes de enviarlas", () => {
    expect(claveUsuario.safeParse("corta").success).toBe(false);
    expect(claveUsuario.safeParse("clave-segura").success).toBe(true);
  });
});