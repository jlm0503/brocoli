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

import {
  cerrarSemana,
  codigoDisponible,
  descontar,
  esPlaneacionTardia,
  fechaEnSemana,
  insumosEntregados,
  lineasPlaneacion,
  lineasSemana,
  lotesDeTabla,
  pendientesConInsumos,
  recetaEfectiva,
  redondear,
  repartirAvance,
  semanasAnticipacion,
  siguienteCodigo,
  sumarPorProducto,
  validarApartado,
  validarAvance,
} from "./calc";
import {
  ADICIONALES_INICIALES,
  ALERTAS_INICIALES,
  HOY_INICIAL,
  LOTES_INICIALES,
  PEDIDOS_INICIALES,
  PRODUCTOS_INICIALES,
  RECETA_INICIAL,
  SEMANA_INICIAL,
  TABLAS_INICIALES,
  TARDIAS_INICIALES,
} from "./seed";
import type {
  Adicional,
  AlertaInsumos,
  InsumoAsignado,
  Lote,
  OpcionTardia,
  PedidoPlaneacion,
  PlaneacionTardia,
  Producto,
  Receta,
  Recepcion,
  Role,
  Tabla,
} from "./types";

const ROLE_KEY = "brocoli-rol";

export interface OpcionesPlaneacion {
  opcion?: OpcionTardia | undefined;
  motivo?: string | undefined;
  /** Lotes pendientes cuyos insumos se reasignan al nuevo lote */
  usarLoteIds?: string[] | undefined;
}

export type ResolucionAlerta =
  | { tipo: "reubicar"; loteId: string }
  | { tipo: "recolectar"; quien: string; foto: string };

interface CampoContextValue {
  ready: boolean;
  role: Role | null;
  setRole: (r: Role | null) => void;
  semanaActual: number;
  hoy: string;
  productos: Producto[];
  receta: Receta;
  adicionales: Adicional[];
  tablas: Tabla[];
  lotes: Lote[];
  pedidos: PedidoPlaneacion[];
  tardias: PlaneacionTardia[];
  alertas: AlertaInsumos[];
  inventarioAlmacen: Record<string, number>;
  recepciones: Record<string, Recepcion>;
  setDosis: (productoId: string, semana: number, valor: number) => void;
  setPrecio: (productoId: string, precio: number) => void;
  agregarProducto: (p: Omit<Producto, "id">) => string | null;
  guardarAdicional: (a: Adicional) => void;
  eliminarAdicional: (id: string) => void;
  planearLote: (
    tablaId: string,
    semana: number,
    ha: number,
    opciones?: OpcionesPlaneacion,
  ) => string | null;
  cancelarLote: (loteId: string) => void;
  registrarAvance: (tablaId: string, ha: number) => string | null;
  entregarPedido: (pedidoId: string, foto: string) => void;
  reabrirPedido: (pedidoId: string) => void;
  recibir: (
    keys: { key: string; cantidad: number }[],
    datos: { cantidadTotal: number; foto?: string },
  ) => void;
  marcar: (keys: string[], status: "pendiente" | "comprado" | "cancelado") => void;
  resolverAlerta: (alertaId: string, r: ResolucionAlerta) => string | null;
  /** Solo prototipo: cierra la semana actual y pasa a la siguiente. */
  avanzarSemana: () => void;
}

// Keep one context instance across hot reloads; otherwise editing this file creates a
// new context and screens lose the provider mounted in __root ("debe usarse dentro de CampoProvider").
const CTX_KEY = "__campoContext__";
const globalCtx = globalThis as unknown as Record<string, Context<CampoContextValue | null>>;
const CampoContext: Context<CampoContextValue | null> =
  globalCtx[CTX_KEY] ?? (globalCtx[CTX_KEY] = createContext<CampoContextValue | null>(null));

let seq = 0;
const nuevoId = (p: string) => `${p}-${Date.now().toString(36)}-${++seq}`;

function recepcionesIniciales(): Record<string, Recepcion> {
  // Esta semana, El Mirador ya recibió su surtido.
  const lineas = lineasSemana(
    LOTES_INICIALES.filter((l) => l.ranchoId === "mirador"),
    RECETA_INICIAL,
    ADICIONALES_INICIALES,
    [SEMANA_INICIAL],
  );
  return Object.fromEntries(
    lineas.map((l) => [l.key, { status: "recibido" as const, fecha: "2026-10-26" }]),
  );
}

