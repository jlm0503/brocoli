import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AppShell } from "@/components/campo/AppShell";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { ROLES, puestoPrincipal } from "@/lib/campo/roles";
import { useSesion } from "@/lib/campo/sesion";
import type { Role } from "@/lib/campo/types";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuarios y puestos · Brócoli" },
      { name: "description", content: "Aprueba a quien se registró y asígnale su puesto: administrador, ingeniero de campo o compras." },
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
  puesto: Role | null;
}

const SIN_PUESTO = "ninguno";

async function cargarPersonas(): Promise<Persona[]> {
  const [perfiles, roles] = await Promise.all([
    supabase.from("profiles").select("id, nombre, email, created_at").order("created_at"),
    supabase.from("user_roles").select("user_id, role"),
  ]);
  if (perfiles.error) throw perfiles.error;
  if (roles.error) throw roles.error;
  return perfiles.data.map((p) => ({
    ...p,
    puesto: puestoPrincipal(roles.data.filter((r) => r.user_id === p.id).map((r) => r.role)),
  }));
}

function Usuarios() {
  const { user } = useSesion();
  const qc = useQueryClient();
  const { data: personas = [], isLoading } = useQuery({ queryKey: ["personas"], queryFn: cargarPersonas });

  const asignar = useMutation({
    mutationFn: async ({ id, puesto }: { id: string; puesto: Role | null }) => {
      const quitar = await supabase.from("user_roles").delete().eq("user_id", id);
      if (quitar.error) throw quitar.error;
      if (puesto) {
        const poner = await supabase.from("user_roles").insert({ user_id: id, role: puesto });
        if (poner.error) throw poner.error;
      }
    },
    onSuccess: (_d, v) => {
      toast.success(v.puesto ? `Puesto asignado: ${ROLES[v.puesto].nombre}` : "Se quitó el puesto; ya no verá nada");
      void qc.invalidateQueries({ queryKey: ["personas"] });
    },
    onError: () => toast.error("No se pudo cambiar el puesto."),
  });

  const pendientes = personas.filter((p) => !p.puesto);
  const conPuesto = personas.filter((p) => p.puesto);

  const fila = (p: Persona) => {
    const yo = p.id === user?.id;
    return (
      <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-card">
        <div className="min-w-0">
          <div className="font-medium">
            {p.nombre} {yo && <span className="text-xs text-muted-foreground">(tú)</span>}
          </div>
          <div className="truncate text-sm text-muted-foreground">{p.email}</div>
        </div>
        {yo ? (
          <Badge variant="verde">{p.puesto ? ROLES[p.puesto].nombre : "Sin puesto"}</Badge>
        ) : (
          <Select
            value={p.puesto ?? SIN_PUESTO}
            onValueChange={(v) => asignar.mutate({ id: p.id, puesto: v === SIN_PUESTO ? null : (v as Role) })}
          >
            <SelectTrigger className="w-56" aria-label={`Puesto de ${p.nombre}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SIN_PUESTO}>Sin puesto (no ve nada)</SelectItem>
              {(Object.keys(ROLES) as Role[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLES[r].nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </li>
    );
  };

  return (
    <AppShell
      path="/usuarios"
      eyebrow="Administrador · accesos"
      title="Usuarios y puestos"
      description="Quien crea su cuenta no ve nada hasta que le asignes un puesto. Cada puesto solo ve sus pantallas."
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
