import { describe, expect, it } from "vitest";

import {
  cultivosDelRancho,
  estadoResultados,
  fechaEnSemana,
  gastosComunesLote,
  idGasto,
  leerGastosCsv,
  prorrateoRango,
  prorrateoSemana,
  repartoVigente,
  utilidadLote,
  validarGasto,
  validarReparto,
  type DatosGasto,
  type RendimientoLote,
} from "@/lib/campo/calc";
import type { CultivoCat, GastoRancho, Lote, Rancho, RepartoCultivo } from "@/lib/campo/types";

const ranchos: Rancho[] = [{ id: "dolores", nombre: "Dolores", zona: "Norte" }];
const cultivos: CultivoCat[] = [
  { id: "brocoli", nombre: "Brócoli" },
  { id: "coliflor", nombre: "Coliflor" },
];

/** Dolores: brócoli 60% / coliflor 40%. */
const reparto: RepartoCultivo = {
  id: "dolores",
  ranchoId: "dolores",
  pct: { brocoli: 60, coliflor: 40 },
  por: "Jimena",
  fecha: "2026-01-05",
};

const lote = (id: string, ha: number, cultivo: string, semanaPlaneada: number, extra: Partial<Lote> = {}): Lote => ({
  id,
  codigo: id,
  tablaId: `t-${id}`,
  ranchoId: "dolores",
  ha,
  semanaPlaneada,
  ingeniero: "Israel",
  avances: [],
  insumos: [],
  variedadId: "diamante",
  cultivo,
  cicloDias: 70,
  ...extra,
});

// Caso de prueba del documento: brócoli A 5 ha (en cosecha), B 3 ha (plantado), C 2 ha (planeado).
const A = lote("A", 5, "brocoli", 40, { avances: [{ id: "a1", fecha: fechaEnSemana(41), semana: 41, ha: 5 }] });
const B = lote("B", 3, "brocoli", 42, { avances: [{ id: "b1", fecha: fechaEnSemana(43), semana: 43, ha: 3 }] });
const C = lote("C", 2, "brocoli", 45);
const lotes = [A, B, C];

const gasto = (d: { semana: number; cultivo: string; concepto: GastoRancho["concepto"]; monto: number; modo: GastoRancho["modo"]; detalle?: string }): GastoRancho => ({
  id: idGasto({ semana: d.semana, ranchoId: "dolores", cultivo: d.cultivo, concepto: d.concepto, detalle: d.detalle }),
  semana: d.semana,
  ranchoId: "dolores",
  cultivo: d.cultivo,
  concepto: d.concepto,
  monto: d.monto,
  modo: d.modo,
  detalle: d.detalle,
  por: "Jimena",
  fecha: "2026-01-05",
});

/** Nómina total del rancho: $100,000 en la semana 45. */
const nomina45 = gasto({ semana: 45, cultivo: "*", concepto: "nomina", monto: 100000, modo: "total" });

