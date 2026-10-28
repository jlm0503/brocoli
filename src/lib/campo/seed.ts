import { inicioSemana } from "./calc";
import type { Avance, Producto, Rancho, Receta, Tabla } from "./types";

/** "Hoy" en el prototipo: miércoles 28 de octubre de 2026, semana 44. */
export const SEMANA_ACTUAL = 44;
export const HOY = "2026-10-28";

export const PRODUCTOS_INICIALES: Producto[] = [
  { id: "map", nombre: "MAP 11-52-00", familia: "Fertilizante", unidad: "kg", precio: 18 },
  { id: "urea", nombre: "Urea 46%", familia: "Fertilizante", unidad: "kg", precio: 9.5 },
  { id: "nca", nombre: "Nitrato de calcio", familia: "Fertilizante", unidad: "kg", precio: 14 },
  { id: "sk", nombre: "Sulfato de potasio", familia: "Fertilizante", unidad: "kg", precio: 22 },
  { id: "hum", nombre: "Ácido húmico", familia: "Bioestimulante", unidad: "L", precio: 85 },
  { id: "boro", nombre: "Boro 10%", familia: "Micronutriente", unidad: "L", precio: 120 },
  { id: "clo", nombre: "Clorotalonil 720", familia: "Fungicida", unidad: "L", precio: 210 },
  { id: "man", nombre: "Mancozeb 80%", familia: "Fungicida", unidad: "kg", precio: 95 },
  { id: "spi", nombre: "Spinosad", familia: "Insecticida", unidad: "L", precio: 1450 },
  { id: "imi", nombre: "Imidacloprid", familia: "Insecticida", unidad: "L", precio: 680 },
  { id: "pen", nombre: "Pendimetalina", familia: "Herbicida", unidad: "L", precio: 240 },
];

export const RECETA_INICIAL: Receta = {
  semanas: 12,
  dosis: {
    map: [50, 40, 25, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    urea: [0, 30, 40, 50, 50, 40, 30, 20, 0, 0, 0, 0],
    nca: [0, 0, 20, 25, 30, 30, 30, 25, 20, 15, 0, 0],
    sk: [0, 0, 0, 0, 20, 30, 40, 40, 35, 30, 20, 0],
    hum: [3, 3, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0],
    boro: [0, 0, 0, 0, 1, 1, 1.5, 1.5, 1, 0, 0, 0],
    clo: [0, 0, 1.5, 0, 1.5, 0, 1.5, 0, 1.5, 0, 1.5, 0],
    man: [0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 0],
    spi: [0, 0, 0, 0.2, 0, 0, 0.2, 0, 0, 0.2, 0, 0],
    imi: [0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0, 0],
    pen: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
};

export const RANCHOS: Rancho[] = [
  { id: "mirador", nombre: "El Mirador", ubicacion: "Valle de Zamora" },
  { id: "isidro", nombre: "San Isidro", ubicacion: "Tanhuato" },
  { id: "loma", nombre: "La Loma", ubicacion: "Yurécuaro" },
];

function fechaEnSemana(semana: number, dia = 1): string {
  const d = inicioSemana(semana);
  d.setUTCDate(d.getUTCDate() + dia);
  return d.toISOString().slice(0, 10);
}

let n = 0;
function av(semana: number, ha: number, dia = 1, fecha?: string): Avance {
  return { id: `av-${++n}`, semana, ha, fecha: fecha ?? fechaEnSemana(semana, dia) };
}

/** Tabla completamente plantada en una semana (en dos jornadas). */
function plantadaEn(semana: number, ha: number, ingeniero = "Israel") {
  const primera = Math.round(ha * 0.6 * 2) / 2;
  return {
    semana,
    ha,
    ingeniero,
    avances: [av(semana, primera, 0), av(semana, ha - primera, 2)],
  };
}

export const TABLAS_INICIALES: Tabla[] = [
  // El Mirador
  { id: "m01", ranchoId: "mirador", nombre: "Tabla 1", hectareas: 6, plan: plantadaEn(36, 6) },
  { id: "m02", ranchoId: "mirador", nombre: "Tabla 2", hectareas: 5, plan: plantadaEn(39, 5) },
  {
    id: "m03",
    ranchoId: "mirador",
    nombre: "Tabla 3",
    hectareas: 4,
    plan: {
      semana: 44,
      ha: 4,
      ingeniero: "Israel",
      avances: [av(44, 1, 0, "2026-10-26"), av(44, 1.5, 1, "2026-10-27")],
    },
  },
  {
    id: "m04",
    ranchoId: "mirador",
    nombre: "Tabla 4",
    hectareas: 5,
    plan: { semana: 43, ha: 5, ingeniero: "Israel", avances: [av(43, 2, 1), av(43, 1, 3)] },
  },
  {
    id: "m05",
    ranchoId: "mirador",
    nombre: "Tabla 5",
    hectareas: 4.5,
    plan: { semana: 46, ha: 4.5, ingeniero: "Israel", avances: [] },
  },
  { id: "m06", ranchoId: "mirador", nombre: "Tabla 6", hectareas: 3 },
  // San Isidro
  { id: "s01", ranchoId: "isidro", nombre: "Tabla 1", hectareas: 7, plan: plantadaEn(34, 7) },
  { id: "s02", ranchoId: "isidro", nombre: "Tabla 2", hectareas: 6, plan: plantadaEn(38, 6) },
  {
    id: "s03",
    ranchoId: "isidro",
    nombre: "Tabla 3",
    hectareas: 5,
    plan: { semana: 45, ha: 5, ingeniero: "Israel", avances: [] },
  },
  { id: "s04", ranchoId: "isidro", nombre: "Tabla 4", hectareas: 4 },
  { id: "s05", ranchoId: "isidro", nombre: "Tabla 5", hectareas: 5 },
  // La Loma
  {
    id: "l01",
    ranchoId: "loma",
    nombre: "Tabla 1",
    hectareas: 8,
    plan: plantadaEn(41, 8, "Ramiro"),
  },
  {
    id: "l02",
    ranchoId: "loma",
    nombre: "Tabla 2",
    hectareas: 6,
    plan: { semana: 46, ha: 6, ingeniero: "Ramiro", avances: [] },
  },
  { id: "l03", ranchoId: "loma", nombre: "Tabla 3", hectareas: 5 },
  {
    id: "l04",
    ranchoId: "loma",
    nombre: "Tabla 4",
    hectareas: 4,
    plan: plantadaEn(37, 4, "Ramiro"),
  },
];
