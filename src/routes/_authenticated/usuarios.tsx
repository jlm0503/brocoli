import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AppShell } from "@/components/campo/AppShell";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useFase3 } from "@/lib/campo/fase3";
import { ORDEN_PUESTOS, ROLES } from "@/lib/campo/roles";
import { useCampo } from "@/lib/campo/store";
import { useSesion } from "@/lib/campo/sesion";
import type { Role } from "@/lib/campo/types";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuarios y puestos · Brócoli" },
      { name: "description", content: "Aprueba a quien se registró y asígnale su puesto: uno o varios puestos y, a los ingenieros, sus ranchos." },
      { property: "og:title", content: "Usuarios y puestos · Brócoli" },
      { property: "og:description", content: "Quién entra a la app y qué pantallas ve." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Usuarios,
});

interface Persona {
  id: string;
  nombre: string;
  email: string;
  created_at: string;
  puestos: Role[];
}

async function cargarPersonas(): Promise<Persona[]> {
  const [perfiles, roles] = await Promise.all([
    supabase.from("profiles").select("id, nombre, email, created_at").order("created_at"),
    supabase.from("user_roles").select("user_id, role"),
  ]);
  if (perfiles.error) throw perfiles.error;
  if (roles.error) throw roles.error;
  return perfiles.data.map((p) => ({
    ...p,
    puestos: ORDEN_PUESTOS.filter((r) => roles.data.some((x) => x.user_id === p.id && x.role === r)),
  }));
}

function Usuarios() {
  const { user } = useSesion();
  const { ranchos } = useCampo();
  const { asignaciones, guardarAsignacion } = useFase3();
  const qc = useQueryClient();
  const { data: personas = [], isLoading } = useQuery({ queryKey: ["personas"], queryFn: cargarPersonas });

  const cambiar = useMutation({
    mutationFn: async ({ id, puesto, dar }: { id: string; puesto: Role; dar: boolean }) => {
      const r = dar
        ? await supabase.from("user_roles").insert({ user_id: id, role: puesto })
        : await supabase.from("user_roles").delete().eq("user_id", id).eq("role", puesto);
      if (r.error) throw r.error;
    },
    onSuccess: (_d, v) => {
      toast.success(`${v.dar ? "Puesto agregado" : "Puesto quitado"}: ${ROLES[v.puesto].nombre}`);
      void qc.invalidateQueries({ queryKey: ["personas"] });
    },
    onError: () => toast.error("No se pudo cambiar el puesto."),
  });

  const pendientes = personas.filter((p) => p.puestos.length === 0);
  const conPuesto = personas.filter((p) => p.puestos.length > 0);

  const fila = (p: Persona) => {
    const yo = p.id === user?.id;
    const asig = asignaciones.find((a) => a.id === p.id)?.ranchoIds ?? [];
    return (
      <li key={p.id} className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-card">
        <div className="min-w-0">
          <div className="font-medium">
            {p.nombre} {yo && <span className="text-xs text-muted-foreground">(tú)</span>}
          </div>
          <div className="truncate text-sm text-muted-foreground">{p.email}</div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {ORDEN_PUESTOS.map((r) => {
            const tiene = p.puestos.includes(r);
            const bloqueado = yo && r === "admin";
            return (
              <label key={r} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={tiene}
                  disabled={bloqueado || cambiar.isPending}
                  aria-label={`${ROLES[r].nombre} para ${p.nombre}`}
                  onCheckedChange={(c) => cambiar.mutate({ id: p.id, puesto: r, dar: c === true })}
                />
                {ROLES[r].nombre}
              </label>
            );
          })}
        </div>
        {p.puestos.includes("ingeniero") && (
          <div className="rounded-md bg-muted/60 p-3">
            <div className="eyebrow mb-2">Ranchos que ve (sin marcar ninguno ve todos)</div>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {ranchos.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={asig.includes(r.id)}
                    onCheckedChange={(c) =>
                      guardarAsignacion(p.id, c ? [...asig, r.id] : asig.filter((x) => x !== r.id))
                    }
                  />
                  {r.nombre}
                </label>
              ))}
            </div>
          </div>
        )}
      </li>
    );
  };

  return (
    <AppShell
      path="/usuarios"
      eyebrow="Administrador · accesos"
      title="Usuarios y puestos"
      description="Quien crea su cuenta no ve nada hasta que le asignes un puesto. Una persona puede tener varios puestos y ve las pantallas de todos ellos."
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="mb-3 text-2xl font-semibold">
              Esperando aprobación <span className="num text-base text-muted-foreground">({pendientes.length})</span>
            </h2>
            {pendientes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nadie está esperando.</p>
            ) : (
              <ul className="space-y-2">{pendientes.map(fila)}</ul>
            )}
          </section>
          <section>
            <h2 className="mb-3 text-2xl font-semibold">Con puesto</h2>
            <ul className="space-y-2">{conPuesto.map(fila)}</ul>
          </section>
        </div>
      )}
    </AppShell>
  );
}
