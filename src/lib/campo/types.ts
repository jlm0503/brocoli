/** "admin" es el Super Admin. Una persona puede tener varios puestos. */
export type Role =
  | "admin"
  | "administrador"
  | "autorizador"
  | "ingeniero"
  | "compras"
  | "almacen"
  | "direccion"
  | "encargado";

export type Familia =
  | "Insumos de preparación"
  | "Fertilizantes"
  | "Biomagenesis"
  | "Insumo"
  | "Suelo"
  | "Agroquímico"
  | "Riego"
  | "Fertilizante"
  | "Bioestimulante"
  | "Micronutriente"
  | "Fungicida"
  | "Insecticida"
  | "Herbicida"
  | "Coadyuvante";

/** Id del cultivo (catálogo editable: brócoli, coliflor, fresa…). */
export type Cultivo = string;

export interface CultivoCat {
  id: string;
  nombre: string;
}

export interface Vivero {
  id: string;
  nombre: string;
  contacto: string;
  telefono: string;
  correo: string;
}

export interface Chofer {
  id: string;
  nombre: string;
  telefono: string;
  placas: string;
}

export interface Congeladora {
  id: string;
  nombre: string;
}

export interface ProblemaCalidad {
  id: string;
  nombre: string;
}

export type ClaveParametro =
  | "plantasPorHa"
  | "costoPlantaHa"
  | "precioKg"
  | "descuentoViaje"
  | "metaKgHa"
  | "rollosCintaHa"
  | "diasSinEvaluacion";

/** Valor de un parámetro que aplica desde `desde` (yyyy-mm-dd) hasta el siguiente cambio. */
export interface Parametro {
  id: string;
  clave: ClaveParametro;
  valor: number;
  desde: string;
  /** Si trae variedad, aplica solo a esa variedad; si no, es el valor general. */
  variedadId?: string | undefined;
}

/** Variedad sembrada. Su ciclo define la fecha estimada de cosecha y hasta qué semana aplica la receta. */
export interface Variedad {
  id: string;
  nombre: string;
  cultivo: Cultivo;
  /** Días de plantación a cosecha */
  cicloDias: number;
}

export type Unidad = "kg" | "L" | "rollo";

export interface Producto {
  id: string;
  /** Código único del producto (para cruzar con otras apps). */
  codigo: string;
  nombre: string;
  familia: Familia;
  unidad: Unidad;
  /** Precio unitario estimado en MXN (el inicial, vale desde siempre). */
  precio: number;
  /** Cambios de precio con fecha de vigencia; cada uno aplica desde su fecha. */
  precios?: { desde: string; precio: number }[] | undefined;
  precioPendiente?: boolean;
}

/** Dosis por hectárea: semana de receta (-2 a 12) -> productoId -> cantidad. */
export type DosisPorSemana = Record<number, Record<string, number>>;

/** Paquete tecnológico base de un cultivo. */
export interface Receta {
  dosis: DosisPorSemana;
  /** Paquetes por rancho y tablas; la base de otros ranchos no se modifica. */
  variantes?: PaqueteTabla[] | undefined;
}

export interface PaqueteTabla {
  id: string;
  nombre: string;
  ranchoId: string;
  /** Alcance por ranchos; tablaIds vacío significa todo el rancho. */
  ranchoIds?: string[];
  /** Todos los ranchos salvo estos, incluidos los que se agreguen después. */
  excluirRanchoIds?: string[];
  tablaIds: string[];
  desde: string;
  dosis: DosisPorSemana;
}

/** Un paquete tecnológico por cultivo. */
export type Recetas = Record<Cultivo, Receta>;

/** Producto extra que solo aplica a ciertas tablas. */
export interface Adicional {
  id: string;
  ranchoId: string;
  tablaIds: string[];
  productoId: string;
  semanas: number[];
  /** Cantidad por hectárea */
  dosis: number;
  motivo: string;
}

export interface Rancho {
  id: string;
  nombre: string;
  zona: string;
}

export interface Tabla {
  id: string;
  ranchoId: string;
  nombre: string;
  hectareas: number;
  /** Punto GPS central. Sin punto = "Sin ubicación". */
  /** Retirada de operación; conserva su identidad para históricos y consumos. */
  archivada?: boolean | undefined;
  gps?: { lat: number; lng: number } | undefined;
  /** Radio de validación en metros definido por el administrador (si no, se calcula). */
  radio?: number | undefined;
}

