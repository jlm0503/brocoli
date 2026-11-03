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

import {
  alertasDireccionNuevas,
  costoExtraordinario,
  debeReportarMejora,
  lotesDeTabla,
  precioVigente,
  repartirPorHa,
  semanaDeFecha,
  siguienteFolioExtra,
  validarCierreAlerta,
  validarDevolucion,
  validarExtraordinario,
  validarUbicacionFotos,
} from "./calc";
import { tiene, type NavPath } from "./roles";
import { useSesion } from "./sesion";
import { useCampo } from "./store";
import type {
  AlertaDireccion,
  Asignacion,
  Condicion,
  Devolucion,
  Extraordinario,
  FotoGps,
  LineaExtra,
  ResultadoMejora,
} from "./types";

/**
 * Datos de la Fase 3 (extraordinarios, alertas a Dirección, devoluciones y ranchos por ingeniero).
 * Se guardan elemento por elemento en `registros`; en la simulación de semanas solo cambian aquí.
 */
type Col3 = "extraordinarios" | "alertas_direccion" | "devoluciones" | "asignaciones";
const COLS: Col3[] = ["extraordinarios", "alertas_direccion", "devoluciones", "asignaciones"];

interface Fase3Value {
  extraordinarios: Extraordinario[];
  alertasDireccion: AlertaDireccion[];
  devoluciones: Devolucion[];
  asignaciones: Asignacion[];
  /** Ranchos que ve la persona: un ingeniero solo los suyos (sin asignación ve todos). */
  ranchosVisibles: string[] | null;
  crearExtraordinario: (d: {
    tablaIds: string[];
    condicion: Condicion;
    descripcion: string;
    lineas: LineaExtra[];
    fotos: FotoGps[];
    diasEfecto: number;
    fechaMaxSurtido: string;
  }) => { error: string } | { ex: Extraordinario };
  autorizar: (id: string, d: { lineas: LineaExtra[]; cambios?: string | undefined }) => string | null;
  rechazar: (id: string, motivo: string) => string | null;
  surtir: (id: string) => void;
  reportarMejora: (
    id: string,
    d: { resultado: ResultadoMejora; comentario: string; fotos: FotoGps[] },
  ) => string | null;
  cerrarAlerta: (id: string, comentario: string) => string | null;
  registrarDevolucion: (d: {
    tablaId: string;
    productoId: string;
    cantidad: number;
    foto?: string | undefined;
  }) => string | null;
  eliminarDevolucion: (id: string) => void;
  guardarAsignacion: (userId: string, ranchoIds: string[]) => void;
}

const KEY = "__campoFase3__";
const g = globalThis as unknown as Record<string, Context<Fase3Value | null>>;
const Fase3Context: Context<Fase3Value | null> = g[KEY] ?? (g[KEY] = createContext<Fase3Value | null>(null));

