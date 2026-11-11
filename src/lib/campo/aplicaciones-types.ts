import type { Unidad } from "./types";

export interface FuenteAplicacion {
  key: string;
  loteId: string;
  tablaId: string;
  ranchoId: string;
  productoId: string;
  semana: number;
  tipo: "Receta" | "Preparación" | "Extraordinario";
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
}

export interface ContinuacionAplicacion {
  id: string;
  semanaHasta: number;
  fecha: string;
  por: string;
}