export interface Avance {
  id: string;
  /** Fecha ISO (yyyy-mm-dd) */
  fecha: string;
  /** Semana del año en que se plantó */
  semana: number;
  ha: number;
}

/** Insumo de planeación (semana -2) asignado a un lote. Su costo cuenta cuando el pedido se entrega. */
export interface InsumoAsignado {
  productoId: string;
  cantidad: number;
  pedidoId: string;
}

/** Lote de plantación: parte de una tabla que se planea y planta junta. */
export interface Lote {
  id: string;
  /** Ej. 1-A, 1-B, 1-A2 */
  codigo: string;
  tablaId: string;
  ranchoId: string;
  ha: number;
  semanaPlaneada: number;
  ingeniero: string;
  avances: Avance[];
  /** Lote del que se arrastraron estas hectáreas. */
  origenId?: string | undefined;
  cancelado?: boolean | undefined;
  /** Insumos de planeación asignados a este lote. */
  insumos: InsumoAsignado[];
  /** Sus insumos de planeación se usaron en otro lote. */
  sinInsumos?: boolean | undefined;
  /** Copia de la receta (base + adicionales) guardada al plantarse. */
  receta?: DosisPorSemana | undefined;
  /** Inicio autorizado del paquete nuevo; no genera consumos anteriores a esta fecha. */
  recetaDesde?: string;
  variedadId: string;
  cultivo: Cultivo;
  /** Ciclo de la variedad (días) copiado al planear. */
  cicloDias: number;
  /** Fecha estimada de cosecha capturada a mano; si no, se calcula con el ciclo. */
  fechaCosecha?: string | undefined;
  /** Ya se cosechó: la tabla queda libre para el siguiente ciclo. */
  finalizado?: boolean | undefined;
  /** Carga acumulada con cosecha pendiente: requiere terminarla explícitamente, no por calendario. */
  cosechaPendienteCaptura?: boolean | undefined;
  /** Fecha en que el Super Admin o el ingeniero marcó "Cosecha terminada". */
  cosechaTerminada?: string | undefined;
  /** Plantas del lote (sugerido: ha × plantas por ha vigente al planear). */
  plantas?: number | undefined;
  /** Motivo cuando las plantas difieren más de ±10% de lo sugerido. */
  motivoPlantas?: string | undefined;
  viveroId?: string | undefined;
  /** Fecha requerida de entrega de la planta (por defecto, el lunes de la semana de plantación). */
  fechaEntregaPlanta?: string | undefined;
  /** Ciclo cerrado (Fase 5): ya no admite cambios; solo el Super Admin lo reabre. */
  cerrado?: boolean | undefined;
  /** Folio de programación del sistema anterior. */
  folioProgramacion?: string | undefined;
  /** Aplicaciones ya hechas antes de usar la app (total por producto, con su costo de origen). */
  aplicacionesPrevias?: AplicacionPrevia[] | undefined;
}

export interface AplicacionPrevia {
  nombre: string;
  categoria: string;
  unidad: string;
  cantidad: number;
  costo: number;
}

export type EstatusTabla =
  "libre" | "parcial-planeada" | "planeada" | "plantada-parcial" | "plantada" | "en-cosecha";

export type EstatusPedido = "pendiente" | "entregado" | "cancelado";

/** Pedido del paquete de planeación (semana -2) que nace al planear un lote. */
export interface PedidoPlaneacion {
  id: string;
  loteId: string;
  tablaId: string;
  ranchoId: string;
  semanaPlantacion: number;
  ha: number;
  lineas: { productoId: string; cantidad: number }[];
  cantidadesRecibidas?: Record<string, number> | undefined;
  fecha: string;
  ingeniero: string;
  urgente: boolean;
  motivo?: string | undefined;
  status: EstatusPedido;
  foto?: string | undefined;
  fechaEntrega?: string | undefined;
}

export type Semaforo = "verde" | "amarillo" | "rojo" | "gris";

export type OpcionTardia = "usar-pendientes" | "pedir-nuevos" | "sin-pendientes";

export interface PlaneacionTardia {
  id: string;
  fecha: string;
  ingeniero: string;
  ranchoId: string;
  tablaId: string;
  loteCodigo: string;
  semanasAnticipacion: number;
  opcion: OpcionTardia;
  motivo?: string | undefined;
  lotesUsados?: string[] | undefined;
}

export interface AlertaInsumos {
  id: string;
  fecha: string;
  ranchoId: string;
  tablaId: string;
  loteCodigo: string;
  items: InsumoAsignado[];
  status: "abierta" | "reubicada" | "recolectada";
  /** Lote al que se reubicaron */
  destinoLoteId?: string | undefined;
  recolecto?: string | undefined;
  fechaCierre?: string | undefined;
  foto?: string | undefined;
}

