import { describe, expect, it } from "vitest";

import {
  abonosViajes,
  cerradosBajoMeta,
  estatusLiquidacion,
  evaluarViaje,
  fechaEnSemana,
  rendimientoLote,
  repartirKg,
  reporteCalidad,
  resumenSemanaPago,
  semaforoMeta,
  semanaPago,
  validarSalida,
  viajesSinEvaluar,
} from "@/lib/campo/calc";
import type { Lote, Parametro, Viaje } from "@/lib/campo/types";

function lote(p: Partial<Lote> & { id: string }): Lote {
  return {
    codigo: "1-A",
    tablaId: "t1",
    ranchoId: "r",
    ha: 5,
    semanaPlaneada: 33,
    ingeniero: "Israel",
    avances: [{ id: "a", fecha: "2026-08-10", semana: 33, ha: 5 }],
    insumos: [],
    variedadId: "tlaloc",
    cultivo: "brocoli",
    cicloDias: 84,
    ...p,
  };
}

const params: Parametro[] = [
  { id: "p", clave: "precioKg", valor: 10.5, desde: "2026-01-01" },
  { id: "d", clave: "descuentoViaje", valor: 10000, desde: "2026-01-01" },
  { id: "m", clave: "metaKgHa", valor: 16000, desde: "2026-01-01" },
];

function viaje(p: Partial<Viaje> & { id: string; fecha: string }): Viaje {
  return {
    folio: p.id,
    hora: "08:00",
    loteIds: ["l1"],
    choferId: "c",
    congeladoraId: "principal",
    foto: "hoja.jpg",
    por: "Jimena",
    status: "transito",
    ...p,
  };
}

const ctx = (lotes: Lote[]) => ({ lotes, parametros: params, hoy: "2026-11-12", por: "Jimena" });

function evaluado(v: Viaje, lotes: Lote[], kgB: number, kgP: number): Viaje {
  const r = evaluarViaje(v, { kgBrutos: kgB, kgPagables: kgP, calificacion: 8, problemas: [], reporte: "r.pdf" }, ctx(lotes));
  if ("error" in r) throw new Error(r.error);
  return { ...v, status: "evaluado", evaluacion: r.evaluacion };
}

describe("Fase 4 · semana de pago (jueves a miércoles)", () => {
  it("el jueves de la sem 45 y el lunes de la sem 46 caen en la misma semana de pago", () => {
    const jueves45 = fechaEnSemana(45, 3);
    const lunes46 = fechaEnSemana(46, 0);
    expect(semanaPago(jueves45)).toBe(jueves45);
    expect(semanaPago(lunes46)).toBe(jueves45);
    expect(semanaPago(fechaEnSemana(46, 3))).not.toBe(jueves45);
  });
});

describe("Fase 4 · caso de prueba", () => {
  const l1 = lote({ id: "l1" });
  const v1 = evaluado(viaje({ id: "V1", fecha: fechaEnSemana(45, 3) }), [l1], 12000, 11000);
  const v2 = evaluado(viaje({ id: "V2", fecha: fechaEnSemana(46, 0) }), [l1], 14000, 13000);

  it("bruto $252,000 − descuentos $20,000 = neto $232,000 en una sola semana de pago", () => {
    const r = resumenSemanaPago([v1, v2], semanaPago(v1.fecha));
    expect(r.viajes).toHaveLength(2);
    expect(r.importeBruto).toBe(252000);
    expect(r.descuentos).toBe(20000);
    expect(r.importeNeto).toBe(232000);
  });

  it("4,800 kg pagables/ha (30% de meta) y utilidad directa $51,000 (1.25x)", () => {
    const r = rendimientoLote(l1, [v1, v2], params, 81000 + 120000);
    expect(r.pagablesHa).toBe(4800);
    expect(r.pctMeta).toBe(30);
    expect(r.utilidad).toBe(51000);
    expect(r.retorno).toBe(1.25);
    expect(semaforoMeta(r.pctMeta)).toBe("rojo");
  });

  it("cada viaje evaluado abona $10,000 a la cuenta de planta", () => {
    expect(abonosViajes([v1, v2]).map((m) => m.monto)).toEqual([10000, 10000]);
  });

  it("merma = (brutos − pagables) ÷ brutos", () => {
    expect(v1.evaluacion!.merma).toBe(8.33);
  });
});

describe("Fase 4 · reparto de kilos", () => {
  const t1 = lote({ id: "a", tablaId: "t1" });
  const t2 = lote({ id: "b", tablaId: "t2", ha: 3, avances: [{ id: "x", fecha: "2026-08-10", semana: 33, ha: 3 }] });

  it("Tabla 1 (5 ha) + Tabla 2 (3 ha) con 8,000 kg pagables → 5,000 / 3,000", () => {
    const r = repartirKg([t1, t2], 9000, 8000);
    if ("error" in r) throw new Error(r.error);
    expect(r.filas.map((f) => f.kgPagables)).toEqual([5000, 3000]);
  });

  it("el Super Admin puede ajustar los %, que deben sumar 100", () => {
    expect(repartirKg([t1, t2], 9000, 8000, { modo: "pct", valores: { a: 50, b: 40 } })).toEqual({
      error: "Los porcentajes deben sumar 100%.",
    });
    const r = repartirKg([t1, t2], 9000, 8000, { modo: "pct", valores: { a: 50, b: 50 } });
    if ("error" in r) throw new Error(r.error);
    expect(r.filas.map((f) => f.kgPagables)).toEqual([4000, 4000]);
  });

  it("o capturar kg por tabla si la congeladora los reporta separados", () => {
    const r = repartirKg([t1, t2], 9000, 8000, { modo: "kg", valores: { a: 6000, b: 2000 } });
    if ("error" in r) throw new Error(r.error);
    expect(r.filas.map((f) => f.kgPagables)).toEqual([6000, 2000]);
  });
});

