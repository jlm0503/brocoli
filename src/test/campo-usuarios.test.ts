import { describe, expect, it } from "vitest";
import { exigirAdmin, nuevoUsuario, claveUsuario } from "@/lib/campo/usuarios-reglas";

describe("Administración de cuentas", () => {
  it("reserva administración al Super Admin", () => {
    expect(() => exigirAdmin(false)).toThrow();
    expect(() => exigirAdmin(true)).not.toThrow();
  });
  it("conserva los ranchos elegidos", () => {
    const data = nuevoUsuario.parse({ nombre: "Persona", email: "persona@example.com", password: "clave-segura", ranchoIds: ["trejo"] });
    expect(data.ranchoIds).toEqual(["trejo"]);
  });
  it("valida contraseñas antes de enviarlas", () => {
    expect(claveUsuario.safeParse("corta").success).toBe(false);
    expect(claveUsuario.safeParse("clave-segura").success).toBe(true);
  });
});