describe("Fase 6 · prorrateo de gastos comunes", () => {
  it("el total del rancho se reparte por % entre cultivos y por ha entre lotes", () => {
    const p = prorrateoSemana({ semana: 45, ranchoId: "dolores", lotes, gastos: [nomina45], reparto });
    expect(p.porLote.A).toBe(30000);
    expect(p.porLote.B).toBe(18000);
    expect(p.porLote.C).toBe(12000);
  });

  it("ningún lote de brócoli recibe el gasto de coliflor: queda no asignado", () => {
    const p = prorrateoSemana({ semana: 45, ranchoId: "dolores", lotes, gastos: [nomina45], reparto });
    expect(p.noAsignado).toEqual([{ cultivo: "coliflor", concepto: "nomina", monto: 40000, motivo: "Sin lotes activos esa semana" }]);
    expect(Object.values(p.porLote).reduce((s, x) => s + x, 0)).toBe(60000);
  });

  it("con A cerrado en la semana 46, sus $30,000 de brócoli van a B y C", () => {
    const Acerrado = { ...A, cosechaTerminada: fechaEnSemana(45, 4) };
    const brocoli46 = gasto({ semana: 46, cultivo: "brocoli", concepto: "nomina", monto: 30000, modo: "directo" });
    const p = prorrateoSemana({ semana: 46, ranchoId: "dolores", lotes: [Acerrado, B, C], gastos: [brocoli46], reparto });
    expect(p.porLote.A).toBeUndefined();
    expect(p.porLote.B).toBe(18000);
    expect(p.porLote.C).toBe(12000);
  });

  it("el gasto de un lote cancelado no se reparte a los demás: queda no asignado", () => {
    const Bcancelado = { ...B, cancelado: true };
    const p = prorrateoSemana({ semana: 45, ranchoId: "dolores", lotes: [A, Bcancelado, C], gastos: [nomina45], reparto });
    expect(p.porLote.B).toBeUndefined();
    expect(p.porLote.A).toBe(30000); // su parte por ha; la del cancelado no se reparte a los demás
    expect(p.porLote.C).toBe(12000);
    expect(p.noAsignado.find((n) => n.motivo.includes("cancelado"))?.monto).toBe(18000);
  });

  it("antes de la semana planeada el lote no recibe gasto", () => {
    const nomina44 = gasto({ semana: 44, cultivo: "*", concepto: "nomina", monto: 100000, modo: "total" });
    const p = prorrateoSemana({ semana: 44, ranchoId: "dolores", lotes, gastos: [nomina44], reparto });
    expect(p.porLote.C).toBeUndefined();
    expect(p.porLote.A).toBe(37500); // 60,000 entre 5 + 3 ha
    expect(p.porLote.B).toBe(22500);
  });

  it("el ajuste de una semana manda sobre los % generales", () => {
    const conAjuste: RepartoCultivo = { ...reparto, ajustes: { "45": { brocoli: 100, coliflor: 0 } } };
    expect(repartoVigente(conAjuste, 45)).toEqual({ brocoli: 100, coliflor: 0 });
    expect(repartoVigente(conAjuste, 46)).toEqual({ brocoli: 60, coliflor: 40 });
    const p = prorrateoSemana({ semana: 45, ranchoId: "dolores", lotes, gastos: [nomina45], reparto: conAjuste });
    expect(p.porLote.A).toBe(50000);
    expect(p.noAsignado).toEqual([]);
  });

  it("varias semanas se acumulan por lote", () => {
    const brocoli46 = gasto({ semana: 46, cultivo: "brocoli", concepto: "diesel", monto: 30000, modo: "directo" });
    const p = prorrateoRango({ desde: 45, hasta: 46, lotes, gastos: [nomina45, brocoli46], repartos: [reparto] });
    const a = gastosComunesLote("A", p);
    expect(a.total).toBe(45000); // 30,000 nómina + 15,000 diésel
    expect(a.porConcepto).toMatchObject({ nomina: 30000, diesel: 15000 });
  });
});

describe("Fase 6 · captura de gastos", () => {
  const ctx = { gastos: [nomina45], reparto, cultivos: ["brocoli", "coliflor"] };
  const d: DatosGasto = { semana: 46, ranchoId: "dolores", cultivo: "brocoli", concepto: "nomina", monto: 5000, modo: "directo" };

  it("deja capturar un gasto nuevo", () => {
    expect(validarGasto(d, ctx)).toBeNull();
  });

  it("no deja duplicar semana, rancho, cultivo y concepto", () => {
    const directo = gasto({ semana: 45, cultivo: "brocoli", concepto: "nomina", monto: 60000, modo: "directo" });
    const conDirecto = { gastos: [nomina45, directo], reparto, cultivos: ["brocoli", "coliflor"] };
    expect(validarGasto({ ...d, semana: 45 }, conDirecto)).toContain("Ya existe");
    expect(validarGasto({ ...d, semana: 45, modo: "total", cultivo: "*" }, conDirecto)).toContain("Ya existe");
  });

  it("el monto debe ser mayor a 0", () => {
    expect(validarGasto({ ...d, monto: 0 }, ctx)).toContain("mayor a 0");
    expect(validarGasto({ ...d, monto: -5 }, ctx)).toContain("mayor a 0");
  });

  it("en «Otros» el concepto es obligatorio", () => {
    expect(validarGasto({ ...d, concepto: "otros", detalle: undefined }, ctx)).toContain("escribe el concepto");
    expect(validarGasto({ ...d, concepto: "otros", detalle: "Renta de bomba" }, ctx)).toBeNull();
  });

  it("sin % que sumen 100 no se puede capturar el total del rancho", () => {
    const sinReparto = { gastos: [], reparto: undefined, cultivos: ["brocoli"] };
    expect(validarGasto({ ...d, modo: "total", cultivo: "*" }, sinReparto)).toContain("No se puede repartir");
    expect(validarReparto({ brocoli: 60, coliflor: 30 })).toContain("suman 90");
    expect(validarReparto({ brocoli: 60, coliflor: 40 })).toBeNull();
  });

  it("no deja un cultivo que no es del rancho", () => {
    expect(validarGasto({ ...d, cultivo: "fresa" }, ctx)).toContain("no está en la lista");
  });

  it("la cuadrícula del rancho trae sus cultivos", () => {
    expect(cultivosDelRancho(lotes, "dolores")).toEqual(["brocoli"]);
    expect(cultivosDelRancho([...lotes, lote("D", 4, "coliflor", 44)], "dolores")).toEqual(["brocoli", "coliflor"]);
  });
});

