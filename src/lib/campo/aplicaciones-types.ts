import type { Unidad } from "./types";

export interface FuenteAplicacion {
  key: string;
  loteId: string;
  tablaId: string;
  ranchoId: string;
  productoId: string;
  semana: number;
  tipo: "Receta" | "Preparación" | "Extraordinario" | "Fuera de paquete";
  esperado: number;
  recibido: number;
  ha: number;
}

export interface AplicacionCampo {
  id: string;
  fuenteKey: string;
  loteId: string;
  tablaId: string;
  ranchoId: string;
  productoId: string;
  semanaOrigen: number;
  fecha: string;
  ha: number;
  cantidad: number;
  dosis: number;
  unidad: Unidad;
  por: string;
  /** Disponibilidad confirmada manualmente; no crea una compra ni altera la receta. */
  fuenteManual?: FuenteAplicacion;
  precioManual?: number;
  motivo?: string;
}

export interface ContinuacionAplicacion {
  id: string;
  semanaHasta: number;
  fecha: string;
  por: string;
}