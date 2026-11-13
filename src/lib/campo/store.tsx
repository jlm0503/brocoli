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
  cerrarSemana,
  cintaPlaneacion,
  codigoDisponible,
  editarClasificacionProducto,
  repartirRecepcion,
  recibirPreparacion,
  costoPorPlanta,
  lineasSolicitud,
  lotesParaSolicitud,
  registrarEntregaPlanta,
  siguienteFolio,
  solicitudesAlCancelarLote,
  validarPlantasSolicitud,
  validarRecepcionPlanta,
  validarSolicitud,
  corregirFechasLote,
  crearLotePlantado,
  descontar,
  esPlaneacionTardia,
  fechaEnSemana,
  hoyEnMexico,
  finalizarCosechados,
  insumosEntregados,
  lineasPlaneacion,
  lotesDeTabla,
  parametroVigente,
  plantasSugeridas,
  recetaDe,
  quitarProductoPaquete,
  validarNombreCatalogo,
  validarParametro,
  validarPlantas,
  validarVariedad,
  pendientesConInsumos,
  ponerAlDia,
  recetaEfectiva,
  redondear,
  repartirAvance,
  semanaDeFecha,
  semanasAnticipacion,
  siguienteCodigo,
  sumarPorProducto,
  validarApartado,
  validarAvance,
  validarPlantacionPrevia,
  validarRancho,
  validarTabla,
  retirarTabla,
} from "./calc";
import { useSesion } from "./sesion";
import {
  COLECCIONES,
  conciliarRemotos,
  diferencias,
  porId,
  type CambioRemoto,
  type Coleccion,
  type Mapa,
} from "./sync";
import { OPERACIONES_CAMPO, puedeOperacionCampo, puedeCorregirFechas } from "./roles";
import type {
  Adicional,
  AlertaInsumos,
  Chofer,
  ClaveParametro,
  Congeladora,
  Cultivo,
  CultivoCat,
  InsumoAsignado,
  Lote,
  OpcionTardia,
  Parametro,
  PedidoPlaneacion,
  PlaneacionTardia,
  ProblemaCalidad,
  Producto,
  Rancho,
  Recetas,
  Recepcion,
  Role,
  SolicitudPlanta,
  Tabla,
  Variedad,
  Vivero,
} from "./types";

export interface OpcionesPlaneacion {
  variedadId: string;
  plantas: number;
  motivoPlantas?: string | undefined;
  viveroId?: string | undefined;
  fechaEntregaPlanta?: string | undefined;
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
  solicitudes: SolicitudPlanta[];
}

/** Catálogos sencillos que el administrador captura en Catálogos. */
export type CatalogoSimple = "cultivos" | "viveros" | "choferes" | "congeladoras" | "problemas";

export type ResolucionAlerta =
  { tipo: "reubicar"; loteId: string } | { tipo: "recolectar"; quien: string; foto: string };