export type EstatusRecepcion = "pendiente" | "comprado" | "recibido" | "cancelado" | "parcial";

export interface Recepcion {
  status: EstatusRecepcion;
  cantidadRecibida?: number | undefined;
  foto?: string | undefined;
  fecha?: string | undefined;
}

export interface LineaDemanda {
  key: string;
  loteId: string;
  tablaId: string;
  ranchoId: string;
  productoId: string;
  /** Semana del año en que se entrega el insumo */
  semana: number;
  /** Semana de receta del lote (-2 a 12) */
  semanaReceta: number;
  cantidad: number;
}

/* ───────────── Fase 2: solicitud de planta ───────────── */

export type EstatusSolicitud = "generada" | "enviada" | "parcial" | "recibida" | "cancelada";

/** Una llegada de planta (puede haber varias si el vivero manda por partes). */
export interface EntregaPlanta {
  fecha: string;
  /** Foto del ticket del vivero. */
  foto: string;
  /** Plantas que llegaron en esta entrega, por lote. */
  recibidas: Record<string, number>;
  /** Valores vigentes el día que llegó. */
  costoPlanta: number;
  plantasPorHa: number;
  /** Valores de la variedad de cada lote el día que llegó (mandan sobre los de arriba). */
  porLote?: Record<string, { costoPlanta: number; plantasPorHa: number }> | undefined;
}

/** Renglón de la solicitud: copia de los datos del lote al generarla. */
export interface LineaSolicitud {
  loteId: string;
  ranchoId: string;
  tablaId: string;
  rancho: string;
  tabla: string;
  lote: string;
  variedad: string;
  ha: number;
  plantas: number;
  semanaPlantacion: number;
  fechaEntrega: string;
  /** Plantas que realmente llegaron, sumando todas las entregas. */
  plantasRecibidas?: number | undefined;
}

export interface SolicitudPlanta {
  id: string;
  /** Saldo inicial autorizado por parámetro, no evidencia de un pedido o ticket real. */
  cargaParametro?: { fecha: string; costoPlanta: number; plantasPorHa: number };
  /** Consecutivo: 1 → SP-0001 */
  folio: number;
  fecha: string;
  viveroId: string;
  vivero: { nombre: string; contacto: string; telefono: string; correo: string };
  lineas: LineaSolicitud[];
  ingeniero: string;
  observaciones?: string | undefined;
  status: EstatusSolicitud;
  fechaEnvio?: string | undefined;
  /** Al recibir la planta: fecha, foto de la remisión y valores vigentes ese día. */
  recepcion?:
    { fecha: string; foto: string; costoPlanta: number; plantasPorHa: number } | undefined;
  fechaCancelacion?: string | undefined;
  /** Entregas recibidas (parciales o completa). Las solicitudes antiguas solo traen `recepcion`. */
  entregas?: EntregaPlanta[] | undefined;
}

/** Movimiento de la cuenta de planta. Cargo = planta recibida; abono = descuento por viaje evaluado. */
export interface MovimientoPlanta {
  fecha: string;
  tipo: "cargo" | "abono";
  monto: number;
  plantas?: number | undefined;
  ha?: number | undefined;
  loteId?: string | undefined;
  ranchoId?: string | undefined;
  tablaId?: string | undefined;
  lote?: string | undefined;
  tabla?: string | undefined;
  folio?: number | undefined;
}

/* ───────────── Fase 3: extraordinarios, alertas a Dirección y devoluciones ───────────── */

/** Foto tomada en el momento con la cámara; guarda fecha, hora y ubicación. */
export interface FotoGps {
  ruta: string;
  /** Fecha y hora ISO en que se tomó */
  fecha: string;
  lat?: number | undefined;
  lng?: number | undefined;
  /** Precisión del GPS en metros */
  precision?: number | undefined;
}

export type Condicion = "plaga" | "gusano" | "helada" | "otra";
export type EstadoUbicacion = "valida" | "no_valida" | "no_verificable";
export type ResultadoMejora = "mejoro" | "parcial" | "no_mejoro";

export interface LineaExtra {
  productoId: string;
  porHa: number;
}

/** Costo del extraordinario cargado a una tabla (y a su lote activo) al autorizarse. */
export interface RepartoExtra {
  tablaId: string;
  loteId?: string | undefined;
  ha: number;
  monto: number;
}

