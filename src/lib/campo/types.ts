export type Role = "admin" | "ingeniero" | "compras";

export type Familia =
  | "Fertilizante"
  | "Bioestimulante"
  | "Micronutriente"
  | "Fungicida"
  | "Insecticida"
  | "Herbicida";

export type Unidad = "kg" | "L";

export interface Producto {
  id: string;
  nombre: string;
  familia: Familia;
  unidad: Unidad;
  /** Precio unitario estimado en MXN */
  precio: number;
}

/** Paquete Tecnológico: dosis por hectárea para cada semana de vida del cultivo. */
export interface Receta {
  /** Duración del ciclo, entre 10 y 12 semanas. */
  semanas: number;
  /** productId -> dosis por ha en cada semana de cultivo (índice 0 = semana 1). Siempre 12 posiciones. */
  dosis: Record<string, number[]>;
}

export interface Avance {
  id: string;
  /** Fecha ISO (yyyy-mm-dd) */
  fecha: string;
  /** Semana del año en que se plantó */
  semana: number;
  ha: number;
}

export interface Plan {
  /** Semana del año en que se planeó plantar */
  semana: number;
  ha: number;
  ingeniero: string;
  avances: Avance[];
}

export interface Tabla {
  id: string;
  ranchoId: string;
  nombre: string;
  hectareas: number;
  plan?: Plan;
}

export interface Rancho {
  id: string;
  nombre: string;
  ubicacion: string;
}

export type EstatusTabla = "libre" | "planeada" | "plantada";

export type EstatusRecepcion = "pendiente" | "recibido" | "cancelado";

export interface Recepcion {
  status: EstatusRecepcion;
  cantidadRecibida?: number;
  foto?: string;
  fecha?: string;
}

export interface Cohorte {
  /** Semana del año en que se plantó (o se proyecta plantar) */
  semana: number;
  ha: number;
  /** true si ya se plantó; false si es un pendiente proyectado */
  real: boolean;
}

export interface LineaDemanda {
  key: string;
  tablaId: string;
  ranchoId: string;
  productoId: string;
  /** Semana del año en que se aplica el insumo */
  semana: number;
  /** Semana de vida del cultivo */
  semanaCultivo: number;
  cantidad: number;
}
