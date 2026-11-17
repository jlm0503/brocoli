import { z } from "zod";

export const claveUsuario = z.string().min(8, "Usa al menos 8 caracteres.").max(128, "Usa hasta 128 caracteres.");
export const nuevoUsuario = z.object({
  nombre: z.string().trim().min(1, "Escribe el nombre.").max(120),
  email: z.string().trim().email("Escribe un correo válido.").transform(v => v.toLowerCase()),
  password: claveUsuario,
  ranchoIds: z.array(z.string().min(1)),
});

export function exigirAdmin(esAdmin: boolean) {
  if (!esAdmin) throw new Error("Solo Super Admin puede administrar cuentas.");
}