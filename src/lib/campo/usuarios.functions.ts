import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { claveUsuario, exigirAdmin, nuevoUsuario } from "./usuarios-reglas";

export const crearUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => nuevoUsuario.parse(input))
  .handler(async ({ data, context }) => {
    const permiso = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    exigirAdmin(!permiso.error && permiso.data === true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin.auth.admin.createUser({ email: data.email, password: data.password, email_confirm: false, user_metadata: { nombre: data.nombre } });
    if (result.error || !result.data.user) {
      return { ok: false, mensaje: result.error?.code === "email_exists" ? "Ya existe una cuenta con ese correo." : "No se pudo crear la cuenta. Revisa el correo y la contraseña." };
    }
    const id = result.data.user.id;
    // Pantallas y permisos se asignan después, uno por uno, en Usuarios.
    const ranchos = await supabaseAdmin.from("registros").insert({ coleccion: "asignaciones", id, data: { id, ranchoIds: [...new Set(data.ranchoIds)] } });
    if (ranchos.error) {
      // Roll back only the newly created account, never an existing person or field record.
      await supabaseAdmin.from("registros").delete().eq("coleccion", "asignaciones").eq("id", id);
      await supabaseAdmin.auth.admin.deleteUser(id);
      return { ok: false, mensaje: "No se pudo asignar el acceso; no se creó la cuenta. Intenta de nuevo." };
    }
    const envio = await context.supabase.auth.resend({ type: "signup", email: data.email });
    return { ok: true, mensaje: envio.error ? "Cuenta creada. Debe confirmar su correo; si no recibió el mensaje, puede solicitarlo desde Crear cuenta con el mismo correo." : "Cuenta creada. La persona debe confirmar su correo antes de entrar con la contraseña que asignaste." };
  });

export const cambiarClaveUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ id: z.string().uuid(), password: claveUsuario }).parse(input))
  .handler(async ({ data, context }) => {
    const permiso = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    exigirAdmin(!permiso.error && permiso.data === true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin.auth.admin.updateUserById(data.id, { password: data.password });
    return { ok: !result.error, mensaje: result.error ? "No se pudo cambiar la contraseña." : "Contraseña actualizada." };
  });