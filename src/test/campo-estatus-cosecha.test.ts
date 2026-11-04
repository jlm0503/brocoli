import { describe, expect, it } from "vitest";

import { evaluarViaje, fechaEnSemana, haPorCosecharSemana, kgCosechadosSemana } from "@/lib/campo/calc";
import type { Lote, Parametro, Viaje } from "@/lib/campo/types";

function lote(p: Partial<Lote> & { id: string }): Lote {
  return {
    codigo: "1-A",
    tablaId: "t1",
    ranchoId: "r",
    ha: 12,
    semanaPlaneada: 30,
    ingeniero: "Israel",
    avances: [],
    insumos: [],
    variedadId: "diamante",
    cultivo: "brocoli",
    cicloDias: 70,
    ...p,
  };
}

const params: Parametro[] = [
  { id: "p", clave: "precioKg", valor: 10.5, desde: "2026-01-01" },
  { id: "d", clave: "descuentoViaje", valor: 10000, desde: "2026-01-01" },
];

function viaje(id: string, fecha: string, loteIds: string[]): Viaje {
  return { id, folio: id, fecha, hora: "08:00", loteIds, choferId: "c", congeladoraId: "u", foto: "f.jpg", por: "J", status: "transito" };
}
function evaluado(v: Viaje, lotes: Lote[], kgB: number, kgP: number): Viaje {
  const r = evaluarViaje(v, { kgBrutos: kgB, kgPagables: kgP, calificacion: 8, problemas: [], reporte: "r" }, { lotes, parametros: params, hoy: v.fecha, por: "J" });
  if ("error" in r) throw new Error(r.error);
  return { ...v, status: "evaluado", evaluacion: r.evaluacion };
}

describe("Estatus · kg cosechados en la semana", () => {
  const a = lote({ id: "a", avances: [{ id: "x", fecha: "2026-07-20", semana: 30, ha: 12 }] });
  const b = lote({ id: "b", tablaId: "t2", avances: [{ id: "y", fecha: "2026-07-20", semana: 30, ha: 12 }] });
  const viajes = [
    evaluado(viaje("V1", fechaEnSemana(45, 1), ["a"]), [a], 12000, 11000),
    evaluado(viaje("V2", fechaEnSemana(45, 3), ["b"]), [b], 8000, 7500),
    evaluado(viaje("V3", fechaEnSemana(44, 4), ["a"]), [a], 9000, 9000),
    viaje("V4", fechaEnSemana(45, 4), ["a"]),
  ];

  it("suma solo los viajes evaluados con salida en la semana: 11,000 + 7,500 = 18,500 kg pagables", () => {
    const k = kgCosechadosSemana(viajes, 45);
    expect(k.kgPagables).toBe(18500);
    expect(k.kgBrutos).toBe(20000);
    expect(k.viajes).toBe(2);
    expect(k.sinEvaluar).toBe(1);
  });

  it("el filtro deja solo los kilos de la tabla elegida", () => {
    expect(kgCosechadosSemana(viajes, 45, (r) => r.tablaId === "t1").kgPagables).toBe(11000);
  });
});

describe("Estatus · hectáreas a cosechar la próxima semana", () => {
  it("una tabla plantada 6 ha en sem 30 y 6 ha en sem 31 (Diamante, 10 semanas) cosecha 6 ha en sem 40 y 6 en sem 41", () => {
    const l = lote({
      id: "l",
      avances: [
        { id: "1", fecha: "2026-07-20", semana: 30, ha: 6 },
        { id: "2", fecha: "2026-07-27", semana: 31, ha: 6 },
      ],
    });
    expect(haPorCosecharSemana([l], 40).map((x) => x.ha)).toEqual([6]);
    expect(haPorCosecharSemana([l], 41).map((x) => x.ha)).toEqual([6]);
    expect(haPorCosecharSemana([l], 42)).toEqual([]);
  });

  it("Tlaloc (12 semanas) plantado en sem 30 entra a cosecha en sem 42", () => {
    const l = lote({ id: "t", variedadId: "tlaloc", cicloDias: 84, avances: [{ id: "1", fecha: "2026-07-20", semana: 30, ha: 5 }] });
    expect(haPorCosecharSemana([l], 42)[0]?.ha).toBe(5);
  });

  it("no cuenta lotes cancelados, finalizados ni con la cosecha terminada", () => {
    const av = [{ id: "1", fecha: "2026-07-20", semana: 30, ha: 5 }];
    const ls = [
      lote({ id: "c", cancelado: true, avances: av }),
      lote({ id: "f", finalizado: true, avances: av }),
      lote({ id: "t", cosechaTerminada: "2026-10-01", avances: av }),
    ];
    expect(haPorCosecharSemana(ls, 40)).toEqual([]);
  });
});
