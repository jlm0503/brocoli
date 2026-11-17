import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import { actualizarLiquidacion } from "@/lib/campo/guardar-liquidacion";

it("envía JSON válido al anular un pago y conserva la condición contra cambios simultáneos", async () => {
  const anterior = { id: "2026-10-29", pagado: 200, fecha: "2026-11-17", comprobante: "p.pdf", por: "Jimena" };
  let peticion: URL | undefined;
  let cuerpo: Record<string, unknown> | undefined;
  const client = createClient<Database>("https://example.test", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      peticion = new URL(String(input));
      cuerpo = JSON.parse(String(init?.body));
      return new Response(JSON.stringify([{ id: anterior.id }]), { headers: { "content-type": "application/json" } });
    } },
  });
  const result = await actualizarLiquidacion(client, anterior, { ...anterior, pagado: 100 }, "00000000-0000-0000-0000-000000000001");
  expect(result.error).toBeNull();
  expect(peticion?.searchParams.get("data")).toBe(`eq.${JSON.stringify(anterior)}`);
  expect(peticion?.searchParams.get("id")).toBe("eq.2026-10-29");
  expect(cuerpo?.['data']).toEqual({ ...anterior, pagado: 100 });
});