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

import { cultivosDelRancho, idGasto, validarGasto, validarReparto, type DatosGasto } from "./calc";
import { puedeCapturar as permiteCaptura } from "./roles";
import { useSesion } from "./sesion";
import { useCampo } from "./store";
import type { GastoRancho, RepartoCultivo } from "./types";

/**
 * Datos de la Fase 6 (gastos comunes del rancho y % de reparto entre cultivos).
 * Se guardan elemento por elemento en `registros`; en la simulación de semanas solo cambian aquí.
 */
type Col6 = "gastos" | "repartos";
const COLS: Col6[] = ["gastos", "repartos"];

interface GastosValue {
  gastos: GastoRancho[];
  repartos: RepartoCultivo[];
  /** Solo el Super Admin y el Encargado de rancho capturan gastos. */
  puedeCapturar: boolean;
  guardarGasto: (d: DatosGasto) => string | null;
  eliminarGasto: (id: string) => void;
  /** Guarda los % de un rancho; con `semana` guarda el ajuste de esa semana. */
  guardarReparto: (ranchoId: string, pct: Record<string, number>, semana?: number) => string | null;
}

const KEY = "__campoGastos__";
const g = globalThis as unknown as Record<string, Context<GastosValue | null>>;
const GastosContext: Context<GastosValue | null> = g[KEY] ?? (g[KEY] = createContext<GastosValue | null>(null));

export function GastosProvider({ children }: { children: ReactNode }) {
  const { user, role, roles, nombre } = useSesion();
  const { hoy, lotes, semanasAdelantadas } = useCampo();
  const simulando = semanasAdelantadas > 0;
  const simRef = useRef(simulando);
  simRef.current = simulando;
  const [gastos, setGastos] = useState<GastoRancho[]>([]);
  const [repartos, setRepartos] = useState<RepartoCultivo[]>([]);
  const setters = useMemo(
    () =>
      ({ gastos: setGastos, repartos: setRepartos }) as unknown as Record<
        Col6,
        (f: (xs: { id: string }[]) => { id: string }[]) => void
      >,
    [],
  );

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("registros").select("coleccion, id, data").in("coleccion", COLS);
    if (error) return;
    setGastos(data.filter((f) => f.coleccion === "gastos").map((f) => f.data as unknown as GastoRancho));
    setRepartos(data.filter((f) => f.coleccion === "repartos").map((f) => f.data as unknown as RepartoCultivo));
  }, []);

  useEffect(() => {
    if (!user || !role || simulando) return;
    void cargar();
  }, [user, role, simulando, cargar]);

  useEffect(() => {
    if (!user || !role) return;
    const canal = supabase
      .channel(`gastos-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "registros" }, (payload) => {
        if (simRef.current) return;
        const nuevo = payload.new as { coleccion?: string; id?: string; data?: unknown };
        const viejo = payload.old as { coleccion?: string; id?: string };
        const col = (nuevo.coleccion ?? viejo.coleccion) as Col6 | undefined;
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
    <T extends { id: string }>(col: Col6, item: T) => {
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

  const puedeCapturar = permiteCaptura(roles, "/gastos");

  const guardarGasto = useCallback(
    (d: DatosGasto) => {
      if (!puedeCapturar) return "Tu puesto no captura gastos de rancho.";
      const id = idGasto(d);
      const error = validarGasto(d, {
        // Volver a guardar la misma celda la actualiza: solo se avisa si sería un duplicado distinto.
        gastos: gastos.filter((g) => g.id !== id),
        reparto: repartos.find((r) => r.ranchoId === d.ranchoId),
        cultivos: cultivosDelRancho(lotes, d.ranchoId),
      });
      if (error) return error;
      poner("gastos", {
        id,
        semana: d.semana,
        ranchoId: d.ranchoId,
        cultivo: d.modo === "total" ? "*" : d.cultivo,
        concepto: d.concepto,
        monto: d.monto,
        modo: d.modo,
        detalle: d.detalle?.trim() || undefined,
        comentario: d.comentario?.trim() || undefined,
        comprobante: d.comprobante || undefined,
        por: nombre,
        fecha: hoy,
      } satisfies GastoRancho);
      return null;
    },
    [puedeCapturar, gastos, repartos, lotes, nombre, hoy, poner],
  );

  const eliminarGasto = useCallback(
    (id: string) => {
      if (!puedeCapturar) return;
      setGastos((xs) => xs.filter((x) => x.id !== id));
      if (simRef.current) return;
      void supabase
        .from("registros")
        .delete()
        .eq("coleccion", "gastos")
        .eq("id", id)
        .then(({ error }) => {
          if (error) toast.error("No se pudo eliminar el gasto.");
        });
    },
    [puedeCapturar],
  );

  const guardarReparto = useCallback(
    (ranchoId: string, pct: Record<string, number>, semana?: number) => {
      if (!puedeCapturar) return "Tu puesto no configura el reparto de gastos.";
      if (!ranchoId) return "Elige el rancho.";
      const error = validarReparto(pct);
      if (error) return `${error}.`;
      const previo = repartos.find((r) => r.ranchoId === ranchoId);
      poner("repartos", {
        id: ranchoId,
        ranchoId,
        pct,
        ajustes: semana === undefined ? previo?.ajustes : { ...(previo?.ajustes ?? {}), [String(semana)]: pct },
        por: nombre,
        fecha: hoy,
      } satisfies RepartoCultivo);
      return null;
    },
    [puedeCapturar, repartos, nombre, hoy, poner],
  );

  const value = useMemo<GastosValue>(
    () => ({ gastos, repartos, puedeCapturar, guardarGasto, eliminarGasto, guardarReparto }),
    [gastos, repartos, puedeCapturar, guardarGasto, eliminarGasto, guardarReparto],
  );
  return <GastosContext.Provider value={value}>{children}</GastosContext.Provider>;
}

export function useGastos() {
  const ctx = useContext(GastosContext);
  if (!ctx) throw new Error("useGastos debe usarse dentro de GastosProvider");
  return ctx;
}
