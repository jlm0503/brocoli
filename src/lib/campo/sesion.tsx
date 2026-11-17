import { useRouter } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Context,
  type ReactNode,
} from "react";

import { supabase } from "@/integrations/supabase/client";

import { accesoPersonalizado, normalizarNivel, puestoPrincipal, type Acceso, type NavPath, type PermisosPantalla } from "./roles";
import type { Role } from "./types";

interface SesionValue {
  /** Ya se sabe si hay sesión y qué puesto tiene. */
  lista: boolean;
  user: User | null;
  nombre: string;
  /** Puesto asignado por el administrador; null = espera aprobación. */
  role: Role | null;
  /** Puestos de la persona o su acceso personalizado por pantalla. */
  roles: Acceso;
  salir: () => Promise<void>;
  recargarPuesto: () => Promise<void>;
}

// Una sola instancia del contexto entre recargas en caliente (ver store.tsx).
const KEY = "__campoSesion__";
const g = globalThis as unknown as Record<string, Context<SesionValue | null>>;
const SesionContext: Context<SesionValue | null> =
  g[KEY] ?? (g[KEY] = createContext<SesionValue | null>(null));

export function SesionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [nombre, setNombre] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [roles, setRoles] = useState<Acceso>([]);
  const [lista, setLista] = useState(false);

  const cargarPuesto = useCallback(async (u: User | null) => {
    if (!u) {
      setRole(null);
      setRoles([]);
      setNombre("");
      return;
    }
    const [roles, perfil, permisos, asig] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", u.id),
      supabase.from("profiles").select("nombre").eq("id", u.id).maybeSingle(),
      supabase.from("permisos_pantalla").select("pantalla, ver, capturar, editar, borrar").eq("user_id", u.id),
      supabase.from("registros").select("data").eq("coleccion", "asignaciones").eq("id", u.id).maybeSingle(),
    ]);
    let mios: Acceso = (roles.data ?? []).map((r) => r.role as Role);
    const filas = permisos.data ?? [];
    // Sin puestos guardados, el acceso es el que el Super Admin marcó pantalla por pantalla.
    if (!mios.length && filas.some((f) => f.ver)) {
      const mapa: PermisosPantalla = {};
      for (const f of filas) mapa[f.pantalla as NavPath] = normalizarNivel(f);
      const todos = !!(asig.data?.data as { todos?: boolean } | null)?.todos;
      mios = accesoPersonalizado(mapa, todos);
    }
    setRoles(mios);
    setRole(puestoPrincipal(mios));
    setNombre(
      perfil.data?.nombre || (u.user_metadata?.["nombre"] as string | undefined) || u.email || "",
    );
  }, []);

  useEffect(() => {
    let vivo = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!vivo) return;
      setUser(data.user);
      await cargarPuesto(data.user);
      if (vivo) setLista(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      const u = session?.user ?? null;
      setUser(u);
      void cargarPuesto(u).then(() => setLista(true));
      void router.invalidate();
    });
    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, [cargarPuesto, router]);

  const salir = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setRoles([]);
    await router.navigate({ to: "/auth", replace: true });
  }, [router]);

  const recargarPuesto = useCallback(() => cargarPuesto(user), [cargarPuesto, user]);

  const value = useMemo(
    () => ({ lista, user, nombre, role, roles, salir, recargarPuesto }),
    [lista, user, nombre, role, roles, salir, recargarPuesto],
  );
  return <SesionContext.Provider value={value}>{children}</SesionContext.Provider>;
}

export function useSesion() {
  const ctx = useContext(SesionContext);
  if (!ctx) throw new Error("useSesion debe usarse dentro de SesionProvider");
  return ctx;
}
