import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Borra la cuenta de quien la pide; nunca deja la app sin administrador. */
export const eliminarMiCuenta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: admins, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (error) throw new Error("No se pudo revisar la cuenta.");
    const ids = (admins ?? []).map((a) => a.user_id);
    if (ids.includes(context.userId) && ids.length <= 1) {
      return {
        error:
          "Eres la única cuenta de administrador. Nombra a otro administrador antes de borrar la tuya.",
      };
    }
    const { error: e2 } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (e2) return { error: "No se pudo eliminar la cuenta." };
    return { ok: true as const };
  });
