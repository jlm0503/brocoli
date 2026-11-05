/** "admin" es el Super Admin. Una persona puede tener varios puestos. */
export type Role =
  | "admin"
  | "administrador"
  | "autorizador"
  | "ingeniero"
  | "compras"
  | "almacen"
  | "direccion";

export type Familia =
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
}

/** Dosis por hectárea: semana de receta (-2 a 12) -> productoId -> cantidad. */
export type DosisPorSemana = Record<number, Record<string, number>>;

/** Paquete tecnológico base de un cultivo. */
export interface Receta {
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
  variedadId: string;
  cultivo: Cultivo;
  /** Ciclo de la variedad (días) copiado al planear. */
  cicloDias: number;
  /** Fecha estimada de cosecha capturada a mano; si no, se calcula con el ciclo. */
  fechaCosecha?: string | undefined;
  /** Ya se cosechó: la tabla queda libre para el siguiente ciclo. */
  finalizado?: boolean | undefined;
  /** Fecha en que el Super Admin o el ingeniero marcó "Cosecha terminada". */
  cosechaTerminada?: string | undefined;
  /** Plantas del lote (sugerido: ha × plantas por ha vigente al planear). */
  plantas?: number | undefined;
  /** Motivo cuando las plantas difieren más de ±10% de lo sugerido. */
  motivoPlantas?: string | undefined;
  viveroId?: string | undefined;
  /** Fecha requerida de entrega de la planta (por defecto, el lunes de la semana de plantación). */
  fechaEntregaPlanta?: string | undefined;
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

export type EstatusRecepcion = "pendiente" | "comprado" | "recibido" | "cancelado";

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