export interface Extraordinario {
  id: string;
  /** EX-0001 */
  folio: string;
  ingenieroId: string;
  ingeniero: string;
  ranchoId: string;
  tablaIds: string[];
  condicion: Condicion;
  descripcion: string;
  lineas: LineaExtra[];
  diasEfecto: number;
  fechaMaxSurtido: string;
  fotos: FotoGps[];
  ubicacion: EstadoUbicacion;
  /** Fecha de la solicitud */
  fecha: string;
  status: "por_autorizar" | "autorizada" | "rechazada" | "surtida";
  autorizacion?:
    | {
        por: string;
        fecha: string;
        conCambios: boolean;
        /** Qué se cambió, en palabras */
        cambios?: string | undefined;
        motivo?: string | undefined;
        lineasOriginales?: LineaExtra[] | undefined;
      }
    | undefined;
  reparto?: RepartoExtra[] | undefined;
  surtido?: { fecha: string; por: string } | undefined;
  mejora?:
    | {
        fecha: string;
        resultado: ResultadoMejora;
        comentario: string;
        fotos: FotoGps[];
        ubicacion: EstadoUbicacion;
      }
    | undefined;
}

export interface AlertaDireccion {
  /** Id fijo por causa (ub-, ubm-, sm- + id del extraordinario) para no duplicarla. */
  id: string;
  tipo: "ubicacion" | "sin_mejora";
  extraordinarioId: string;
  ingeniero: string;
  ranchoId: string;
  tablaIds: string[];
  fecha: string;
  fotos: FotoGps[];
  status: "abierta" | "notificada";
  cierre?: { por: string; fecha: string; comentario: string } | undefined;
}

/** Lo no consumido que el Almacén general retira de una tabla en la semana. */
export interface Devolucion {
  id: string;
  semana: number;
  fecha: string;
  ranchoId: string;
  tablaId: string;
  loteId?: string | undefined;
  productoId: string;
  cantidad: number;
  /** Precio del producto en la fecha (lo que se resta del costo del lote) */
  precio: number;
  foto: string;
  por: string;
  /** Semana de entrega de la que se regresa el producto (si se eligió) */
  semanaOrigen?: number | undefined;
}

/** Ranchos asignados a un ingeniero (id = id de la persona). Sin asignación ve todos. */
export interface Asignacion {
  id: string;
  ranchoIds: string[];
}

/* ───────────── Fase 4: cosecha ───────────── */

/** Kilos de un viaje que le tocan a un lote (por ha en cosecha, o ajustado por el Super Admin). */
export interface RepartoKg {
  loteId: string;
  tablaId: string;
  ranchoId: string;
  pct: number;
  kgBrutos: number;
  kgPagables: number;
  /** Precio por kg pagable vigente en la fecha del viaje para la variedad del lote. */
  precio: number;
  importe: number;
}

export interface ProblemaEvaluado {
  problemaId: string;
  modo: "pct" | "kg";
  valor: number;
  /** Kg castigados (si se capturó %, = % × kg brutos). */
  kg: number;
  comentario: string;
}

/** Evaluación de la congeladora: aquí entran los kilos. La calidad es informativa. */
export interface EvaluacionViaje {
  fecha: string;
  por: string;
  kgBrutos: number;
  kgPagables: number;
  /** Calificación general de 1 a 10. */
  calificacion: number;
  problemas: ProblemaEvaluado[];
  /** Foto o PDF del reporte de la congeladora. */
  reporte: string;
  repartoAjustado?: "pct" | "kg" | undefined;
  reparto: RepartoKg[];
  merma: number;
  importeBruto: number;
  descuento: number;
  importeNeto: number;
}

export interface Viaje {
  id: string;
  /** Folio de la hoja */
  folio: string;
  fecha: string;
  hora: string;
  loteIds: string[];
  /** Bins que mandó el rancho de cada lote (loteId → bins). Viajes anteriores pueden no tenerlos. */
  bins?: Record<string, number> | undefined;
  /** Kg aproximados por bin al registrar la salida. */
  kgPorBin?: number | undefined;
  choferId: string;
  congeladoraId: string;
  /** Foto de la hoja (cámara o galería). */
  foto: string;
  por: string;
  /** Motivo cuando el Super Admin incluye un lote ya cerrado. */
  motivoCerrado?: string | undefined;
  status: "transito" | "evaluado";
  evaluacion?: EvaluacionViaje | undefined;
}

