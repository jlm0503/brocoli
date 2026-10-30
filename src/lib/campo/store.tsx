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
  crearLotePlantado,
  descontar,
  esPlaneacionTardia,
  fechaEnSemana,
  finalizarCosechados,
  insumosEntregados,
  lineasPlaneacion,
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
  validarPlantacionPrevia,
  validarRancho,
  validarTabla,
} from "./calc";
import {
  ADICIONALES_INICIALES,
  ALERTAS_INICIALES,
  HOY_INICIAL,
  LOTES_INICIALES,
  PEDIDOS_INICIALES,
  PRODUCTOS_INICIALES,
  RANCHOS_INICIALES,
  RECETAS_INICIALES,
  SEMANA_INICIAL,
  TABLAS_INICIALES,
  TARDIAS_INICIALES,
  VARIEDADES,
} from "./seed";
import type {
  Adicional,
  AlertaInsumos,
  Cultivo,
  InsumoAsignado,
  Lote,
  OpcionTardia,
  PedidoPlaneacion,
  PlaneacionTardia,
  Producto,
  Rancho,
  Recetas,
  Recepcion,
  Role,
  Tabla,
  Variedad,
} from "./types";

const ROLE_KEY = "brocoli-rol";

export interface OpcionesPlaneacion {
  variedadId: string;
  opcion?: OpcionTardia | undefined;
  motivo?: string | undefined;
  /** Lotes pendientes cuyos insumos se reasignan al nuevo lote */
  usarLoteIds?: string[] | undefined;
}

export interface PlantacionPrevia {
  tablaId: string;
  ha: number;
  variedadId: string;
  fechaPlantacion: string;
  fechaCosecha?: string | undefined;
}

/** Foto del estado de operación al cerrar una semana; permite regresar en la simulación. */
interface Instantanea {
  semanaActual: number;
  hoy: string;
  lotes: Lote[];
  pedidos: PedidoPlaneacion[];
  tardias: PlaneacionTardia[];
  alertas: AlertaInsumos[];
  inventarioAlmacen: Record<string, number>;
  recepciones: Record<string, Recepcion>;
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
  variedades: Variedad[];
  recetas: Recetas;
  adicionales: Adicional[];
  ranchos: Rancho[];
  tablas: Tabla[];
  lotes: Lote[];
  pedidos: PedidoPlaneacion[];
  tardias: PlaneacionTardia[];
  alertas: AlertaInsumos[];
  inventarioAlmacen: Record<string, number>;
  recepciones: Record<string, Recepcion>;
  setDosis: (cultivo: Cultivo, productoId: string, semana: number, valor: number) => void;
  setPrecio: (productoId: string, precio: number) => void;
  agregarProducto: (p: Omit<Producto, "id">) => string | null;
  guardarAdicional: (a: Adicional) => void;
  eliminarAdicional: (id: string) => void;
  agregarRancho: (nombre: string, zona: string) => string | null;
  eliminarRancho: (id: string) => string | null;
  agregarTabla: (t: { ranchoId: string; nombre: string; hectareas: number }) => string | null;
  eliminarTabla: (id: string) => string | null;
  registrarPlantacion: (p: PlantacionPrevia) => string | null;
  planearLote: (
    tablaId: string,
    semana: number,
    ha: number,
    opciones: OpcionesPlaneacion,
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
  /** Solo prototipo: deshace el último cierre de semana. */
  regresarSemana: () => void;
  /** Solo prototipo: vuelve a la semana real del día de hoy. */
  volverAHoy: () => void;
  /** Semanas que se han adelantado en la simulación. */
  semanasAdelantadas: number;
}

// Keep one context instance across hot reloads; otherwise editing this file creates a
// new context and screens lose the provider mounted in __root ("debe usarse dentro de CampoProvider").
const CTX_KEY = "__campoContext__";
const globalCtx = globalThis as unknown as Record<string, Context<CampoContextValue | null>>;
const CampoContext: Context<CampoContextValue | null> =
  globalCtx[CTX_KEY] ?? (globalCtx[CTX_KEY] = createContext<CampoContextValue | null>(null));

let seq = 0;
const nuevoId = (p: string) => `${p}-${Date.now().toString(36)}-${++seq}`;

export function CampoProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [role, setRoleState] = useState<Role | null>(null);
  const [semanaActual, setSemanaActual] = useState(SEMANA_INICIAL);
  const [hoy, setHoy] = useState(HOY_INICIAL);
  const [productos, setProductos] = useState(PRODUCTOS_INICIALES);
  const [recetas, setRecetas] = useState(RECETAS_INICIALES);
  const [variedades] = useState(VARIEDADES);
  const [adicionales, setAdicionales] = useState(ADICIONALES_INICIALES);
  const [ranchos, setRanchos] = useState(RANCHOS_INICIALES);
  const [tablas, setTablas] = useState(TABLAS_INICIALES);
  const [historial, setHistorial] = useState<Instantanea[]>([]);
  const [lotes, setLotes] = useState(LOTES_INICIALES);
  const [pedidos, setPedidos] = useState(PEDIDOS_INICIALES);
  const [tardias, setTardias] = useState(TARDIAS_INICIALES);
  const [alertas, setAlertas] = useState(ALERTAS_INICIALES);
  const [inventarioAlmacen, setInventario] = useState<Record<string, number>>({});
  const [recepciones, setRecepciones] = useState<Record<string, Recepcion>>({});

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