export function Fase3Provider({ children }: { children: ReactNode }) {
  const { user, role, roles, nombre } = useSesion();
  const { hoy, tablas, lotes, productos, semanasAdelantadas, ready } = useCampo();
  const simulando = semanasAdelantadas > 0;
  const simRef = useRef(simulando);
  simRef.current = simulando;
  const [extraordinarios, setExtras] = useState<Extraordinario[]>([]);
  const [alertasDireccion, setAlertas] = useState<AlertaDireccion[]>([]);
  const [devoluciones, setDevs] = useState<Devolucion[]>([]);
  const [asignaciones, setAsigs] = useState<Asignacion[]>([]);

  const setters = useMemo(
    () =>
      ({
        extraordinarios: setExtras,
        alertas_direccion: setAlertas,
        devoluciones: setDevs,
        asignaciones: setAsigs,
      }) as Record<Col3, (f: (xs: { id: string }[]) => { id: string }[]) => void>,
    [],
  );

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("registros").select("coleccion, id, data").in("coleccion", COLS);
    if (error) return;
    const de = <T,>(c: Col3) => data.filter((f) => f.coleccion === c).map((f) => f.data as unknown as T);
    setExtras(de<Extraordinario>("extraordinarios"));
    setAlertas(de<AlertaDireccion>("alertas_direccion"));
    setDevs(de<Devolucion>("devoluciones"));
    setAsigs(de<Asignacion>("asignaciones"));
  }, []);

  // Carga inicial y al volver de la simulación ("Hoy").
  useEffect(() => {
    if (!user || !role || simulando) return;
    void cargar();
  }, [user, role, simulando, cargar]);

  // Cambios de otras personas en vivo.
  useEffect(() => {
    if (!user || !role) return;
    const canal = supabase
      .channel(`fase3-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "registros" }, (payload) => {
        if (simRef.current) return;
        const nuevo = payload.new as { coleccion?: string; id?: string; data?: unknown };
        const viejo = payload.old as { coleccion?: string; id?: string };
        const col = (nuevo.coleccion ?? viejo.coleccion) as Col3 | undefined;
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

  /** Cambia localmente y guarda en la nube (salvo en la simulación). */
  const poner = useCallback(
    <T extends { id: string }>(col: Col3, item: T) => {
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

  const quitar = useCallback(
    (col: Col3, id: string) => {
      setters[col]((xs) => xs.filter((x) => x.id !== id));
      if (simRef.current) return;
      void supabase.from("registros").delete().eq("coleccion", col).eq("id", id);
    },
    [setters],
  );

  // Alertas a Dirección: se crean solas (id fijo por causa, así varias pantallas no duplican).
  useEffect(() => {
    if (!user || !role || !ready) return;
    for (const a of alertasDireccionNuevas(extraordinarios, alertasDireccion, hoy)) poner("alertas_direccion", a);
  }, [extraordinarios, alertasDireccion, hoy, user, role, ready, poner]);

  const tablasDe = useCallback((ids: string[]) => tablas.filter((t) => ids.includes(t.id)), [tablas]);

  const crearExtraordinario: Fase3Value["crearExtraordinario"] = useCallback(
    (d) => {
      const error = validarExtraordinario(d, hoy);
      if (error) return { error };
      const ts = tablasDe(d.tablaIds);
      const ex: Extraordinario = {
        id: `ex-${Date.now()}`,
        folio: siguienteFolioExtra(extraordinarios),
        ingenieroId: user?.id ?? "",
        ingeniero: nombre,
        ranchoId: ts[0]?.ranchoId ?? "",
        tablaIds: d.tablaIds,
        condicion: d.condicion,
        descripcion: d.descripcion.trim(),
        lineas: d.lineas,
        diasEfecto: d.diasEfecto,
        fechaMaxSurtido: d.fechaMaxSurtido,
        fotos: d.fotos,
        ubicacion: validarUbicacionFotos(d.fotos, ts),
        fecha: hoy,
        status: "por_autorizar",
      };
      poner("extraordinarios", ex);
      return { ex };
    },
    [hoy, tablasDe, extraordinarios, user, nombre, poner],
  );

  const autorizar: Fase3Value["autorizar"] = useCallback(
    (id, d) => {
      const ex = extraordinarios.find((e) => e.id === id);
      if (!ex || ex.status !== "por_autorizar") return "Esta solicitud ya no está por autorizar.";
      if (d.lineas.length === 0 || d.lineas.some((l) => !l.productoId || !(l.porHa > 0)))
        return "Cada producto necesita su cantidad por ha.";
      const conCambios = JSON.stringify(d.lineas) !== JSON.stringify(ex.lineas);
      if (conCambios && !d.cambios?.trim()) return "Explica al ingeniero qué cambiaste.";
      const ts = tablasDe(ex.tablaIds);
      const costo = costoExtraordinario(d.lineas, ts, productos, hoy);
      poner("extraordinarios", {
        ...ex,
        lineas: d.lineas,
        status: "autorizada",
        autorizacion: {
          por: nombre,
          fecha: hoy,
          conCambios,
          cambios: conCambios ? d.cambios?.trim() : undefined,
          lineasOriginales: conCambios ? ex.lineas : undefined,
        },
        reparto: repartirPorHa(costo, ts, lotes),
      });
      return null;
    },
    [extraordinarios, tablasDe, productos, hoy, nombre, lotes, poner],
  );

  const rechazar: Fase3Value["rechazar"] = useCallback(
    (id, motivo) => {
      const ex = extraordinarios.find((e) => e.id === id);
      if (!ex || ex.status !== "por_autorizar") return "Esta solicitud ya no está por autorizar.";
      if (!motivo.trim()) return "Escribe el motivo del rechazo.";
      poner("extraordinarios", {
        ...ex,
        status: "rechazada",
        autorizacion: { por: nombre, fecha: hoy, conCambios: false, motivo: motivo.trim() },
      });
      return null;
    },
    [extraordinarios, nombre, hoy, poner],
  );

  const surtir = useCallback(
    (id: string) => {
      const ex = extraordinarios.find((e) => e.id === id);
      if (!ex || ex.status !== "autorizada") return;
      poner("extraordinarios", { ...ex, status: "surtida", surtido: { fecha: hoy, por: nombre } });
    },
    [extraordinarios, hoy, nombre, poner],
  );

  const reportarMejora: Fase3Value["reportarMejora"] = useCallback(
    (id, d) => {
      const ex = extraordinarios.find((e) => e.id === id);
      if (!ex) return "No se encontró la solicitud.";
      if (d.fotos.length < 3) return "Toma al menos 3 fotos con la cámara.";
      if (!d.comentario.trim()) return "Escribe un comentario.";
      poner("extraordinarios", {
        ...ex,
        mejora: {
          fecha: hoy,
          resultado: d.resultado,
          comentario: d.comentario.trim(),
          fotos: d.fotos,
          ubicacion: validarUbicacionFotos(d.fotos, tablasDe(ex.tablaIds)),
        },
      });
      return null;
    },
    [extraordinarios, hoy, tablasDe, poner],
  );

  const cerrarAlerta: Fase3Value["cerrarAlerta"] = useCallback(
    (id, comentario) => {
      const error = validarCierreAlerta(comentario);
      if (error) return error;
      const a = alertasDireccion.find((x) => x.id === id);
      if (!a) return "No se encontró la alerta.";
      poner("alertas_direccion", {
        ...a,
        status: "notificada",
        cierre: { por: nombre, fecha: hoy, comentario: comentario.trim() },
      });
      return null;
    },
    [alertasDireccion, nombre, hoy, poner],
  );

  const registrarDevolucion: Fase3Value["registrarDevolucion"] = useCallback(
    (d) => {
      const error = validarDevolucion(d);
      if (error) return error;
      const t = tablas.find((x) => x.id === d.tablaId);
      const p = productos.find((x) => x.id === d.productoId);
      if (!t || !p) return "Tabla o producto no encontrado.";
      const lote = lotesDeTabla(lotes, t.id).filter((l) => l.avances.length > 0).pop();
      poner("devoluciones", {
        id: `dev-${Date.now()}`,
        semana: semanaDeFecha(hoy),
        fecha: hoy,
        ranchoId: t.ranchoId,
        tablaId: t.id,
        loteId: lote?.id,
        productoId: p.id,
        cantidad: d.cantidad,
        precio: precioVigente(p, hoy),
        foto: d.foto!,
        por: nombre,
      } satisfies Devolucion);
      return null;
    },
    [tablas, productos, lotes, hoy, nombre, poner],
  );

  const eliminarDevolucion = useCallback((id: string) => quitar("devoluciones", id), [quitar]);
  const guardarAsignacion = useCallback(
    (userId: string, ranchoIds: string[]) => poner("asignaciones", { id: userId, ranchoIds }),
    [poner],
  );

  const ranchosVisibles = useMemo(() => {
    if (tiene(roles, "admin", "administrador", "autorizador", "direccion", "compras", "almacen")) return null;
    const a = asignaciones.find((x) => x.id === user?.id);
    return a && a.ranchoIds.length > 0 ? a.ranchoIds : null;
  }, [roles, asignaciones, user]);

  const value = useMemo<Fase3Value>(
    () => ({
      extraordinarios,
      alertasDireccion,
      devoluciones,
      asignaciones,
      ranchosVisibles,
      crearExtraordinario,
      autorizar,
      rechazar,
      surtir,
      reportarMejora,
      cerrarAlerta,
      registrarDevolucion,
      eliminarDevolucion,
      guardarAsignacion,
    }),
    [
      extraordinarios,
      alertasDireccion,
      devoluciones,
      asignaciones,
      ranchosVisibles,
      crearExtraordinario,
      autorizar,
      rechazar,
      surtir,
      reportarMejora,
      cerrarAlerta,
      registrarDevolucion,
      eliminarDevolucion,
      guardarAsignacion,
    ],
  );
  return <Fase3Context.Provider value={value}>{children}</Fase3Context.Provider>;
}

export function useFase3() {
  const ctx = useContext(Fase3Context);
  if (!ctx) throw new Error("useFase3 debe usarse dentro de Fase3Provider");
  return ctx;
}

/** Contadores rojos del menú: lo que espera a la persona según sus puestos. */
export function useAvisos(): Partial<Record<NavPath, number>> {
  const ctx = useContext(Fase3Context);
  const { roles, user } = useSesion();
  const { hoy } = useCampo();
  if (!ctx) return {};
  const ex = ctx.extraordinarios;
  const porAutorizar = tiene(roles, "admin", "autorizador") ? ex.filter((e) => e.status === "por_autorizar").length : 0;
  const mejoras = tiene(roles, "ingeniero")
    ? ex.filter((e) => e.ingenieroId === user?.id && debeReportarMejora(e, hoy)).length
    : 0;
  return {
    "/extraordinarios": porAutorizar + mejoras,
    "/compras": ex.filter((e) => e.status === "autorizada").length,
    "/direccion": ctx.alertasDireccion.filter((a) => a.status === "abierta").length,
  };
}