/** Pago real de una semana de pago (jueves a miércoles). `id` = fecha del jueves. */
export interface Liquidacion {
  id: string;
  pagado: number;
  fecha: string;
  comprobante: string;
  por: string;
}

export type EstatusLiquidacion = "abierta" | "por_cobrar" | "pagada" | "pagada_diferencia";

/** Viaje de un ciclo histórico (captura rápida o importado de Excel/CSV). */
export interface ViajeHistorico {
  fecha: string;
  folio: string;
  chofer?: string | undefined;
  placas?: string | undefined;
  descuentoPlanta?: number | undefined;
  precioKg?: number | undefined;
  kgBrutos: number;
  kgPagables: number;
  /** Calificación 1 a 10 (opcional). */
  calidad?: number | undefined;
  foto?: string | undefined;
}

export interface MovimientoBitacora {
  fecha: string;
  por: string;
  accion: "cerrado" | "cerrado_con_pendientes" | "reabierto" | "capturado";
  motivo?: string | undefined;
}

/** Foto fija de un ciclo al cerrarse (del sistema) o capturado a mano (histórico). Nunca se recalcula. */
export interface CicloCerrado {
  /** Datos originales importados; se completan sin inventar importes ni fechas de cierre. */
  importacion?: {
    archivo: string;
    archivoCosecha?: string | undefined;
    descuentoPlanta?: number | undefined;
    folios: string[];
    variedad: string;
    fechaInicioCosecha: string;
    pendiente: boolean;
    productos: { nombre: string; unidad: string; categoria: string; cantidad: number; costo: number; aplicaciones: number; observacion: string; folio: string }[];
    gastos: { concepto: ConceptoGasto; fecha: string; monto: number }[];
  } | undefined;
  /** Del sistema: id del lote. Histórico: "hist-…". */
  id: string;
  tipo: "sistema" | "historico";
  loteId?: string | undefined;
  ranchoId: string;
  tablaId: string;
  codigo: string;
  cultivo: string;
  variedadId?: string | undefined;
  ingeniero: string;
  ha: number;
  plantas: number;
  fechaPlantacion: string;
  fechaFinCosecha: string;
  viajes: number;
  kgBrutos: number;
  kgPagables: number;
  brutosHa: number;
  pagablesHa: number;
  meta: number;
  pctMeta: number;
  merma: number;
  calidad: number | null;
  ingreso: number;
  insumos: number;
  planta: number;
  /** Gastos comunes del rancho (Fase 6; por ahora 0). */
  gastosComunes: number;
  utilidadDirecta: number;
  utilidadReal: number;
  retorno: number | null;
  utilidadHa: number;
  conPendientes: boolean;
  /** Reabierto por el Super Admin: no cuenta en históricos hasta volver a cerrarse. */
  reabierto?: boolean | undefined;
  viajesHistoricos?: ViajeHistorico[] | undefined;
  /** Monto pagado por semana de pago (jueves → monto), solo históricos. */
  pagos?: Record<string, number> | undefined;
  bitacora: MovimientoBitacora[];
}

/* ───────────── Fase 6: gastos comunes por rancho y cultivo ───────────── */

/** Conceptos de gasto común del rancho. */
export type ConceptoGasto =
  | "nomina"
  | "diesel"
  | "gasolina"
  | "mano_obra_extra"
  | "mantenimiento"
  | "otros";

/** Gasto común capturado por semana, rancho y cultivo (o total del rancho). */
export interface GastoRancho {
  /** `semana|rancho|cultivo|concepto` (y detalle cuando es "otros") */
  id: string;
  semana: number;
  ranchoId: string;
  /** Cultivo, o "*" cuando es total del rancho que se reparte por %. */
  cultivo: string;
  concepto: ConceptoGasto;
  monto: number;
  /** "directo" = monto de un cultivo; "total" = total del rancho repartido por %. */
  modo: "directo" | "total";
  /** Texto del concepto cuando es "otros". */
  detalle?: string | undefined;
  comentario?: string | undefined;
  /** Foto o PDF del comprobante. */
  comprobante?: string | undefined;
  por: string;
  fecha: string;
}

/** % de reparto entre cultivos de un rancho (deben sumar 100). */
export interface RepartoCultivo {
  /** = ranchoId */
  id: string;
  ranchoId: string;
  /** cultivo → % (suman 100) */
  pct: Record<string, number>;
  /** Ajuste de una semana concreta: semana → cultivo → %. */
  ajustes?: Record<string, Record<string, number>> | undefined;
  por: string;
  fecha: string;
}