describe("Fase 6 · importación desde Excel", () => {
  it("reconoce el nombre escrito a mano de rancho, cultivo y concepto", () => {
    const r = leerGastosCsv(
      "semana,rancho,cultivo,concepto,monto\n45,Dolores,Brócoli,Nómina,60000\n45,Dolores,Coliflor,Diésel,\"5,000\"\n",
      { ranchos, cultivos },
    );
    expect(r.errores).toEqual([]);
    expect(r.filas[0]).toMatchObject({ semana: 45, ranchoId: "dolores", cultivo: "brocoli", concepto: "nomina", monto: 60000 });
    expect(r.filas[1]).toMatchObject({ cultivo: "coliflor", concepto: "diesel", monto: 5000 });
  });

  it("avisa la línea con un rancho que no existe", () => {
    const r = leerGastosCsv("45,Rancho X,Brócoli,Nómina,60000\n", { ranchos, cultivos });
    expect(r.filas).toHaveLength(0);
    expect(r.errores[0]).toContain("Rancho X");
  });
});

describe("Fase 6 · utilidad real", () => {
  const r = (over: Partial<RendimientoLote> = {}) =>
    ({
      loteId: "A",
      ha: 5,
      viajes: 2,
      kgBrutos: 9000,
      kgPagables: 8000,
      brutosHa: 1800,
      pagablesHa: 1600,
      meta: 16000,
      pctMeta: 10,
      merma: 11,
      calidad: 8,
      ingreso: 100000,
      gasto: 60000,
      utilidad: 40000,
      retorno: 1.67,
      utilidadHa: 8000,
      equilibrioKgHa: 0,
      ...over,
    }) as RendimientoLote;

  it("la utilidad real resta los gastos comunes y su retorno usa el gasto total", () => {
    const u = utilidadLote(r(), { planta: 20000, gastosComunes: 10000 });
    expect(u.insumos).toBe(40000);
    expect(u.planta).toBe(20000);
    expect(u.utilidadDirecta).toBe(40000);
    expect(u.utilidadReal).toBe(30000);
    expect(u.utilidadRealHa).toBe(6000);
    expect(u.retornoReal).toBe(1.43); // 100,000 ÷ 70,000
  });

  it("el estado de resultados cierra con la fórmula del documento", () => {
    const t = estadoResultados({
      desde: 45,
      hasta: 45,
      lotes,
      viajes: [],
      parametros: [],
      gastos: [nomina45],
      repartos: [reparto],
      costoLote: () => 0,
      plantaLote: () => 0,
    });
    const brocoli = t.filas.find((f) => f.cultivo === "brocoli");
    const coliflor = t.filas.find((f) => f.cultivo === "coliflor");
    if (!brocoli) throw new Error("No aparece la fila de brócoli.");
    expect(brocoli.gastosComunes).toBe(60000);
    expect(brocoli.porConcepto.nomina).toBe(60000);
    expect(brocoli?.noAsignado).toBe(0);
    expect(brocoli?.utilidadReal).toBe(-60000);
    expect(coliflor?.noAsignado).toBe(40000);
    expect(coliflor?.porConcepto.nomina).toBe(0);
    expect(t.totales.utilidadReal).toBe(-100000);
  });
});
