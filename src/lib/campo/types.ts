export type Role = "admin" | "ingeniero" | "compras";

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
  /** Plantas del lote (sugerido: ha × plantas por ha vigente al planear). */
  plantas?: number | undefined;
  /** Motivo cuando las plantas difieren más de ±10% de lo sugerido. */
  motivoPlantas?: string | undefined;
  viveroId?: string | undefined;
  /** Fecha requerida de entrega de la planta (por defecto, el lunes de la semana de plantación). */
  fechaEntregaPlanta?: string | undefined;
}

export type EstatusTabla =
  | "libre"
  | "parcial-planeada"
  | "planeada"
  | "plantada-parcial"
  | "plantada"
  | "en-cosecha";

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
    | { fecha: string; foto: string; costoPlanta: number; plantasPorHa: number }
    | undefined;
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
