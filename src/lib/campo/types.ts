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
  | "Herbicida";

export type Unidad = "kg" | "L" | "rollo";

export interface Producto {
  id: string;
  /** Código único del producto (para cruzar con otras apps). */
  codigo: string;
  nombre: string;
  familia: Familia;
  unidad: Unidad;
  /** Precio unitario estimado en MXN */
  precio: number;
}

/** Dosis por hectárea: semana de receta (-2 a 12) -> productoId -> cantidad. */
export type DosisPorSemana = Record<number, Record<string, number>>;

/** Paquete tecnológico base. */
export interface Receta {
  dosis: DosisPorSemana;
}

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
}

export type EstatusTabla =
  | "libre"
  | "parcial-planeada"
  | "planeada"
  | "plantada-parcial"
  | "plantada";

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