interface CampoContextValue {
  ready: boolean;
  role: Role | null;
  semanaActual: number;
  hoy: string;
  productos: Producto[];
  cultivos: CultivoCat[];
  variedades: Variedad[];
  viveros: Vivero[];
  choferes: Chofer[];
  congeladoras: Congeladora[];
  problemas: ProblemaCalidad[];
  parametros: Parametro[];
  /** Valor vigente de un parámetro en la fecha de hoy (o la indicada). */
  parametro: (clave: ClaveParametro, fecha?: string, variedadId?: string) => number;
  guardarParametro: (clave: ClaveParametro, valor: number, desde: string, variedadId?: string) => string | null;
  eliminarParametro: (id: string) => void;
  agregarSimple: (
    col: CatalogoSimple,
    item: { nombre: string } & Partial<Omit<Vivero & Chofer, "id" | "nombre">>,
  ) => string | null;
  renombrarSimple: (col: CatalogoSimple, id: string, nombre: string) => string | null;
  eliminarSimple: (col: CatalogoSimple, id: string) => string | null;
  agregarVariedad: (v: Omit<Variedad, "id">) => string | null;
  editarDiasVariedad: (id: string, dias: number) => string | null;
  eliminarVariedad: (id: string) => string | null;
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
  solicitudes: SolicitudPlanta[];
  /** Genera la solicitud de planta de uno o varios lotes (mismo vivero y semana de plantación). */
  generarSolicitud: (p: {
    loteIds: string[];
    viveroId: string;
    observaciones?: string | undefined;
    /** Plantas por lote capturadas en la solicitud (por ha o total). */
    plantas?: Record<string, number> | undefined;
    /** Motivo por lote cuando las plantas difieren más de ±10% de lo sugerido. */
    motivos?: Record<string, string> | undefined;
  }) => { error: string } | { solicitud: SolicitudPlanta };
  marcarSolicitudEnviada: (id: string) => void;
  recibirPlanta: (
    id: string,
    datos: {
      recibidas: Record<string, number>;
      fecha: string;
      foto: string | undefined;
      cerrar?: boolean;
    },
  ) => string | null;
  cancelarSolicitud: (id: string) => string | null;
  setDosis: (cultivo: Cultivo, productoId: string, semana: number, valor: number, paqueteId?: string) => void;
  eliminarProductoPaquete: (cultivo: Cultivo, paqueteId: string, productoId: string) => void;
  /** Cambia el precio de un producto a partir de `desde`; lo anterior conserva su precio. */
  setPrecio: (productoId: string, precio: number, desde: string) => string | null;
  agregarProducto: (p: Omit<Producto, "id">) => string | null;
  editarProducto: (id: string, datos: Pick<Producto, "familia" | "unidad">) => string | null;
  guardarAdicional: (a: Adicional) => void;
  eliminarAdicional: (id: string) => void;
  agregarRancho: (nombre: string, zona: string) => string | null;
  eliminarRancho: (id: string) => string | null;
  agregarTabla: (t: { ranchoId: string; nombre: string; hectareas: number }) => string | null;
  eliminarTabla: (id: string) => string | null;
  reactivarTabla: (id: string) => void;
  registrarPlantacion: (p: PlantacionPrevia) => string | null;
  planearLote: (
    tablaId: string,
    semana: number,
    ha: number,
    opciones: OpcionesPlaneacion,
  ) => { error: string } | { solicitud: SolicitudPlanta | null };
  cancelarLote: (loteId: string) => void;
  /** Super Admin o ingeniero: marca el lote como "Cosecha terminada" (libera la tabla). */
  terminarCosecha: (loteId: string) => string | null;
  /** Super Admin: marca o quita el cierre de ciclo del lote. */
  marcarCerrado: (loteId: string, cerrado: boolean) => void;
  /** Solo administrador: corrige fechas de plantación (por avance) y cosecha (vacía = ciclo). */
  corregirFechas: (
    loteId: string,
    cambios: { avances: Record<string, string>; fechaCosecha?: string | undefined },
  ) => string | null;
  registrarAvance: (tablaId: string, ha: number) => string | null;
  entregarPedido: (pedidoId: string, foto: string, cantidades?: Record<string, number>) => void;
  reabrirPedido: (pedidoId: string) => void;
  recibir: (
    keys: { key: string; cantidad: number }[],
    datos: { cantidadTotal: number; cantidadPedida?: number; foto?: string },
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
const nuevoId = (p: string) =>
  `${p}-${Date.now().toString(36)}-${(++seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const RECETAS_VACIAS: Recetas = {};

interface Fila {
  coleccion: string;
  id: string;
  data: Json;
}

async function leerTodo(): Promise<Fila[]> {
  const filas: Fila[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from("registros")
      .select("coleccion, id, data")
      .order("coleccion")
      .order("id")
      .range(desde, desde + 999);
    if (error) throw error;
    filas.push(...data);
    if (data.length < 1000) return filas;
  }
}

/** Guarda en la nube lo que cambió de una colección. */
async function escribir(coleccion: Coleccion, antes: Mapa, ahora: Mapa, userId: string) {
  const { guardar, borrar } = diferencias(antes, ahora);
  if (guardar.length > 0) {
    // Explicit UPDATE avoids running INSERT guards for receipts of existing orders.
    for (const [id, data] of guardar) {
      const fila = { coleccion, id, data: JSON.parse(JSON.stringify(data)) as Json, updated_by: userId };
      const resultado = id in antes
        ? await supabase.from("registros").update(fila).eq("coleccion", coleccion).eq("id", id).select("id")
        : await supabase.from("registros").insert(fila).select("id");
      if (resultado.error) throw resultado.error;
      if (!resultado.data?.length) throw new Error("Tu puesto no puede guardar este registro.");
    }
  }
  if (borrar.length > 0) {
    const { error } = await supabase
      .from("registros")
      .delete()
      .eq("coleccion", coleccion)
      .in("id", borrar);
    if (error) throw error;
  }
}

export function CampoProvider({ children }: { children: ReactNode }) {
  const { user, role, roles, nombre, lista } = useSesion();
  const [cargado, setCargado] = useState(false);
  const [semanaActual, setSemanaActual] = useState(() => semanaDeFecha(hoyEnMexico()));
  const [hoy, setHoy] = useState(() => hoyEnMexico());
  const [productos, setProductos] = useState<Producto[]>([]);
  const [recetas, setRecetas] = useState<Recetas>(RECETAS_VACIAS);
  const [cultivos, setCultivos] = useState<CultivoCat[]>([]);
  const [variedades, setVariedades] = useState<Variedad[]>([]);
  const [viveros, setViveros] = useState<Vivero[]>([]);
  const [choferes, setChoferes] = useState<Chofer[]>([]);
  const [congeladoras, setCongeladoras] = useState<Congeladora[]>([]);
  const [problemas, setProblemas] = useState<ProblemaCalidad[]>([]);
  const [parametros, setParametros] = useState<Parametro[]>([]);
  const [adicionales, setAdicionales] = useState<Adicional[]>([]);
  const [ranchos, setRanchos] = useState<Rancho[]>([]);
  const [tablas, setTablas] = useState<Tabla[]>([]);
  const [historial, setHistorial] = useState<Instantanea[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [pedidos, setPedidos] = useState<PedidoPlaneacion[]>([]);
  const [tardias, setTardias] = useState<PlaneacionTardia[]>([]);
  const [alertas, setAlertas] = useState<AlertaInsumos[]>([]);
  const [inventarioAlmacen, setInventario] = useState<Record<string, number>>({});
  const [recepciones, setRecepciones] = useState<Record<string, Recepcion>>({});
  const [solicitudes, setSolicitudes] = useState<SolicitudPlanta[]>([]);
  const ingeniero = nombre || "Ingeniero";

  /** Lo último que se sabe guardado en la nube, por colección. */
  const guardado = useRef<Partial<Record<Coleccion, Mapa>>>({});
  /** Cambios de otras personas que la pantalla todavía no refleja, por colección. */
  const remotos = useRef<Partial<Record<Coleccion, Map<string, CambioRemoto>>>>({});
  const simulando = historial.length > 0;
  const simulandoRef = useRef(simulando);
  simulandoRef.current = simulando;

  const cargar = useCallback(async (intento = 0): Promise<void> => {
    let filas: Fila[];
    try {
      filas = await leerTodo();
    } catch {
      toast.error("No se pudieron cargar los datos. Revisa tu conexión y recarga.");
      return;
    }
    const de = <T,>(c: string) =>
      filas.filter((f) => f.coleccion === c).map((f) => f.data as unknown as T);
    const mapa = <T,>(c: string) =>
      Object.fromEntries(
        filas.filter((f) => f.coleccion === c).map((f) => [f.id, f.data as unknown as T]),
      );
    const hoyReal = hoyEnMexico();
    const semanaReal = semanaDeFecha(hoyReal);
    const semanaGuardada =
      (mapa<{ semana: number }>("sistema")["semana"]?.semana as number | undefined) ?? semanaReal;

    const datos = {
      productos: de<Producto>("productos"),
      recetas: { ...RECETAS_VACIAS, ...mapa<Recetas[Cultivo]>("recetas") } as Recetas,
      cultivos: de<CultivoCat>("cultivos"),
      variedades: de<Variedad>("variedades").sort(
        (a, b) => a.cultivo.localeCompare(b.cultivo) || a.nombre.localeCompare(b.nombre),
      ),
      viveros: de<Vivero>("viveros"),
      choferes: de<Chofer>("choferes"),
      congeladoras: de<Congeladora>("congeladoras"),
      problemas: de<ProblemaCalidad>("problemas"),
      parametros: de<Parametro>("parametros"),
      adicionales: de<Adicional>("adicionales"),
      ranchos: de<Rancho>("ranchos"),
      tablas: de<Tabla>("tablas"),
      lotes: de<Lote>("lotes"),
      pedidos: de<PedidoPlaneacion>("pedidos"),
      tardias: de<PlaneacionTardia>("tardias"),
      alertas: de<AlertaInsumos>("alertas"),
      recepciones: mapa<Recepcion>("recepciones"),
      inventario: mapa<number>("inventario"),
      solicitudes: de<SolicitudPlanta>("solicitudes"),
    };

    // Cierre de las semanas que pasaron: lo hace solo quien llegue primero.
    let lotesAlDia = datos.lotes;
    if (semanaGuardada < semanaReal && roles.includes("admin")) {
      const { data: ok } = await supabase
        .from("registros")
        .update({ data: { semana: semanaReal } })
        .eq("coleccion", "sistema")
        .eq("id", "semana")
        .eq("data->>semana", String(semanaGuardada))
        .select("id");
      if (!ok || ok.length === 0) {
        if (intento < 2) return cargar(intento + 1);
      } else {
        lotesAlDia = ponerAlDia(datos.lotes, semanaGuardada, semanaReal, () => nuevoId("lt"));
      }
    } else {
      lotesAlDia = roles.includes("admin") ? ponerAlDia(datos.lotes, semanaReal, semanaReal, () => nuevoId("lt")) : datos.lotes;
    }

    remotos.current = {};
    guardado.current = {
      productos: porId(datos.productos),
      recetas: { ...datos.recetas },
      adicionales: porId(datos.adicionales),
      ranchos: porId(datos.ranchos),
      tablas: porId(datos.tablas),
      lotes: porId(datos.lotes),
      pedidos: porId(datos.pedidos),
      tardias: porId(datos.tardias),
      alertas: porId(datos.alertas),
      recepciones: datos.recepciones,
      inventario: datos.inventario,
      cultivos: porId(datos.cultivos),
      variedades: porId(datos.variedades),
      viveros: porId(datos.viveros),
      choferes: porId(datos.choferes),
      congeladoras: porId(datos.congeladoras),
      problemas: porId(datos.problemas),
      parametros: porId(datos.parametros),
      solicitudes: porId(datos.solicitudes),
    };
    setHoy(hoyReal);
    setSemanaActual(semanaReal);
    setProductos(datos.productos);
    setRecetas(datos.recetas);
    setAdicionales(datos.adicionales);
    setRanchos(datos.ranchos);
    setTablas(datos.tablas);
    setLotes(lotesAlDia);
    setPedidos(datos.pedidos);
    setTardias(datos.tardias);
    setAlertas(datos.alertas);
    setRecepciones(datos.recepciones);
    setInventario(datos.inventario);
    setCultivos(datos.cultivos);
    setVariedades(datos.variedades);
    setViveros(datos.viveros);
    setChoferes(datos.choferes);
    setCongeladoras(datos.congeladoras);
    setProblemas(datos.problemas);
    setParametros(datos.parametros);
    setSolicitudes(datos.solicitudes);
    setCargado(true);
  }, [roles]);

  useEffect(() => {
    if (!lista) return;
    if (!user || !role) {
      setCargado(false);
      setHistorial([]);
      return;
    }
    void cargar();
  }, [lista, user, role, cargar]);

  // Guardar automáticamente lo que cambie (nunca durante la simulación de semanas).
  const activo = cargado && !simulando && !!user && !!role;
  const mapas = useMemo<Record<Coleccion, Mapa>>(
    () => ({
      productos: porId(productos),
      recetas: { ...recetas },
      adicionales: porId(adicionales),
      ranchos: porId(ranchos),
      tablas: porId(tablas),
      lotes: porId(lotes),
      pedidos: porId(pedidos),
      tardias: porId(tardias),
      alertas: porId(alertas),
      recepciones: { ...recepciones },
      inventario: { ...inventarioAlmacen },
      cultivos: porId(cultivos),
      variedades: porId(variedades),
      viveros: porId(viveros),
      choferes: porId(choferes),
      congeladoras: porId(congeladoras),
      problemas: porId(problemas),
      parametros: porId(parametros),
      solicitudes: porId(solicitudes),
    }),
    [
      productos,
      recetas,
      adicionales,
      ranchos,
      tablas,
      lotes,
      pedidos,
      tardias,
      alertas,
      recepciones,
      inventarioAlmacen,
      cultivos,
      variedades,
      viveros,
      choferes,
      congeladoras,
      problemas,
      parametros,
      solicitudes,
    ],
  );
  useEffect(() => {
    if (!activo || !user) return;
    for (const c of COLECCIONES) {
      const ahora = mapas[c];
      const pendientes = remotos.current[c];
      const antes = pendientes
        ? conciliarRemotos(guardado.current[c] ?? {}, ahora, pendientes, Date.now())
        : (guardado.current[c] ?? {});
      guardado.current[c] = antes;
      const { guardar, borrar } = diferencias(antes, ahora);
      if (guardar.length === 0 && borrar.length === 0) continue;
      guardado.current[c] = ahora;
      escribir(c, antes, ahora, user.id).catch((e: { message?: string }) => {
        toast.error(
          e?.message?.includes("Solo el administrador")
            ? "Solo el administrador puede corregir fechas."
            : "No se guardó el último cambio. Se recargan los datos.",
        );
        void cargar();
      });
    }
  }, [activo, mapas, user, cargar]);

  // Cambios de otras personas en vivo.
  useEffect(() => {
    if (!user || !role) return;
    const aplicar = (col: string, id: string, data: unknown) => {
      if (simulandoRef.current || !(COLECCIONES as readonly string[]).includes(col)) return;
      const c = col as Coleccion;
      // No se toca lo guardado aquí: se concilia cuando la pantalla ya refleja el cambio.
      (remotos.current[c] ??= new Map()).set(id, { data, llegada: Date.now() });
      const lista = <T extends { id: string }>(xs: T[]) =>
        data === undefined
          ? xs.filter((x) => x.id !== id)
          : xs.some((x) => x.id === id)
            ? xs.map((x) => (x.id === id ? (data as T) : x))
            : [...xs, data as T];
      const registro = <T,>(r: Record<string, T>) => {
        const n = { ...r };
        if (data === undefined) delete n[id];
        else n[id] = data as T;
        return n;
      };
      if (c === "productos") setProductos(lista);
      else if (c === "adicionales") setAdicionales(lista);
      else if (c === "ranchos") setRanchos(lista);
      else if (c === "tablas") setTablas(lista);
      else if (c === "lotes") setLotes(lista);
      else if (c === "pedidos") setPedidos(lista);
      else if (c === "tardias") setTardias(lista);
      else if (c === "alertas") setAlertas(lista);
      else if (c === "recepciones") setRecepciones(registro);
      else if (c === "inventario") setInventario(registro);
      else if (c === "cultivos") setCultivos(lista);
      else if (c === "variedades") setVariedades(lista);
      else if (c === "viveros") setViveros(lista);
      else if (c === "choferes") setChoferes(lista);
      else if (c === "congeladoras") setCongeladoras(lista);
      else if (c === "problemas") setProblemas(lista);
      else if (c === "parametros") setParametros(lista);
      else if (c === "solicitudes") setSolicitudes(lista);
      else if (c === "recetas")
        setRecetas(
          (r) => registro(r as unknown as Record<string, Recetas[Cultivo]>) as unknown as Recetas,
        );
    };
    const canal = supabase
      .channel(`registros-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "registros" }, (payload) => {
        const nuevo = payload.new as Partial<Fila & { updated_by: string }>;
        const viejo = payload.old as Partial<Fila>;
        if (payload.eventType === "DELETE") {
          if (viejo.coleccion && viejo.id) aplicar(viejo.coleccion, viejo.id, undefined);
          return;
        }
        if (!nuevo.coleccion || !nuevo.id || nuevo.updated_by === user.id) return;
        aplicar(nuevo.coleccion, nuevo.id, nuevo.data);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [user, role]);

