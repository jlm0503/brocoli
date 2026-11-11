import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Context,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

import { KG_POR_BIN, evaluarViaje, parametroVigente, validarPago, validarSalida, viajesSinEvaluar, type DatosEvaluacion } from "./calc";
import { PERMISOS_COSECHA, tiene } from "./roles";
import { useSesion } from "./sesion";
import { useCampo } from "./store";
import type { CicloCerrado, Liquidacion, Viaje } from "./types";

/**
 * Datos de la Fase 4 (viajes de cosecha y pagos semanales). Se guardan elemento por elemento
 * en `registros`; en la simulación de semanas solo cambian aquí.
 */
type Col4 = "viajes" | "liquidaciones" | "ciclos";
const COLS: Col4[] = ["viajes", "liquidaciones", "ciclos"];

export interface DatosSalida {
  bins?: Record<string, number> | undefined;
  kgPorBin?: number | undefined;
  folio: string;
  fecha: string;
  hora: string;
  loteIds: string[];
  choferId: string;
  foto?: string | undefined;
  motivoCerrado?: string | undefined;
}

interface CosechaValue {
  viajes: Viaje[];
  liquidaciones: Liquidacion[];
  ciclos: CicloCerrado[];
  /** Super Admin: guarda (o reemplaza) un ciclo cerrado. */
  guardarCiclo: (c: CicloCerrado) => void;
  puedeViajes: boolean;
  puedeEvaluar: boolean;
  registrarSalida: (d: DatosSalida) => string | null;
  evaluar: (id: string, d: DatosEvaluacion) => string | null;
  eliminarViaje: (id: string) => void;
  guardarPago: (jueves: string, d: { pagado: number; fecha: string; comprobante?: string | undefined }) => string | null;
}

const KEY = "__campoCosecha__";
const g = globalThis as unknown as Record<string, Context<CosechaValue | null>>;
const CosechaContext: Context<CosechaValue | null> = g[KEY] ?? (g[KEY] = createContext<CosechaValue | null>(null));

