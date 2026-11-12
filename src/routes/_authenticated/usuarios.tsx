import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus, KeyRound, Loader2 } from "lucide-react";

import { AppShell } from "@/components/campo/AppShell";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useFase3 } from "@/lib/campo/fase3";
import { ORDEN_PUESTOS, ROLES, NAV, puedeVer, puedeCapturar } from "@/lib/campo/roles";
import { crearUsuario, cambiarClaveUsuario } from "@/lib/campo/usuarios.functions";
import { useCampo } from "@/lib/campo/store";
import { useSesion } from "@/lib/campo/sesion";
import type { Role } from "@/lib/campo/types";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuarios y puestos · Brócoli" },
      { name: "description", content: "Crea cuentas, asigna contraseñas, puestos y ranchos y consulta las pantallas autorizadas en Ultra Farms." },
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
  const [creando, setCreando] = useState(false);
  const [personaClave, setPersonaClave] = useState<Persona | null>(null);
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
        <Button variant="outline" size="sm" onClick={() => setPersonaClave(p)}><KeyRound />Cambiar contraseña</Button>
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
        <Pantallas puestos={p.puestos} />
        {(p.puestos.includes("ingeniero") || p.puestos.includes("encargado")) && (
          <div className="rounded-md bg-muted/60 p-3">
            <div className="eyebrow mb-2">Ranchos asignados (sin marcar ninguno no ve ningún rancho)</div>
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
    >
      <div className="mb-5 flex justify-end"><Button onClick={() => setCreando(true)}><UserPlus />Crear usuario</Button></div>
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
      <CuentaDialog abierta={creando || !!personaClave} persona={personaClave} ranchos={ranchos} cerrar={() => { setCreando(false); setPersonaClave(null); }} creada={() => void qc.invalidateQueries({ queryKey: ["personas"] })} />
    </AppShell>
  );
}

function Pantallas({ puestos }: { puestos: Role[] }) {
  const visibles = NAV.filter(n => puedeVer(puestos, n.to));
  return <details className="text-sm"><summary className="cursor-pointer text-primary">Pantallas y permisos ({visibles.length})</summary><ul className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">{visibles.map(n => <li key={n.to} className="flex justify-between gap-2 border-b border-border py-1"><span>{n.label}</span><span className="shrink-0 text-xs text-muted-foreground">{puedeCapturar(puestos, n.to) ? "Captura" : "Consulta"}</span></li>)}</ul></details>;
}

function CuentaDialog({ abierta, persona, ranchos, cerrar, creada }: { abierta: boolean; persona: Persona | null; ranchos: { id: string; nombre: string }[]; cerrar: () => void; creada: () => void }) {
  // Mount a fresh form for each opening so passwords never linger between people.
  return <Dialog open={abierta} onOpenChange={v => { if (!v) cerrar(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto">{abierta && <CuentaForm persona={persona} ranchos={ranchos} cerrar={cerrar} creada={creada} />}</DialogContent></Dialog>;
}

function CuentaForm({ persona, ranchos, cerrar, creada }: { persona: Persona | null; ranchos: { id: string; nombre: string }[]; cerrar: () => void; creada: () => void }) {
  const crear = useServerFn(crearUsuario);
  const cambiarClave = useServerFn(cambiarClaveUsuario);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [puestos, setPuestos] = useState<Role[]>([]);
  const [ranchoIds, setRanchoIds] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!persona && !puestos.length) return void toast.error("Selecciona al menos un puesto.");
    setEnviando(true);
    try {
      const resultado = persona ? await cambiarClave({ data: { id: persona.id, password } }) : await crear({ data: { nombre, email, password, puestos, ranchoIds } });
      if (!resultado.ok) { toast.error(resultado.mensaje); return; }
      setPassword("");
      toast.success(resultado.mensaje, { duration: 10000 });
      creada(); cerrar();
    } catch { toast.error("No se pudo guardar la cuenta. Intenta de nuevo."); }
    finally { setEnviando(false); }
  };
  return <>
    <DialogHeader><DialogTitle>{persona ? "Cambiar contraseña" : "Crear usuario"}</DialogTitle><DialogDescription>{persona ? `${persona.nombre} · ${persona.email}` : "Nueva cuenta · Ultra Farms"}</DialogDescription></DialogHeader>
    <form onSubmit={guardar} className="space-y-4">
      {!persona && <><div className="space-y-1"><Label htmlFor="usuario-nombre">Nombre</Label><Input id="usuario-nombre" required maxLength={120} value={nombre} onChange={e => setNombre(e.target.value)} /></div><div className="space-y-1"><Label htmlFor="usuario-correo">Correo</Label><Input id="usuario-correo" type="email" required autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} /></div></>}
      <div className="space-y-1"><Label htmlFor="usuario-clave">{persona ? "Nueva contraseña" : "Contraseña"}</Label><Input id="usuario-clave" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} /><p className="text-xs text-muted-foreground">Mínimo 8 caracteres. No se muestran contraseñas anteriores.</p></div>
      {!persona && <>
        <fieldset><legend className="mb-2 text-sm font-medium">Puestos</legend><div className="grid gap-2 sm:grid-cols-2">{ORDEN_PUESTOS.map(r => <label key={r} className="flex items-center gap-2 text-sm"><Checkbox checked={puestos.includes(r)} onCheckedChange={v => setPuestos(v === true ? [...puestos, r] : puestos.filter(x => x !== r))} />{ROLES[r].nombre}</label>)}</div></fieldset>
        {(puestos.includes("ingeniero") || puestos.includes("encargado")) && <fieldset><legend className="mb-2 text-sm font-medium">Ranchos asignados</legend><div className="grid gap-2 sm:grid-cols-2">{ranchos.map(r => <label key={r.id} className="flex items-center gap-2 text-sm"><Checkbox checked={ranchoIds.includes(r.id)} onCheckedChange={v => setRanchoIds(v === true ? [...ranchoIds, r.id] : ranchoIds.filter(x => x !== r.id))} />{r.nombre}</label>)}</div>{!ranchoIds.length && <p className="mt-2 text-xs text-destructive">Sin asignación no verá datos de ranchos.</p>}</fieldset>}
        <Pantallas puestos={puestos} />
      </>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={enviando} onClick={cerrar}>Cancelar</Button><Button type="submit" disabled={enviando}>{enviando && <Loader2 className="animate-spin" />}{persona ? "Guardar contraseña" : "Crear usuario"}</Button></div>
    </form>
  </>;
}