  const ready = lista && (!user || !role || cargado);

  const setDosis = useCallback(
    (cultivo: Cultivo, productoId: string, semana: number, valor: number, paqueteId?: string) => {
      setRecetas((rs) => {
        const r = recetaDe(rs, cultivo);
        const dosis = Math.max(0, Number.isFinite(valor) ? valor : 0);
        if (paqueteId) return { ...rs, [cultivo]: { ...r, variantes: r.variantes?.map((p) => p.id === paqueteId ? { ...p, dosis: { ...p.dosis, [semana]: { ...p.dosis[semana], [productoId]: dosis } } } : p) } };
        return {
          ...rs,
          [cultivo]: {
            ...r,
            dosis: {
              ...r.dosis,
              [semana]: {
                ...(r.dosis[semana] ?? {}),
                [productoId]: Math.max(0, Number.isFinite(valor) ? valor : 0),
              },
            },
          },
        };
      });
    },
    [],
  );

  const eliminarProductoPaquete = useCallback((cultivo: Cultivo, paqueteId: string, productoId: string) => {
    setRecetas(rs => quitarProductoPaquete(rs, cultivo, paqueteId, productoId));
  }, []);

  const setPrecio = useCallback((productoId: string, precio: number, desde: string) => {
    if (!Number.isFinite(precio) || precio < 0) return "El precio debe ser mayor o igual a 0.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) return "Indica desde qué fecha aplica el precio.";
    setProductos((ps) =>
      ps.map((p) =>
        p.id === productoId
          ? {
              ...p,
              precios: [
                ...(p.precios ?? []).filter((c) => c.desde !== desde),
                { desde, precio },
              ].sort((a, b) => a.desde.localeCompare(b.desde)),
            }
          : p,
      ),
    );
    return null;
  }, []);