export function CosechaProvider({ children }: { children: ReactNode }) {
  const { user, role, roles, nombre } = useSesion();
  const { hoy, lotes, parametros, congeladoras, semanasAdelantadas } = useCampo();
  const simulando = semanasAdelantadas > 0;
  const simRef = useRef(simulando);
  simRef.current = simulando;
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [liquidaciones, setLiqs] = useState<Liquidacion[]>([]);
  const [ciclos, setCiclos] = useState<CicloCerrado[]>([]);
  const setters = useMemo(
    () =>
      ({ viajes: setViajes, liquidaciones: setLiqs, ciclos: setCiclos }) as unknown as Record<
        Col4,
        (f: (xs: { id: string }[]) => { id: string }[]) => void
      >,
    [],
  );

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("registros").select("coleccion, id, data").in("coleccion", COLS);
    if (error) return;
    setViajes(data.filter((f) => f.coleccion === "viajes").map((f) => f.data as unknown as Viaje));
    setLiqs(data.filter((f) => f.coleccion === "liquidaciones").map((f) => f.data as unknown as Liquidacion));
    setCiclos(data.filter((f) => f.coleccion === "ciclos").map((f) => f.data as unknown as CicloCerrado));
  }, []);

  useEffect(() => {
    if (!user || !role || simulando) return;
    void cargar();
  }, [user, role, simulando, cargar]);

  useEffect(() => {
    if (!user || !role) return;
    const canal = supabase
      .channel(`cosecha-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "registros" }, (payload) => {
        if (simRef.current) return;
        const nuevo = payload.new as { coleccion?: string; id?: string; data?: unknown };
        const viejo = payload.old as { coleccion?: string; id?: string };
        const col = (nuevo.coleccion ?? viejo.coleccion) as Col4 | undefined;
        const id = nuevo.id ?? viejo.id;
        if (!col || !id || !COLS.includes(col)) return;
        const set = setters[col];
        if (payload.eventType === "DELETE") set((xs) => xs.filter((x) => x.id !== id));
        else {
          const d = nuevo.data as { id: string };
          set((xs) => (xs.some((x) => x.id === id) ? xs.map((x) => (x.id === id ? d : x)) : [...xs, d]));
        }
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [user, role, setters]);

  const poner = useCallback(
    <T extends { id: string }>(col: Col4, item: T) => {
      setters[col]((xs) => (xs.some((x) => x.id === item.id) ? xs.map((x) => (x.id === item.id ? item : x)) : [...xs, item]));
      if (simRef.current || !user) return;
      void supabase
        .from("registros")
        .upsert({ coleccion: col, id: item.id, data: JSON.parse(JSON.stringify(item)) as Json, updated_by: user.id })
        .then(({ error }) => {
          if (error) toast.error("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.");
        });
    },
    [setters, user],
  );

  const puedeViajes = tiene(roles, ...PERMISOS_COSECHA.viajes);
  const puedeEvaluar = tiene(roles, ...PERMISOS_COSECHA.evaluaciones);
  const superAdmin = roles.includes("admin");

  const registrarSalida = useCallback(
    (d: DatosSalida) => {
      if (!puedeViajes) return "Tu puesto no captura salidas de cosecha.";
      const error = validarSalida(d, lotes, viajes, hoy, superAdmin);
      if (error) return error;
      const cerrado = lotes.some((l) => d.loteIds.includes(l.id) && l.finalizado);
      poner("viajes", {
        id: `vj-${Date.now()}`,
        folio: d.folio.trim(),
        fecha: d.fecha,
        hora: d.hora,
        loteIds: d.loteIds,
        bins: Object.fromEntries(d.loteIds.map((id) => [id, d.bins?.[id] ?? 0])),
        kgPorBin: d.kgPorBin && d.kgPorBin > 0 ? d.kgPorBin : KG_POR_BIN,
        choferId: d.choferId,
        congeladoraId: congeladoras[0]?.id ?? "principal",
        foto: d.foto!,
        por: nombre,
        motivoCerrado: cerrado ? d.motivoCerrado?.trim() : undefined,
        status: "transito",
      } satisfies Viaje);
      return null;
    },
    [puedeViajes, lotes, viajes, hoy, superAdmin, congeladoras, nombre, poner],
  );

  const evaluar = useCallback(
    (id: string, d: DatosEvaluacion) => {
      if (!puedeEvaluar) return "Tu puesto no captura evaluaciones.";
      const v = viajes.find((x) => x.id === id);
      if (!v) return "No se encontró el viaje.";
      if (v.status === "evaluado") return "Este viaje ya está evaluado.";
      if (d.ajuste && !superAdmin) return "Solo el Super Admin ajusta el reparto.";
      const r = evaluarViaje(v, d, { lotes, parametros, hoy, por: nombre });
      if ("error" in r) return r.error;
      poner("viajes", { ...v, status: "evaluado", evaluacion: r.evaluacion });
      return null;
    },
    [puedeEvaluar, viajes, superAdmin, lotes, parametros, hoy, nombre, poner],
  );

  const eliminarViaje = useCallback(
    (id: string) => {
      if (!superAdmin) return;
      setViajes((xs) => xs.filter((x) => x.id !== id));
      if (simRef.current) return;
      void supabase
        .from("registros")
        .delete()
        .eq("coleccion", "viajes")
        .eq("id", id)
        .then(({ error }) => {
          if (error) toast.error("No se pudo eliminar el viaje.");
        });
    },
    [superAdmin],
  );

  const guardarPago = useCallback(
    (jueves: string, d: { pagado: number; fecha: string; comprobante?: string | undefined }) => {
      if (!superAdmin) return "Solo el Super Admin registra pagos.";
      const error = validarPago(d);
      if (error) return error;
      poner("liquidaciones", { id: jueves, pagado: d.pagado, fecha: d.fecha, comprobante: d.comprobante!, por: nombre });
      return null;
    },
    [superAdmin, nombre, poner],
  );

  const guardarCiclo = useCallback(
    (c: CicloCerrado) => {
      if (superAdmin) poner("ciclos", c);
    },
    [superAdmin, poner],
  );

  const value = useMemo<CosechaValue>(
    () => ({ viajes, liquidaciones, ciclos, guardarCiclo, puedeViajes, puedeEvaluar, registrarSalida, evaluar, eliminarViaje, guardarPago }),
    [viajes, liquidaciones, ciclos, guardarCiclo, puedeViajes, puedeEvaluar, registrarSalida, evaluar, eliminarViaje, guardarPago],
  );
  return <CosechaContext.Provider value={value}>{children}</CosechaContext.Provider>;
}

export function useCosecha() {
  const ctx = useContext(CosechaContext);
  if (!ctx) throw new Error("useCosecha debe usarse dentro de CosechaProvider");
  return ctx;
}

/** Viajes en tránsito que ya pasaron los días sin evaluación del parámetro. */
export function useViajesAtrasados(): Viaje[] {
  const ctx = useContext(CosechaContext);
  const { hoy, parametros } = useCampo();
  if (!ctx) return [];
  return viajesSinEvaluar(ctx.viajes, hoy, parametroVigente(parametros, "diasSinEvaluacion", hoy));
}
