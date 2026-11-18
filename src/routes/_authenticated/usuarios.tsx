import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Fragment, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus, KeyRound, Loader2, Trash2 } from "lucide-react";

import { AppShell } from "@/components/campo/AppShell";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useFase3 } from "@/lib/campo/fase3";
import { ACCIONES, NAV, normalizarNivel, type Nivel, type NavPath, type PermisosPantalla } from "@/lib/campo/roles";
import { agruparPantallas } from "@/lib/campo/navegacion";
import { crearUsuario, cambiarClaveUsuario, eliminarUsuario } from "@/lib/campo/usuarios.functions";
import { useCampo } from "@/lib/campo/store";
import { useSesion } from "@/lib/campo/sesion";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuarios y permisos · Brócoli" },
      { name: "description", content: "Crea cuentas, asigna contraseñas, ranchos y permisos por pantalla en Ultra Farms." },
      { property: "og:title", content: "Usuarios y permisos · Brócoli" },
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
  admin: boolean;
  permisos: PermisosPantalla;
}

/** Pantallas que se asignan una por una (Usuarios queda solo para Super Admin). */
const PANTALLAS = NAV.filter((n) => n.to !== "/usuarios");

async function cargarPersonas(): Promise<Persona[]> {
  const [perfiles, roles, permisos] = await Promise.all([
    supabase.from("profiles").select("id, nombre, email, created_at").order("created_at"),
    supabase.from("user_roles").select("user_id, role"),
    supabase.from("permisos_pantalla").select("user_id, pantalla, ver, capturar, editar, borrar"),
  ]);
  if (perfiles.error) throw perfiles.error;
  if (roles.error) throw roles.error;
  if (permisos.error) throw permisos.error;
  return perfiles.data.map((p) => {
    const mapa: PermisosPantalla = {};
    for (const f of permisos.data) if (f.user_id === p.id) mapa[f.pantalla as NavPath] = normalizarNivel(f);
    return { ...p, admin: roles.data.some((x) => x.user_id === p.id && x.role === "admin"), permisos: mapa };
  });
}