  const parametro = useCallback(
    (clave: ClaveParametro, fecha?: string, variedadId?: string) =>
      parametroVigente(parametros, clave, fecha ?? hoy, variedadId),
    [parametros, hoy],
  );

  const guardarParametro = useCallback((clave: ClaveParametro, valor: number, desde: string, variedadId?: string) => {
    const err = validarParametro(clave, valor, desde);
    if (err) return err;
    const id = variedadId ? `${clave}-${variedadId}-${desde}` : `${clave}-${desde}`;
    setParametros((ps) => [
      ...ps.filter((p) => p.id !== id),
      { id, clave, valor, desde, ...(variedadId ? { variedadId } : {}) },
    ]);
    return null;
  }, []);

  const eliminarParametro = useCallback((id: string) => {
    setParametros((ps) => ps.filter((p) => p.id !== id));
  }, []);

  const simples = useMemo(
    () =>
      ({
        cultivos: [cultivos, setCultivos],
        viveros: [viveros, setViveros],
        choferes: [choferes, setChoferes],
        congeladoras: [congeladoras, setCongeladoras],
        problemas: [problemas, setProblemas],
      }) as unknown as Record<
        CatalogoSimple,
        [
          { id: string; nombre: string }[],
          (f: (xs: { id: string; nombre: string }[]) => { id: string; nombre: string }[]) => void,
        ]
      >,
    [cultivos, viveros, choferes, congeladoras, problemas],
  );

