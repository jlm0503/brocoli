import { z } from "zod";
import { ORDEN_PUESTOS } from "./roles";
import type { Role } from "./types";

export const claveUsuario = z.string().min(8, "Usa al menos 8 caracteres.").max(128, "Usa hasta 128 caracteres.");
export const nuevoUsuario = z.object({
  nombre: z.string().trim().min(1, "Escribe el nombre.").max(120),
  email: z.string().trim().email("Escribe un correo válido.").transform(v => v.toLowerCase()),
  password: claveUsuario,
  puestos: z.array(z.custom<Role>(v => ORDEN_PUESTOS.includes(v as Role))).min(1, "Selecciona un puesto."),
  ranchoIds: z.array(z.string().min(1)),
});

export function exigirAdmin(esAdmin: boolean) {
  if (!esAdmin) throw new Error("Solo Super Admin puede administrar cuentas.");
}