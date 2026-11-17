import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { Liquidacion } from "./types";

/** PostgREST equality filters need serialized JSON, not a JavaScript object. */
export function actualizarLiquidacion(client: SupabaseClient<Database>, anterior: Liquidacion, nueva: Liquidacion, userId: string) {
  return client.from("registros")
    .update({ data: JSON.parse(JSON.stringify(nueva)) as Json, updated_by: userId })
    .eq("coleccion", "liquidaciones")
    .eq("id", anterior.id)
    .filter("data", "eq", JSON.stringify(anterior))
    .select("id");
}