import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { CICLO_MAX, CICLO_MIN, lineasSemanas, redondear, validarApartado, validarAvance } from "./calc";
import { HOY, PRODUCTOS_INICIALES, RECETA_INICIAL, SEMANA_ACTUAL, TABLAS_INICIALES } from "./seed";
import type { Producto, Receta, Recepcion, Role, Tabla } from "./types";

const ROLE_KEY = "brocoli-rol";

interface CampoContextValue {
  ready: boolean;
  role: Role | null;
  setRole: (r: Role | null) => void;
  semanaActual: number;
  hoy: string;
  productos: Producto[];
  receta: Receta;
  tablas: Tabla[];
  recepciones: Record<string, Recepcion>;
  setCiclo: (semanas: number) => void;
  setDosis: (productoId: string, semanaIdx: number, valor: number) => void;
  setPrecio: (productoId: string, precio: number) => void;
  apartarTabla: (tablaId: string, semana: number, ha: number) => string | null;
  liberarTabla: (tablaId: string) => void;
  registrarAvance: (tablaId: string, ha: number) => string | null;
  recibir: (
    keys: { key: string; cantidad: number }[],
    datos: { cantidadTotal: number; foto?: string },
  ) => void;
  marcar: (keys: string[], status: "pendiente" | "cancelado") => void;
}

const CampoContext = createContext<CampoContextValue | null>(null);

function recepcionesIniciales(): Record<string, Recepcion> {
  // Esta semana, El Mirador ya recibió su surtido.
  const lineas = lineasSemanas(
    TABLAS_INICIALES.filter((t) => t.ranchoId === "mirador"),
    RECETA_INICIAL,
    [SEMANA_ACTUAL],
    SEMANA_ACTUAL,
  );
  return Object.fromEntries(
    lineas.map((l) => [l.key, { status: "recibido" as const, fecha: "2026-10-26" }]),
  );
}

export function CampoProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [role, setRoleState] = useState<Role | null>(null);
  const [productos, setProductos] = useState(PRODUCTOS_INICIALES);
  const [receta, setReceta] = useState(RECETA_INICIAL);
  const [tablas, setTablas] = useState(TABLAS_INICIALES);
  const [recepciones, setRecepciones] = useState(recepcionesIniciales);

  useEffect(() => {
    const saved = window.localStorage.getItem(ROLE_KEY);
    if (saved === "admin" || saved === "ingeniero" || saved === "compras") setRoleState(saved);
    setReady(true);
  }, []);

  const setRole = useCallback((r: Role | null) => {
    setRoleState(r);
    if (r) window.localStorage.setItem(ROLE_KEY, r);
    else window.localStorage.removeItem(ROLE_KEY);
  }, []);

  const setCiclo = useCallback((semanas: number) => {
    setReceta((r) => ({ ...r, semanas: Math.min(CICLO_MAX, Math.max(CICLO_MIN, semanas)) }));
  }, []);

  const setDosis = useCallback((productoId: string, idx: number, valor: number) => {
    setReceta((r) => {
      const arr = [...(r.dosis[productoId] ?? Array(12).fill(0))];
      arr[idx] = Math.max(0, Number.isFinite(valor) ? valor : 0);
      return { ...r, dosis: { ...r.dosis, [productoId]: arr } };
    });
  }, []);

  const setPrecio = useCallback((productoId: string, precio: number) => {
    setProductos((ps) =>
      ps.map((p) => (p.id === productoId ? { ...p, precio: Math.max(0, precio || 0) } : p)),
    );
  }, []);

  const apartarTabla = useCallback(
    (tablaId: string, semana: number, ha: number) => {
      const t = tablas.find((x) => x.id === tablaId);
      if (!t) return "Tabla no encontrada.";
      const err = validarApartado(t, semana, ha, SEMANA_ACTUAL);
      if (err) return err;
      setTablas((ts) =>
        ts.map((x) =>
          x.id === tablaId
            ? { ...x, plan: { semana, ha: redondear(ha), ingeniero: "Israel", avances: [] } }
            : x,
        ),
      );
      return null;
    },
    [tablas],
  );

  const liberarTabla = useCallback((tablaId: string) => {
    setTablas((ts) =>
      ts.map((x) =>
        x.id === tablaId && x.plan && x.plan.avances.length === 0 ? { ...x, plan: undefined } : x,
      ),
    );
  }, []);

  const registrarAvance = useCallback(
    (tablaId: string, ha: number) => {
      const t = tablas.find((x) => x.id === tablaId);
      if (!t) return "Tabla no encontrada.";
      const err = validarAvance(t, ha, SEMANA_ACTUAL);
      if (err) return err;
      setTablas((ts) =>
        ts.map((x) =>
          x.id === tablaId && x.plan
            ? {
                ...x,
                plan: {
                  ...x.plan,
                  avances: [
                    ...x.plan.avances,
                    { id: `av-${Date.now()}`, fecha: HOY, semana: SEMANA_ACTUAL, ha: redondear(ha) },
                  ],
                },
              }
            : x,
        ),
      );
      return null;
    },
    [tablas],
  );

  const recibir = useCallback<CampoContextValue["recibir"]>((lineas, datos) => {
    const total = lineas.reduce((s, l) => s + l.cantidad, 0) || 1;
    setRecepciones((prev) => {
      const next = { ...prev };
      for (const l of lineas) {
        next[l.key] = {
          status: "recibido",
          cantidadRecibida: redondear((datos.cantidadTotal * l.cantidad) / total),
          foto: datos.foto,
          fecha: HOY,
        };
      }
      return next;
    });
  }, []);

  const marcar = useCallback((keys: string[], status: "pendiente" | "cancelado") => {
    setRecepciones((prev) => {
      const next = { ...prev };
      for (const k of keys) next[k] = { status };
      return next;
    });
  }, []);

  const value = useMemo<CampoContextValue>(
    () => ({
      ready,
      role,
      setRole,
      semanaActual: SEMANA_ACTUAL,
      hoy: HOY,
      productos,
      receta,
      tablas,
      recepciones,
      setCiclo,
      setDosis,
      setPrecio,
      apartarTabla,
      liberarTabla,
      registrarAvance,
      recibir,
      marcar,
    }),
    [
      ready,
      role,
      setRole,
      productos,
      receta,
      tablas,
      recepciones,
      setCiclo,
      setDosis,
      setPrecio,
      apartarTabla,
      liberarTabla,
      registrarAvance,
      recibir,
      marcar,
    ],
  );

  return <CampoContext.Provider value={value}>{children}</CampoContext.Provider>;
}

export function useCampo() {
  const ctx = useContext(CampoContext);
  if (!ctx) throw new Error("useCampo debe usarse dentro de CampoProvider");
  return ctx;
}