  const setDosis = useCallback((cultivo: Cultivo, productoId: string, semana: number, valor: number) => {
    setRecetas((rs) => {
      const r = rs[cultivo];
      return {
        ...rs,
        [cultivo]: {
          dosis: {
            ...r.dosis,
            [semana]: { ...(r.dosis[semana] ?? {}), [productoId]: Math.max(0, Number.isFinite(valor) ? valor : 0) },
          },
        },
      };
    });
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

  const agregarRancho = useCallback(
    (nombre: string, zona: string) => {
      const err = validarRancho(nombre, ranchos);
      if (err) return err;
      setRanchos((rs) => [...rs, { id: nuevoId("ra"), nombre: nombre.trim(), zona: zona.trim() }]);
      return null;
    },
    [ranchos],
  );

  const eliminarRancho = useCallback(
    (id: string) => {
      if (tablas.some((t) => t.ranchoId === id)) return "Primero elimina las tablas de este rancho.";
      setRanchos((rs) => rs.filter((r) => r.id !== id));
      return null;
    },
    [tablas],
  );

  const agregarTabla = useCallback(
    (t: { ranchoId: string; nombre: string; hectareas: number }) => {
      const err = validarTabla(t.ranchoId, t.nombre, t.hectareas, ranchos, tablas);
      if (err) return err;
      setTablas((ts) => [
        ...ts,
        { id: nuevoId("tb"), ranchoId: t.ranchoId, nombre: t.nombre.trim(), hectareas: redondear(t.hectareas) },
      ]);
      return null;
    },
    [ranchos, tablas],
  );

  const eliminarTabla = useCallback(
    (id: string) => {
      if (lotes.some((l) => l.tablaId === id && !l.cancelado))
        return "Esta tabla ya tiene lotes; no se puede eliminar.";
      setTablas((ts) => ts.filter((t) => t.id !== id));
      setAdicionales((as) => as.map((a) => ({ ...a, tablaIds: a.tablaIds.filter((x) => x !== id) })).filter((a) => a.tablaIds.length > 0));
      return null;
    },
    [lotes],
  );

  const registrarPlantacion = useCallback(
    (p: PlantacionPrevia) => {
      const t = tablas.find((x) => x.id === p.tablaId);
      if (!t) return "Elige la tabla.";
      const variedad = variedades.find((v) => v.id === p.variedadId);
      if (!variedad) return "Elige la variedad.";
      const err = validarPlantacionPrevia(t, lotes, p.ha, p.fechaPlantacion, hoy, p.fechaCosecha);
      if (err) return err;
      const { lote, pedido } = crearLotePlantado({
        tabla: t,
        lotes,
        ha: p.ha,
        variedad,
        fechaPlantacion: p.fechaPlantacion,
        fechaCosecha: p.fechaCosecha,
        recetas,
        adicionales,
        ingeniero: "Israel",
        nuevoId,
      });
      setLotes((ls) => finalizarCosechados([...ls, lote], semanaActual));
      if (pedido) setPedidos((ps) => [...ps, pedido]);
      return null;
    },
    [tablas, variedades, lotes, hoy, recetas, adicionales, semanaActual],
  );

  const planearLote = useCallback<CampoContextValue["planearLote"]>(
    (tablaId, semana, ha, opciones) => {
      const t = tablas.find((x) => x.id === tablaId);
      if (!t) return "Tabla no encontrada.";
      const variedad = variedades.find((v) => v.id === opciones.variedadId);
      if (!variedad) return "Elige la variedad que se va a plantar.";
      const err = validarApartado(t, lotes, semana, ha, semanaActual);
      if (err) return err;
      const necesidad = lineasPlaneacion(recetas[variedad.cultivo], adicionales, tablaId, redondear(ha));
      // Sin paquete de planeación (p. ej. coliflor sin receta) no hay insumos que decidir.
      const tardia = esPlaneacionTardia(semana, semanaActual) && necesidad.length > 0;
      const opcion = tardia ? opciones.opcion : undefined;
      if (tardia && !opcion) return "Elige qué hacer con los insumos de planeación.";
      if (opcion === "pedir-nuevos" && !opciones.motivo?.trim())
        return "Escribe el motivo para pedir insumos nuevos.";

      const loteId = nuevoId("lt");
      const codigo = siguienteCodigo(t, lotes);

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
        variedadId: variedad.id,
        cultivo: variedad.cultivo,
        cicloDias: variedad.cicloDias,
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
    [tablas, variedades, lotes, pedidos, recetas, adicionales, semanaActual, hoy],
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
            receta: l.receta ?? recetaEfectiva(recetas[l.cultivo], adicionales, l.tablaId),
            avances: [...l.avances, { id: nuevoId("av"), fecha: hoy, semana: semanaActual, ha: h }],
          };
          if (l.sinInsumos && l.avances.length === 0 && lineasPlaneacion(recetas[l.cultivo], adicionales, l.tablaId, l.ha).length > 0) {
            // Sus insumos se usaron en otro lote: al plantarse genera su propio pedido.
            const lineas = lineasPlaneacion(recetas[l.cultivo], adicionales, l.tablaId, l.ha);
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
    [lotes, recetas, adicionales, semanaActual, hoy],
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
    setHistorial((h) => [
      ...h,
      { semanaActual, hoy, lotes, pedidos, tardias, alertas, inventarioAlmacen, recepciones },
    ]);
    setLotes((ls) => finalizarCosechados(cerrarSemana(ls, semanaActual, () => nuevoId("lt")), semanaActual + 1));
    setSemanaActual((w) => w + 1);
    setHoy(fechaEnSemana(semanaActual + 1, 2));
  }, [semanaActual, hoy, lotes, pedidos, tardias, alertas, inventarioAlmacen, recepciones]);

  const restaurar = useCallback((i: Instantanea) => {
    setSemanaActual(i.semanaActual);
    setHoy(i.hoy);
    setLotes(i.lotes);
    setPedidos(i.pedidos);
    setTardias(i.tardias);
    setAlertas(i.alertas);
    setInventario(i.inventarioAlmacen);
    setRecepciones(i.recepciones);
  }, []);

  const regresarSemana = useCallback(() => {
    const ultima = historial[historial.length - 1];
    if (!ultima) return;
    restaurar(ultima);
    setHistorial((h) => h.slice(0, -1));
  }, [historial, restaurar]);

  const volverAHoy = useCallback(() => {
    const primera = historial[0];
    if (!primera) return;
    restaurar(primera);
    setHistorial([]);
  }, [historial, restaurar]);

  const value = useMemo<CampoContextValue>(
    () => ({
      ready,
      role,
      setRole,
      semanaActual,
      hoy,
      productos,
      variedades,
      recetas,
      adicionales,
      ranchos,
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
      agregarRancho,
      eliminarRancho,
      agregarTabla,
      eliminarTabla,
      registrarPlantacion,
      regresarSemana,
      volverAHoy,
      semanasAdelantadas: historial.length,
    }),
    [
      ready,
      role,
      setRole,
      semanaActual,
      hoy,
      productos,
      variedades,
      recetas,
      adicionales,
      ranchos,
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
      agregarRancho,
      eliminarRancho,
      agregarTabla,
      eliminarTabla,
      registrarPlantacion,
      regresarSemana,
      volverAHoy,
      historial,
    ],
  );

  return <CampoContext.Provider value={value}>{children}</CampoContext.Provider>;
}

export function useCampo() {
  const ctx = useContext(CampoContext);
  if (!ctx) throw new Error("useCampo debe usarse dentro de CampoProvider");
  return ctx;
}