function Usuarios() {
  const { user } = useSesion();
  const { ranchos } = useCampo();
  const { asignaciones, guardarAsignacion } = useFase3();
  const qc = useQueryClient();
  const [creando, setCreando] = useState(false);
  const [personaClave, setPersonaClave] = useState<Persona | null>(null);
  const borrarFn = useServerFn(eliminarUsuario);
  const borrar = useMutation({
    mutationFn: async (id: string) => borrarFn({ data: { id } }),
    onSuccess: (r) => {
      if (r.ok) toast.success(r.mensaje); else toast.error(r.mensaje);
      void qc.invalidateQueries({ queryKey: ["personas"] });
    },
    onError: () => toast.error("No se pudo eliminar el usuario."),
  });
  const { data: personas = [], isLoading } = useQuery({ queryKey: ["personas"], queryFn: cargarPersonas });

  const cambiarAdmin = useMutation({
    mutationFn: async ({ id, dar }: { id: string; dar: boolean }) => {
      const r = dar
        ? await supabase.from("user_roles").insert({ user_id: id, role: "admin" })
        : await supabase.from("user_roles").delete().eq("user_id", id).eq("role", "admin");
      if (r.error) throw r.error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.dar ? "Ahora es Super Admin" : "Ya no es Super Admin");
      void qc.invalidateQueries({ queryKey: ["personas"] });
    },
    onError: () => toast.error("No se pudo cambiar."),
  });

  const cambiarPermiso = useMutation({
    mutationFn: async ({ id, pantalla, nivel }: { id: string; pantalla: NavPath; nivel: Nivel }) => {
      const r = nivel.ver
        ? await supabase.from("permisos_pantalla").upsert({ user_id: id, pantalla, ...nivel })
        : await supabase.from("permisos_pantalla").delete().eq("user_id", id).eq("pantalla", pantalla);
      if (r.error) throw r.error;
    },
    onMutate: ({ id, pantalla, nivel }) => {
      qc.setQueryData<Persona[]>(["personas"], (xs) => xs?.map((p) => (p.id === id ? { ...p, permisos: { ...p.permisos, [pantalla]: nivel } } : p)));
    },
    onError: () => {
      toast.error("No se pudo guardar el permiso.");
      void qc.invalidateQueries({ queryKey: ["personas"] });
    },
  });

  const conAcceso = (p: Persona) => p.admin || Object.values(p.permisos).some((n) => n?.ver);
  const pendientes = personas.filter((p) => !conAcceso(p));
  const activos = personas.filter(conAcceso);

  const fila = (p: Persona) => {
    const yo = p.id === user?.id;
    const a = asignaciones.find((x) => x.id === p.id);
    const asig = a?.ranchoIds ?? [];
    const todos = !!a?.todos;
    const vistas = PANTALLAS.filter((n) => p.permisos[n.to]?.ver).length;
    return (
      <li key={p.id} className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium">
              {p.nombre} {yo && <span className="text-xs text-muted-foreground">(tú)</span>}
            </div>
            <div className="truncate text-sm text-muted-foreground">{p.email}</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={p.admin}
                disabled={yo || cambiarAdmin.isPending}
                aria-label={`Super Admin para ${p.nombre}`}
                onCheckedChange={(c) => cambiarAdmin.mutate({ id: p.id, dar: c === true })}
              />
              Super Admin
            </label>
            <Button variant="outline" size="sm" onClick={() => setPersonaClave(p)}><KeyRound />Cambiar contraseña</Button>
            {!yo && (
              <Button
                variant="outline"
                size="sm"
                disabled={borrar.isPending}
                className="text-destructive"
                onClick={() => { if (window.confirm(`¿Eliminar la cuenta de ${p.nombre}? Ya no podrá entrar; lo que capturó se conserva.`)) borrar.mutate(p.id); }}
              ><Trash2 />Eliminar</Button>
            )}
          </div>
        </div>
        {p.admin ? (
          <p className="text-sm text-muted-foreground">Super Admin: ve y hace todo en todas las pantallas y ranchos.</p>
        ) : (
          <>
            <details className="text-sm" open={vistas === 0}>
              <summary className="cursor-pointer text-primary">Pantallas y permisos ({vistas} de {PANTALLAS.length})</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="py-1.5 pr-2 text-left font-medium">Pantalla</th>
                      {ACCIONES.map((ac) => <th key={ac.id} className="px-2 py-1.5 font-medium">{ac.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {agruparPantallas(PANTALLAS).map((grupo) => (
                      <Fragment key={grupo.id}>
                        <tr className="border-b border-border bg-muted/60">
                          <th colSpan={ACCIONES.length + 1} scope="colgroup" className="px-2 py-2 text-left font-semibold text-primary">{grupo.label}</th>
                        </tr>
                        {grupo.items.map((n) => {
                      const nivel = p.permisos[n.to] ?? normalizarNivel({});
                      return (
                        <tr key={n.to} className="border-b border-border/60">
                          <td className="py-1 pr-2">{n.label}</td>
                          {ACCIONES.map((ac) => (
                            <td key={ac.id} className="px-2 py-1 text-center">
                              <Checkbox
                                className="mx-auto block"
                                checked={nivel[ac.id]}
                                disabled={ac.id !== "ver" && !nivel.ver}
                                aria-label={`${ac.label} ${n.label} para ${p.nombre}`}
                                onCheckedChange={(c) =>
                                  cambiarPermiso.mutate({ id: p.id, pantalla: n.to, nivel: normalizarNivel({ ...nivel, [ac.id]: c === true }) })
                                }
                              />
                            </td>
                          ))}
                        </tr>
                      );
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Ver: entra a la pantalla. Capturar: agrega registros nuevos. Editar: cambia lo ya registrado. Borrar: elimina registros.
                Las fechas ya registradas y el cierre de cosecha siguen siendo solo del Super Admin.
              </p>
            </details>
            <div className="rounded-md bg-muted/60 p-3">
              <div className="eyebrow mb-2">Ranchos que puede ver</div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Checkbox checked={todos} onCheckedChange={(c) => guardarAsignacion(p.id, asig, c === true)} />
                Todos los ranchos
              </label>
              {!todos && (
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {ranchos.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={asig.includes(r.id)}
                        onCheckedChange={(c) =>
                          guardarAsignacion(p.id, c ? [...asig, r.id] : asig.filter((x) => x !== r.id), todos)
                        }
                      />
                      {r.nombre}
                    </label>
                  ))}
                </div>
              )}
              {!todos && !asig.length && <p className="mt-2 text-xs text-destructive">Sin ranchos marcados no verá datos de ningún rancho.</p>}
            </div>
          </>
        )}
      </li>
    );
  };

  return (
    <AppShell
      path="/usuarios"
      eyebrow="Super Admin · accesos"
      title="Usuarios y permisos"
    >
      <div className="mb-5 flex justify-end"><Button onClick={() => setCreando(true)}><UserPlus />Crear usuario</Button></div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="mb-3 text-2xl font-semibold">
              Sin pantallas asignadas <span className="num text-base text-muted-foreground">({pendientes.length})</span>
            </h2>
            {pendientes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nadie está esperando.</p>
            ) : (
              <ul className="space-y-2">{pendientes.map(fila)}</ul>
            )}
          </section>
          <section>
            <h2 className="mb-3 text-2xl font-semibold">Con acceso</h2>
            <ul className="space-y-2">{activos.map(fila)}</ul>
          </section>
        </div>
      )}
      <CuentaDialog abierta={creando || !!personaClave} persona={personaClave} ranchos={ranchos} cerrar={() => { setCreando(false); setPersonaClave(null); }} creada={() => void qc.invalidateQueries({ queryKey: ["personas"] })} />
    </AppShell>
  );
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
  const [ranchoIds, setRanchoIds] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    try {
      const resultado = persona ? await cambiarClave({ data: { id: persona.id, password } }) : await crear({ data: { nombre, email, password, ranchoIds } });
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
        <fieldset><legend className="mb-2 text-sm font-medium">Ranchos asignados</legend><div className="grid gap-2 sm:grid-cols-2">{ranchos.map(r => <label key={r.id} className="flex items-center gap-2 text-sm"><Checkbox checked={ranchoIds.includes(r.id)} onCheckedChange={v => setRanchoIds(v === true ? [...ranchoIds, r.id] : ranchoIds.filter(x => x !== r.id))} />{r.nombre}</label>)}</div>{!ranchoIds.length && <p className="mt-2 text-xs text-muted-foreground">Las pantallas y permisos se asignan al terminar, en su tarjeta.</p>}</fieldset>
      </>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={enviando} onClick={cerrar}>Cancelar</Button><Button type="submit" disabled={enviando}>{enviando && <Loader2 className="animate-spin" />}{persona ? "Guardar contraseña" : "Crear usuario"}</Button></div>
    </form>
  </>;
}