describe("Fase 4 · reglas de salida, evaluación y liquidación", () => {
  const abierto = lote({ id: "l1" });
  const cerrado = lote({ id: "l2", finalizado: true, cosechaTerminada: "2026-11-01" });
  const base = { folio: "H-1", fecha: "2026-11-10", loteIds: ["l2"], choferId: "c", foto: "f.jpg" };

  it("no se permite un lote cerrado, salvo el Super Admin con motivo", () => {
    expect(validarSalida(base, [abierto, cerrado], [], "2026-11-10", false)).toBe("No se puede incluir un lote cerrado.");
    expect(validarSalida(base, [abierto, cerrado], [], "2026-11-10", true)).toBe(
      "Escribe el motivo para incluir un lote cerrado.",
    );
    expect(validarSalida({ ...base, motivoCerrado: "Repaso" }, [abierto, cerrado], [], "2026-11-10", true)).toBeNull();
  });

  it("la salida exige foto de la hoja y folio único", () => {
    expect(validarSalida({ ...base, loteIds: ["l1"], foto: undefined }, [abierto], [], "2026-11-10", false)).toBe(
      "Falta la foto de la hoja.",
    );
    expect(
      validarSalida({ ...base, loteIds: ["l1"] }, [abierto], [viaje({ id: "x", folio: "h-1", fecha: "2026-11-09" })], "2026-11-10", false),
    ).toBe("Ya hay un viaje con ese folio.");
  });

  it("la evaluación exige el reporte de la congeladora", () => {
    const r = evaluarViaje(viaje({ id: "v", fecha: "2026-11-10" }), { kgBrutos: 100, kgPagables: 90, calificacion: 8, problemas: [] }, ctx([abierto]));
    expect(r).toEqual({ error: "Falta la foto o PDF del reporte de la congeladora." });
  });

  it("alerta de viaje sin evaluación después de 3 días", () => {
    const v = viaje({ id: "v", fecha: "2026-11-05" });
    expect(viajesSinEvaluar([v], "2026-11-08", 3)).toHaveLength(0);
    expect(viajesSinEvaluar([v], "2026-11-09", 3)).toHaveLength(1);
  });

  it("estatus: Abierta / Por cobrar / Pagada / Pagada con diferencia", () => {
    const v = evaluado(viaje({ id: "v", fecha: "2026-11-05" }), [abierto], 1000, 1000);
    const r = resumenSemanaPago([v], semanaPago(v.fecha));
    expect(estatusLiquidacion(r, undefined, "2026-11-06")).toBe("abierta");
    expect(estatusLiquidacion(r, undefined, "2026-11-12")).toBe("por_cobrar");
    const liq = { id: r.jueves, fecha: "2026-11-13", comprobante: "c.jpg", por: "J" };
    expect(estatusLiquidacion(r, { ...liq, pagado: 500 }, "2026-11-13")).toBe("pagada");
    expect(estatusLiquidacion(r, { ...liq, pagado: 400 }, "2026-11-13")).toBe("pagada_diferencia");
  });

  it("alerta solo cuando un lote cierra abajo de 16,000 kg pagables/ha", () => {
    const l = lote({ id: "l1", finalizado: true, cosechaTerminada: "2026-11-12" });
    const v = evaluado(viaje({ id: "v", fecha: "2026-11-05" }), [l], 80000, 79000);
    expect(cerradosBajoMeta([l], [v], params)).toHaveLength(1);
    const v2 = evaluado(viaje({ id: "v", fecha: "2026-11-05" }), [l], 81000, 80000);
    expect(cerradosBajoMeta([l], [v2], params)).toHaveLength(0);
  });

  it("los kg castigados en % se calculan sobre los kg brutos", () => {
    const r = evaluarViaje(
      viaje({ id: "v", fecha: "2026-11-10" }),
      { kgBrutos: 10000, kgPagables: 9000, calificacion: 7, reporte: "r", problemas: [{ problemaId: "amarillo", modo: "pct", valor: 5, comentario: "" }] },
      ctx([abierto]),
    );
    if ("error" in r) throw new Error(r.error);
    const rep = reporteCalidad([{ ...viaje({ id: "v", fecha: "2026-11-10" }), status: "evaluado", evaluacion: r.evaluacion }], [abierto]);
    expect(rep.problemas).toEqual([{ problemaId: "amarillo", veces: 1, kg: 500 }]);
  });
});