export function CampoProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [role, setRoleState] = useState<Role | null>(null);
  const [semanaActual, setSemanaActual] = useState(SEMANA_INICIAL);
  const [hoy, setHoy] = useState(HOY_INICIAL);
  const [productos, setProductos] = useState(PRODUCTOS_INICIALES);
  const [receta, setReceta] = useState(RECETA_INICIAL);
  const [adicionales, setAdicionales] = useState(ADICIONALES_INICIALES);
  const [tablas] = useState(TABLAS_INICIALES);
  const [lotes, setLotes] = useState(LOTES_INICIALES);
  const [pedidos, setPedidos] = useState(PEDIDOS_INICIALES);
  const [tardias, setTardias] = useState(TARDIAS_INICIALES);
  const [alertas, setAlertas] = useState(ALERTAS_INICIALES);
  const [inventarioAlmacen, setInventario] = useState<Record<string, number>>({});
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

  const setDosis = useCallback((productoId: string, semana: number, valor: number) => {
    setReceta((r) => ({
      dosis: {
        ...r.dosis,
        [semana]: { ...(r.dosis[semana] ?? {}), [productoId]: Math.max(0, Number.isFinite(valor) ? valor : 0) },
      },
    }));
  }, []);

  const setPrecio = useCallback((productoId: string, precio: number) => {
    setProductos((ps) =>
      ps.map((p) => (p.id === productoId ? { ...p, precio: Math.max(0, precio || 0) } : p)),
    );
  }, []);

  const agregarProducto = useCallback(
    (p: Omit<Producto, "id">) => {
      if (!p.nombre.trim()) return "Escribe el nombre del producto.";
      if (!codigoDisponible(productos, p.codigo)) return `El código ${p.codigo} ya existe o está vacío.`;
      setProductos((ps) => [
        ...ps,
        { ...p, codigo: p.codigo.trim().toUpperCase(), nombre: p.nombre.trim(), id: nuevoId("pr") },
      ]);
      return null;
    },
    [productos],
  );

  const guardarAdicional = useCallback((a: Adicional) => {
    setAdicionales((as) => (as.some((x) => x.id === a.id) ? as.map((x) => (x.id === a.id ? a : x)) : [...as, a]));
  }, []);

  const eliminarAdicional = useCallback((id: string) => {
    setAdicionales((as) => as.filter((a) => a.id !== id));
  }, []);

  const planearLote = useCallback<CampoContextValue["planearLote"]>(
    (tablaId, semana, ha, opciones = {}) => {
      const t = tablas.find((x) => x.id === tablaId);
      if (!t) return "Tabla no encontrada.";
      const err = validarApartado(t, lotes, semana, ha, semanaActual);
      if (err) return err;
      const tardia = esPlaneacionTardia(semana, semanaActual);
      const opcion = opciones.opcion;
      if (tardia && !opcion) return "Elige qué hacer con los insumos de planeación.";
      if (opcion === "pedir-nuevos" && !opciones.motivo?.trim())
        return "Escribe el motivo para pedir insumos nuevos.";

      const loteId = nuevoId("lt");
      const codigo = siguienteCodigo(t, lotes);
      const necesidad = lineasPlaneacion(receta, adicionales, tablaId, redondear(ha));

      // Insumos reasignados desde lotes pendientes del mismo rancho
      let reasignados: InsumoAsignado[] = [];
      const usar = new Set(
        opcion === "usar-pendientes"
          ? pendientesConInsumos(lotes, pedidos, t.ranchoId, semanaActual)
              .filter((l) => opciones.usarLoteIds?.includes(l.id))
              .map((l) => l.id)
          : [],
      );
      if (opcion === "usar-pendientes" && usar.size === 0)
        return "Selecciona al menos un lote pendiente para usar sus insumos.";
      for (const l of lotes) if (usar.has(l.id)) reasignados = [...reasignados, ...insumosEntregados(l, pedidos)];

      const porPedir = opcion === "usar-pendientes" ? descontar(necesidad, reasignados) : necesidad;
      const pedido: PedidoPlaneacion | null =
        porPedir.length > 0
          ? {
              id: nuevoId("pp"),
              loteId,
              tablaId,
              ranchoId: t.ranchoId,
              semanaPlantacion: semana,
              ha: redondear(ha),
              lineas: porPedir,
              fecha: hoy,
              ingeniero: "Israel",
              urgente: opcion === "sin-pendientes",
              motivo: opcion === "pedir-nuevos" ? opciones.motivo?.trim() : undefined,
              status: "pendiente",
            }
          : null;

      const nuevo: Lote = {
        id: loteId,
        codigo,
        tablaId,
        ranchoId: t.ranchoId,
        ha: redondear(ha),
        semanaPlaneada: semana,
        ingeniero: "Israel",
        avances: [],
        insumos: [...reasignados, ...(pedido?.lineas.map((x) => ({ ...x, pedidoId: pedido.id })) ?? [])],
      };

      setLotes((ls) => [
        ...ls.map((l) => (usar.has(l.id) ? { ...l, insumos: [], sinInsumos: true } : l)),
        nuevo,
      ]);
      if (pedido) setPedidos((ps) => [...ps, pedido]);
      if (tardia && opcion) {
        setTardias((ts) => [
          ...ts,
          {
            id: nuevoId("pt"),
            fecha: hoy,
            ingeniero: "Israel",
            ranchoId: t.ranchoId,
            tablaId,
            loteCodigo: codigo,
            semanasAnticipacion: semanasAnticipacion(semana, semanaActual),
            opcion,
            motivo: opciones.motivo?.trim() || undefined,
            lotesUsados: opcion === "usar-pendientes" ? lotes.filter((l) => usar.has(l.id)).map((l) => l.codigo) : undefined,
          },
        ]);
      }
      return null;
    },
    [tablas, lotes, pedidos, receta, adicionales, semanaActual, hoy],
  );

  const cancelarLote = useCallback(
    (loteId: string) => {
      const l = lotes.find((x) => x.id === loteId);
      if (!l || l.avances.length > 0 || l.cancelado) return;
      const entregados = insumosEntregados(l, pedidos);
      const entregadoSet = new Set(entregados);
      const sinEntregar = l.insumos.filter((i) => !entregadoSet.has(i));
      if (entregados.length > 0) {
        setAlertas((as) => [
          ...as,
          {
            id: nuevoId("al"),
            fecha: hoy,
            ranchoId: l.ranchoId,
            tablaId: l.tablaId,
            loteCodigo: l.codigo,
            items: entregados,
            status: "abierta",
          },
        ]);
      }
      if (sinEntregar.length > 0) {
        // Lo que no se ha entregado se descuenta de su pedido; si queda vacío, se cancela.
        setPedidos((ps) =>
          ps.map((p) => {
            const quitar = sumarPorProducto(sinEntregar.filter((i) => i.pedidoId === p.id));
            if (quitar.size === 0) return p;
            const lineas = p.lineas
              .map((x) => ({ ...x, cantidad: redondear(x.cantidad - (quitar.get(x.productoId) ?? 0)) }))
              .filter((x) => x.cantidad > 0);
            return lineas.length === 0 ? { ...p, status: "cancelado" as const } : { ...p, lineas };
          }),
        );
      }
      setLotes((ls) => ls.map((x) => (x.id === loteId ? { ...x, cancelado: true, insumos: [] } : x)));
    },
    [lotes, pedidos, hoy],
  );

  const registrarAvance = useCallback(
    (tablaId: string, ha: number) => {
      const deTabla = lotesDeTabla(lotes, tablaId);
      const err = validarAvance(deTabla, ha, semanaActual);
      if (err) return err;
      const reparto = new Map(repartirAvance(deTabla, ha, semanaActual).map((r) => [r.loteId, r.ha]));
      const nuevosPedidos: PedidoPlaneacion[] = [];
      setLotes((ls) =>
        ls.map((l) => {
          const h = reparto.get(l.id);
          if (!h) return l;
          let next: Lote = {
            ...l,
            // Al plantarse, el lote guarda una copia de la receta vigente.
            receta: l.receta ?? recetaEfectiva(receta, adicionales, l.tablaId),
            avances: [...l.avances, { id: nuevoId("av"), fecha: hoy, semana: semanaActual, ha: h }],
          };
          if (l.sinInsumos && l.avances.length === 0) {
            // Sus insumos se usaron en otro lote: al plantarse genera su propio pedido.
            const lineas = lineasPlaneacion(receta, adicionales, l.tablaId, l.ha);
            const pedido: PedidoPlaneacion = {
              id: nuevoId("pp"),
              loteId: l.id,
              tablaId: l.tablaId,
              ranchoId: l.ranchoId,
              semanaPlantacion: semanaActual,
              ha: l.ha,
              lineas,
              fecha: hoy,
              ingeniero: l.ingeniero,
              urgente: true,
              motivo: "Sus insumos de planeación se usaron en otro lote",
              status: "pendiente",
            };
            nuevosPedidos.push(pedido);
            next = {
              ...next,
              sinInsumos: false,
              insumos: lineas.map((x) => ({ ...x, pedidoId: pedido.id })),
            };
          }
          return next;
        }),
      );
      if (nuevosPedidos.length > 0) setPedidos((ps) => [...ps, ...nuevosPedidos]);
      return null;
    },
    [lotes, receta, adicionales, semanaActual, hoy],
  );

  const entregarPedido = useCallback(
    (pedidoId: string, foto: string) => {
      setPedidos((ps) =>
        ps.map((p) => (p.id === pedidoId ? { ...p, status: "entregado", foto, fechaEntrega: hoy } : p)),
      );
    },
    [hoy],
  );

  const reabrirPedido = useCallback((pedidoId: string) => {
    setPedidos((ps) =>
      ps.map((p) =>
        p.id === pedidoId ? { ...p, status: "pendiente", foto: undefined, fechaEntrega: undefined } : p,
      ),
    );
  }, []);

  const recibir = useCallback<CampoContextValue["recibir"]>(
    (lineas, datos) => {
      const total = lineas.reduce((s, l) => s + l.cantidad, 0) || 1;
      setRecepciones((prev) => {
        const next = { ...prev };
        for (const l of lineas) {
          next[l.key] = {
            status: "recibido",
            cantidadRecibida: redondear((datos.cantidadTotal * l.cantidad) / total),
            foto: datos.foto,
            fecha: hoy,
          };
        }
        return next;
      });
    },
    [hoy],
  );

  const marcar = useCallback((keys: string[], status: "pendiente" | "comprado" | "cancelado") => {
    setRecepciones((prev) => {
      const next = { ...prev };
      for (const k of keys) next[k] = { status };
      return next;
    });
  }, []);

  const resolverAlerta = useCallback<CampoContextValue["resolverAlerta"]>(
    (alertaId, r) => {
      const a = alertas.find((x) => x.id === alertaId);
      if (!a || a.status !== "abierta") return "La alerta ya está cerrada.";
      if (r.tipo === "reubicar") {
        const destino = lotes.find((l) => l.id === r.loteId && !l.cancelado);
        if (!destino) return "Elige el lote al que se reubican.";
        setLotes((ls) =>
          ls.map((l) => (l.id === destino.id ? { ...l, insumos: [...l.insumos, ...a.items] } : l)),
        );
        setAlertas((as) =>
          as.map((x) =>
            x.id === alertaId ? { ...x, status: "reubicada", destinoLoteId: destino.id, fechaCierre: hoy } : x,
          ),
        );
        return null;
      }
      if (!r.quien.trim()) return "Indica quién recolectó.";
      if (!r.foto) return "La foto es obligatoria.";
      setInventario((inv) => {
        const next = { ...inv };
        for (const i of a.items) next[i.productoId] = redondear((next[i.productoId] ?? 0) + i.cantidad);
        return next;
      });
      setAlertas((as) =>
        as.map((x) =>
          x.id === alertaId
            ? { ...x, status: "recolectada", recolecto: r.quien.trim(), foto: r.foto, fechaCierre: hoy }
            : x,
        ),
      );
      return null;
    },
    [alertas, lotes, hoy],
  );

  const avanzarSemana = useCallback(() => {
    setLotes((ls) => cerrarSemana(ls, semanaActual, () => nuevoId("lt")));
    setSemanaActual((w) => w + 1);
    setHoy(fechaEnSemana(semanaActual + 1, 2));
  }, [semanaActual]);

  const value = useMemo<CampoContextValue>(
    () => ({
      ready,
      role,
      setRole,
      semanaActual,
      hoy,
      productos,
      receta,
      adicionales,
      tablas,
      lotes,
      pedidos,
      tardias,
      alertas,
      inventarioAlmacen,
      recepciones,
      setDosis,
      setPrecio,
      agregarProducto,
      guardarAdicional,
      eliminarAdicional,
      planearLote,
      cancelarLote,
      registrarAvance,
      entregarPedido,
      reabrirPedido,
      recibir,
      marcar,
      resolverAlerta,
      avanzarSemana,
    }),
    [
      ready,
      role,
      setRole,
      semanaActual,
      hoy,
      productos,
      receta,
      adicionales,
      tablas,
      lotes,
      pedidos,
      tardias,
      alertas,
      inventarioAlmacen,
      recepciones,
      setDosis,
      setPrecio,
      agregarProducto,
      guardarAdicional,
      eliminarAdicional,
      planearLote,
      cancelarLote,
      registrarAvance,
      entregarPedido,
      reabrirPedido,
      recibir,
      marcar,
      resolverAlerta,
      avanzarSemana,
    ],
  );

  return <CampoContext.Provider value={value}>{children}</CampoContext.Provider>;
}

export function useCampo() {
  const ctx = useContext(CampoContext);
  if (!ctx) throw new Error("useCampo debe usarse dentro de CampoProvider");
  return ctx;
}