  const agregarSimple = useCallback<CampoContextValue["agregarSimple"]>(
    (col, item) => {
      const [xs, set] = simples[col];
      const err = validarNombreCatalogo(item.nombre, xs);
      if (err) return err;
      const limpio = Object.fromEntries(
        Object.entries(item).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]),
      );
      set((ys) => [...ys, { ...limpio, nombre: item.nombre.trim(), id: nuevoId(col.slice(0, 2)) }]);
      return null;
    },
    [simples],
  );

  const renombrarSimple = useCallback<CampoContextValue["renombrarSimple"]>(
    (col, id, nombre) => {
      const [xs, set] = simples[col];
      const err = validarNombreCatalogo(nombre, xs, id);
      if (err) return err;
      set((ys) => ys.map((y) => (y.id === id ? { ...y, nombre: nombre.trim() } : y)));
      return null;
    },
    [simples],
  );

  const eliminarSimple = useCallback<CampoContextValue["eliminarSimple"]>(
    (col, id) => {
      if (
        col === "cultivos" &&
        (variedades.some((v) => v.cultivo === id) || lotes.some((l) => l.cultivo === id))
      )
        return "Este cultivo tiene variedades o lotes; no se puede eliminar.";
      if (col === "viveros" && lotes.some((l) => l.viveroId === id && !l.cancelado))
        return "Este vivero ya tiene lotes; no se puede eliminar.";
      if (col === "congeladoras" && congeladoras.length <= 1)
        return "Debe quedar al menos una congeladora.";
      simples[col][1]((ys) => ys.filter((y) => y.id !== id));
      return null;
    },
    [simples, variedades, lotes, congeladoras],
  );

  const agregarVariedad = useCallback(
    (v: Omit<Variedad, "id">) => {
      const err = validarVariedad(v, variedades, cultivos);
      if (err) return err;
      setVariedades((vs) => [...vs, { ...v, nombre: v.nombre.trim(), id: nuevoId("va") }]);
      return null;
    },
    [variedades, cultivos],
  );

  const editarDiasVariedad = useCallback(
    (id: string, dias: number) => {
      const variedad = variedades.find((v) => v.id === id);
      if (!variedad) return "No se encontró la variedad.";
      if (!Number.isInteger(dias) || dias <= 0) return "Los días a cosecha deben ser un número entero mayor que cero.";
      const err = validarVariedad({ ...variedad, cicloDias: dias }, variedades.filter((v) => v.id !== id), cultivos);
      if (err) return err;
      setVariedades((vs) => vs.map((v) => v.id === id ? { ...v, cicloDias: dias } : v));
      return null;
    },
    [variedades, cultivos],
  );

  const eliminarVariedad = useCallback(
    (id: string) => {
      if (lotes.some((l) => l.variedadId === id))
        return "Esta variedad ya tiene lotes; no se puede eliminar.";
      setVariedades((vs) => vs.filter((v) => v.id !== id));
      return null;
    },
    [lotes],
  );

  const agregarProducto = useCallback(
    (p: Omit<Producto, "id">) => {
      if (!p.nombre.trim()) return "Escribe el nombre del producto.";
      if (!codigoDisponible(productos, p.codigo))
        return `El código ${p.codigo} ya existe o está vacío.`;
      setProductos((ps) => [
        ...ps,
        { ...p, codigo: p.codigo.trim().toUpperCase(), nombre: p.nombre.trim(), id: nuevoId("pr") },
      ]);
      return null;
    },
    [productos],
  );

  const editarProducto = useCallback((id: string, datos: Pick<Producto, "familia" | "unidad">) => {
    if (!productos.some((p) => p.id === id)) return "No se encontró el producto.";
    setProductos((ps) => ps.map((p) => p.id === id ? editarClasificacionProducto(p, datos) : p));
    return null;
  }, [productos]);

  const guardarAdicional = useCallback((a: Adicional) => {
    setAdicionales((as) =>
      as.some((x) => x.id === a.id) ? as.map((x) => (x.id === a.id ? a : x)) : [...as, a],
    );
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
      if (tablas.some((t) => t.ranchoId === id))
        return "Primero elimina las tablas de este rancho.";
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
        {
          id: nuevoId("tb"),
          ranchoId: t.ranchoId,
          nombre: t.nombre.trim(),
          hectareas: redondear(t.hectareas),
        },
      ]);
      return null;
    },
    [ranchos, tablas],
  );

  const eliminarTabla = useCallback(
    (id: string) => {
      const tabla = tablas.find((t) => t.id === id);
      if (!tabla) return "Tabla no encontrada.";
      const resultado = retirarTabla(tabla, lotes);
      if ("error" in resultado) return resultado.error;
      setTablas((ts) => ts.map((t) => t.id === id ? resultado.tabla : t));
      return null;
    },
    [lotes, tablas],
  );

  const reactivarTabla = useCallback((id: string) => {
    setTablas((ts) => ts.map((t) => t.id === id ? { ...t, archivada: false } : t));
  }, []);

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
        ingeniero,
        nuevoId,
        cinta: cintaPlaneacion(
          productos,
          parametroVigente(parametros, "rollosCintaHa", p.fechaPlantacion, variedad.id),
        ),
        plantasPorHa: parametroVigente(parametros, "plantasPorHa", p.fechaPlantacion, variedad.id),
      });
      setLotes((ls) => finalizarCosechados([...ls, lote], semanaActual));
      if (pedido) setPedidos((ps) => [...ps, roles.includes("admin") ? pedido : { ...pedido, status: "pendiente", foto: undefined, fechaEntrega: undefined, cantidadesRecibidas: undefined }]);
      return null;
    },
    [
      tablas,
      variedades,
      lotes,
      hoy,
      recetas,
      adicionales,
      semanaActual,
      ingeniero,
      productos,
      parametros,
      roles,
    ],
  );

  const planearLote = useCallback<CampoContextValue["planearLote"]>(
    (tablaId, semana, ha, opciones) => {
      const fallo = (error: string) => ({ error });
      const t = tablas.find((x) => x.id === tablaId);
      if (!t) return fallo("Tabla no encontrada.");
      const variedad = variedades.find((v) => v.id === opciones.variedadId);
      if (!variedad) return fallo("Elige la variedad que se va a plantar.");
      const err = validarApartado(t, lotes, semana, ha, semanaActual);
      if (err) return fallo(err);
      const sugeridas = plantasSugeridas(
        redondear(ha),
        parametroVigente(parametros, "plantasPorHa", hoy, variedad.id),
      );
      const errPlantas = validarPlantas(opciones.plantas, sugeridas, opciones.motivoPlantas);
      if (errPlantas) return fallo(errPlantas);
      if (viveros.length > 0 && !viveros.some((v) => v.id === opciones.viveroId))
        return fallo("Elige el vivero.");
      const cinta = cintaPlaneacion(
        productos,
        parametroVigente(parametros, "rollosCintaHa", hoy, variedad.id),
      );
      const necesidad = lineasPlaneacion(
        recetaDe(recetas, variedad.cultivo, tablaId, t.ranchoId, hoy),
        adicionales,
        tablaId,
        redondear(ha),
        cinta,
      );
      // Sin paquete de planeación (p. ej. coliflor sin receta) no hay insumos que decidir.
      const tardia = esPlaneacionTardia(semana, semanaActual) && necesidad.length > 0;
      const opcion = tardia ? opciones.opcion : undefined;
      if (tardia && !opcion) return fallo("Elige qué hacer con los insumos de planeación.");
      if (opcion === "pedir-nuevos" && !opciones.motivo?.trim())
        return fallo("Escribe el motivo para pedir insumos nuevos.");

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
        return fallo("Selecciona al menos un lote pendiente para usar sus insumos.");
      for (const l of lotes)
        if (usar.has(l.id)) reasignados = [...reasignados, ...insumosEntregados(l, pedidos)];

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
              ingeniero,
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
        ingeniero,
        avances: [],
        insumos: [
          ...reasignados,
          ...(pedido?.lineas.map((x) => ({ ...x, pedidoId: pedido.id })) ?? []),
        ],
        variedadId: variedad.id,
        cultivo: variedad.cultivo,
        cicloDias: variedad.cicloDias,
        plantas: opciones.plantas,
        motivoPlantas: opciones.motivoPlantas?.trim() || undefined,
        viveroId: opciones.viveroId || undefined,
        fechaEntregaPlanta: opciones.fechaEntregaPlanta || fechaEnSemana(semana, 0),
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
            ingeniero,
            ranchoId: t.ranchoId,
            tablaId,
            loteCodigo: codigo,
            semanasAnticipacion: semanasAnticipacion(semana, semanaActual),
            opcion,
            motivo: opciones.motivo?.trim() || undefined,
            lotesUsados:
              opcion === "usar-pendientes"
                ? lotes.filter((l) => usar.has(l.id)).map((l) => l.codigo)
                : undefined,
          },
        ]);
      }
      // Con vivero, la solicitud de planta nace junto con el lote.
      const v = viveros.find((x) => x.id === nuevo.viveroId);
      const solicitud: SolicitudPlanta | null = v
        ? {
            id: nuevoId("sp"),
            folio: siguienteFolio(solicitudes),
            fecha: hoy,
            viveroId: v.id,
            vivero: {
              nombre: v.nombre,
              contacto: v.contacto ?? "",
              telefono: v.telefono ?? "",
              correo: v.correo ?? "",
            },
            lineas: lineasSolicitud([nuevo], {
              ranchos,
              tablas,
              variedades,
              plantasPorHa: parametroVigente(parametros, "plantasPorHa", hoy, variedad.id),
            }),
            ingeniero,
            status: "generada",
          }
        : null;
      if (solicitud) setSolicitudes((ss) => [...ss, solicitud]);
      return { solicitud };
    },
    [
      tablas,
      variedades,
      viveros,
      lotes,
      pedidos,
      recetas,
      adicionales,
      semanaActual,
      hoy,
      ingeniero,
      productos,
      parametros,
      solicitudes,
      ranchos,
    ],
  );

  const terminarCosecha = useCallback(
    (loteId: string) => {
      if (!roles.some((r) => r === "admin" || r === "ingeniero"))
        return "Solo el Super Admin o el ingeniero marcan la cosecha terminada.";
      const l = lotes.find((x) => x.id === loteId);
      if (!l || l.cancelado || l.avances.length === 0) return "Lote no encontrado.";
      if (l.cosechaTerminada) return "Este lote ya tiene la cosecha terminada.";
      setLotes((ls) => ls.map((x) => (x.id === loteId ? { ...x, finalizado: true, cosechaTerminada: hoy } : x)));
      return null;
    },
    [roles, lotes, hoy],
  );

  const marcarCerrado = useCallback(
    (loteId: string, cerrado: boolean) => {
      if (role !== "admin") return;
      setLotes((ls) => ls.map((x) => (x.id === loteId ? { ...x, cerrado: cerrado || undefined } : x)));
    },
    [role],
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
              .map((x) => ({
                ...x,
                cantidad: redondear(x.cantidad - (quitar.get(x.productoId) ?? 0)),
              }))
              .filter((x) => x.cantidad > 0);
            return lineas.length === 0 ? { ...p, status: "cancelado" as const } : { ...p, lineas };
          }),
        );
      }
      // Sus solicitudes de planta sin recibir se cancelan (en una consolidada solo sale este lote).
      setSolicitudes((ss) => solicitudesAlCancelarLote(ss, loteId, hoy));
      setLotes((ls) =>
        ls.map((x) => (x.id === loteId ? { ...x, cancelado: true, insumos: [] } : x)),
      );
    },
    [lotes, pedidos, hoy],
  );

  const corregirFechas = useCallback<CampoContextValue["corregirFechas"]>(
    (loteId, cambios) => {
      if (!puedeCorregirFechas(role)) return "Solo el administrador puede corregir fechas.";
      const l = lotes.find((x) => x.id === loteId);
      if (!l) return "Lote no encontrado.";
      if (l.cerrado) return "El ciclo de este lote está cerrado. Reábrelo primero.";
      const r = corregirFechasLote(l, cambios, hoy);
      if ("error" in r) return r.error;
      setLotes((ls) =>
        finalizarCosechados(
          ls.map((x) => (x.id === loteId ? r.lote : x)),
          semanaActual,
        ),
      );
      return null;
    },
    [role, lotes, hoy, semanaActual],
  );

  const registrarAvance = useCallback(
    (tablaId: string, ha: number) => {
      const deTabla = lotesDeTabla(lotes, tablaId);
      const err = validarAvance(deTabla, ha, semanaActual);
      if (err) return err;
      const reparto = new Map(
        repartirAvance(deTabla, ha, semanaActual).map((r) => [r.loteId, r.ha]),
      );
      const cinta = (l: Lote) =>
        cintaPlaneacion(productos, parametroVigente(parametros, "rollosCintaHa", hoy, l.variedadId));
      const nuevosPedidos: PedidoPlaneacion[] = [];
      setLotes((ls) =>
        ls.map((l) => {
          const h = reparto.get(l.id);
          if (!h) return l;
          let next: Lote = {
            ...l,
            // Al plantarse, el lote guarda una copia de la receta vigente.
            receta:
              l.receta ?? recetaEfectiva(recetaDe(recetas, l.cultivo, l.tablaId, l.ranchoId, hoy), adicionales, l.tablaId),
            avances: [...l.avances, { id: nuevoId("av"), fecha: hoy, semana: semanaActual, ha: h }],
          };
          const lineas = lineasPlaneacion(
            recetaDe(recetas, l.cultivo, l.tablaId, l.ranchoId, hoy),
            adicionales,
            l.tablaId,
            l.ha,
            cinta(l),
          );
          if (l.sinInsumos && l.avances.length === 0 && lineas.length > 0) {
            // Sus insumos se usaron en otro lote: al plantarse genera su propio pedido.
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
    [lotes, recetas, adicionales, semanaActual, hoy, productos, parametros],
  );

  const entregarPedido = useCallback(
    (pedidoId: string, foto: string, cantidades?: Record<string, number>) => {
      setPedidos((ps) =>
        ps.map((p) =>
          p.id === pedidoId ? { ...recibirPreparacion(p, cantidades ?? Object.fromEntries(p.lineas.map(l => [l.productoId, l.cantidad]))), foto, fechaEntrega: hoy } : p,
        ),
      );
    },
    [hoy],
  );

  const reabrirPedido = useCallback((pedidoId: string) => {
    setPedidos((ps) =>
      ps.map((p) =>
        p.id === pedidoId
          ? { ...p, status: "pendiente", cantidadesRecibidas: undefined, foto: undefined, fechaEntrega: undefined }
          : p,
      ),
    );
  }, []);

  const recibir = useCallback<CampoContextValue["recibir"]>(
    (lineas, datos) => {
      const repartidas = repartirRecepcion(lineas, datos.cantidadTotal, datos.cantidadPedida ?? lineas.reduce((s, l) => s + l.cantidad, 0));
      setRecepciones((prev) => {
        const next = { ...prev };
        for (const l of lineas) {
          next[l.key] = {
            ...repartidas[l.key],
            status: repartidas[l.key]?.status ?? "pendiente",
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
      for (const k of keys) next[k] = { ...prev[k], status };
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
            x.id === alertaId
              ? { ...x, status: "reubicada", destinoLoteId: destino.id, fechaCierre: hoy }
              : x,
          ),
        );
        return null;
      }
      if (!r.quien.trim()) return "Indica quién recolectó.";
      if (!r.foto) return "La foto es obligatoria.";
      setInventario((inv) => {
        const next = { ...inv };
        for (const i of a.items)
          next[i.productoId] = redondear((next[i.productoId] ?? 0) + i.cantidad);
        return next;
      });
      setAlertas((as) =>
        as.map((x) =>
          x.id === alertaId
            ? {
                ...x,
                status: "recolectada",
                recolecto: r.quien.trim(),
                foto: r.foto,
                fechaCierre: hoy,
              }
            : x,
        ),
      );
      return null;
    },
    [alertas, lotes, hoy],
  );

  const generarSolicitud = useCallback<CampoContextValue["generarSolicitud"]>(
    ({ loteIds, viveroId, observaciones, plantas = {}, motivos = {} }) => {
      const disponibles = lotesParaSolicitud(lotes, solicitudes);
      const seleccion = lotes.filter((l) => loteIds.includes(l.id));
      const err = validarSolicitud(seleccion, viveroId, disponibles);
      if (err) return { error: err };
      const v = viveros.find((x) => x.id === viveroId);
      if (!v) return { error: "Elige el vivero." };
      const plantasPorHa = (l: Lote) => parametroVigente(parametros, "plantasPorHa", hoy, l.variedadId);
      const errPlantas = validarPlantasSolicitud(seleccion, plantas, motivos, plantasPorHa);
      if (errPlantas) return { error: errPlantas };
      const solicitud: SolicitudPlanta = {
        id: nuevoId("sp"),
        folio: siguienteFolio(solicitudes),
        fecha: hoy,
        viveroId,
        vivero: {
          nombre: v.nombre,
          contacto: v.contacto ?? "",
          telefono: v.telefono ?? "",
          correo: v.correo ?? "",
        },
        lineas: lineasSolicitud(seleccion, { ranchos, tablas, variedades, plantasPorHa, plantas }),
        ingeniero,
        observaciones: observaciones?.trim() || undefined,
        status: "generada",
      };
      const ids = new Set(loteIds);
      // El lote se queda con su vivero y las plantas que se pidieron.
      setLotes((ls) =>
        ls.map((l) => {
          if (!ids.has(l.id)) return l;
          const linea = solicitud.lineas.find((x) => x.loteId === l.id)!;
          const motivo = motivos[l.id]?.trim();
          if (l.viveroId === viveroId && l.plantas === linea.plantas && !motivo) return l;
          return {
            ...l,
            viveroId,
            plantas: linea.plantas,
            motivoPlantas: motivo || l.motivoPlantas,
          };
        }),
      );
      setSolicitudes((ss) => [...ss, solicitud]);
      return { solicitud };
    },
    [lotes, solicitudes, viveros, parametros, hoy, ranchos, tablas, variedades, ingeniero],
  );

  const marcarSolicitudEnviada = useCallback(
    (id: string) => {
      setSolicitudes((ss) =>
        ss.map((s) =>
          s.id === id && s.status === "generada" ? { ...s, status: "enviada", fechaEnvio: hoy } : s,
        ),
      );
    },
    [hoy],
  );

  const recibirPlanta = useCallback<CampoContextValue["recibirPlanta"]>(
    (id, datos) => {
      const s = solicitudes.find((x) => x.id === id);
      if (!s || s.status === "cancelada" || s.status === "recibida")
        return "Esta solicitud ya no se puede recibir.";
      const err = validarRecepcionPlanta(datos.recibidas, s.lineas, datos.fecha, hoy, datos.foto);
      if (err) return err;
      const entrega = {
        fecha: datos.fecha,
        foto: datos.foto!,
        recibidas: datos.recibidas,
        costoPlanta: costoPorPlanta(parametros, datos.fecha),
        plantasPorHa: parametroVigente(parametros, "plantasPorHa", datos.fecha),
        porLote: Object.fromEntries(
          s.lineas.map((l) => {
            const vid = lotes.find((x) => x.id === l.loteId)?.variedadId;
            return [
              l.loteId,
              {
                costoPlanta: costoPorPlanta(parametros, datos.fecha, vid),
                plantasPorHa: parametroVigente(parametros, "plantasPorHa", datos.fecha, vid),
              },
            ];
          }),
        ),
      };
      setSolicitudes((ss) =>
        ss.map((x) => (x.id === id ? registrarEntregaPlanta(x, entrega, datos.cerrar) : x)),
      );
      return null;
    },
    [solicitudes, hoy, parametros, lotes],
  );

  const cancelarSolicitud = useCallback(
    (id: string) => {
      const s = solicitudes.find((x) => x.id === id);
      if (!s) return "Solicitud no encontrada.";
      if (s.status === "recibida") return "La planta ya se recibió; no se puede cancelar.";
      if (s.status === "parcial") {
        // Ya llegó parte: no se cancela, se cierra con lo recibido.
        setSolicitudes((ss) => ss.map((x) => (x.id === id ? { ...x, status: "recibida" } : x)));
        return null;
      }
      setSolicitudes((ss) =>
        ss.map((x) => (x.id === id ? { ...x, status: "cancelada", fechaCancelacion: hoy } : x)),
      );
      return null;
    },
    [solicitudes, hoy],
  );

  const avanzarSemana = useCallback(() => {
    setHistorial((h) => [
      ...h,
      {
        semanaActual,
        hoy,
        lotes,
        pedidos,
        tardias,
        alertas,
        inventarioAlmacen,
        recepciones,
        solicitudes,
      },
    ]);
    setLotes((ls) =>
      finalizarCosechados(
        cerrarSemana(ls, semanaActual, () => nuevoId("lt")),
        semanaActual + 1,
      ),
    );
    setSemanaActual((w) => w + 1);
    setHoy(fechaEnSemana(semanaActual + 1, 2));
  }, [
    semanaActual,
    hoy,
    lotes,
    pedidos,
    tardias,
    alertas,
    inventarioAlmacen,
    recepciones,
    solicitudes,
  ]);

  const restaurar = useCallback((i: Instantanea) => {
    setSemanaActual(i.semanaActual);
    setHoy(i.hoy);
    setLotes(i.lotes);
    setPedidos(i.pedidos);
    setTardias(i.tardias);
    setAlertas(i.alertas);
    setInventario(i.inventarioAlmacen);
    setRecepciones(i.recepciones);
    setSolicitudes(i.solicitudes);
  }, []);

  /** Termina la simulación: se vuelve a lo guardado en la nube. */
  const volverAHoy = useCallback(() => {
    if (historial.length === 0) return;
    setCargado(false);
    setHistorial([]);
    void cargar();
  }, [historial, cargar]);

  const regresarSemana = useCallback(() => {
    const ultima = historial[historial.length - 1];
    if (!ultima) return;
    if (historial.length === 1) return volverAHoy();
    restaurar(ultima);
    setHistorial((h) => h.slice(0, -1));
  }, [historial, restaurar, volverAHoy]);

  const value = useMemo<CampoContextValue>(
    () => ({
      ready,
      role,
      semanaActual,
      hoy,
      productos,
      cultivos,
      variedades,
      viveros,
      choferes,
      congeladoras,
      problemas,
      parametros,
      parametro,
      guardarParametro,
      eliminarParametro,
      agregarSimple,
      renombrarSimple,
      eliminarSimple,
      agregarVariedad,
      editarDiasVariedad,
      eliminarVariedad,
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
      solicitudes,
      generarSolicitud,
      marcarSolicitudEnviada,
      recibirPlanta,
      cancelarSolicitud,
      setDosis,
      eliminarProductoPaquete,
      setPrecio,
      agregarProducto,
      editarProducto,
      guardarAdicional,
      eliminarAdicional,
      planearLote,
      cancelarLote,
      terminarCosecha,
      marcarCerrado,
      corregirFechas,
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
      reactivarTabla,
      registrarPlantacion,
      regresarSemana,
      volverAHoy,
      semanasAdelantadas: historial.length,
    }),
    [
      ready,
      role,
      semanaActual,
      hoy,
      productos,
      cultivos,
      variedades,
      viveros,
      choferes,
      congeladoras,
      problemas,
      parametros,
      parametro,
      guardarParametro,
      eliminarParametro,
      agregarSimple,
      renombrarSimple,
      eliminarSimple,
      agregarVariedad,
      editarDiasVariedad,
      eliminarVariedad,
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
      solicitudes,
      generarSolicitud,
      marcarSolicitudEnviada,
      recibirPlanta,
      cancelarSolicitud,
      setDosis,
      eliminarProductoPaquete,
      setPrecio,
      agregarProducto,
      editarProducto,
      guardarAdicional,
      eliminarAdicional,
      planearLote,
      cancelarLote,
      terminarCosecha,
      marcarCerrado,
      corregirFechas,
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
      reactivarTabla,
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
  const { roles } = useSesion();
  if (!ctx) throw new Error("useCampo debe usarse dentro de CampoProvider");
  // Also guard calls made from dialogs or shared components, not just visible buttons.
  return new Proxy(ctx, {
    get(target, prop, receiver) {
      const valor = Reflect.get(target, prop, receiver);
      if (typeof prop !== "string" || !OPERACIONES_CAMPO[prop] || typeof valor !== "function") return valor;
      if (puedeOperacionCampo(roles, prop)) return valor;
      return () => {
        const error = "Tu puesto solo consulta esta operación.";
        toast.error(error);
        return prop === "planearLote" || prop === "generarSolicitud" ? { error } : error;
      };
    },
  });
}
