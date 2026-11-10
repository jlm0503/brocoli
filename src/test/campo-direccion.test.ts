import { describe, expect, it } from "vitest";
import { plantacionesIncumplidas, cierresBajoMeta, registroEnCicloPlantacion } from "@/lib/campo/calc";
import type { Lote, CicloCerrado } from "@/lib/campo/types";

const lote = { id: "l", codigo: "1-A", tablaId: "t", ranchoId: "r", ha: 5, semanaPlaneada: 45, ingeniero: "Israel", avances: [], insumos: [], variedadId: "v", cultivo: "brocoli", cicloDias: 84 } satisfies Lote;
const ciclo = { id: "c", fechaFinCosecha: "2026-11-09", ha: 5, kgPagables: 60000, meta: 16000 } as CicloCerrado;
describe("Alertas a Dirección", () => {
  it("un extraordinario o devolución del primer ciclo no pasa al segundo aunque se registre después", () => {
    const primero = { ...lote, avances: [{ id: "a", fecha: "2026-06-15", semana: 25, ha: 5 }] };
    const segundo = { ...lote, id: "l2", avances: [{ id: "b", fecha: "2026-07-01", semana: 27, ha: 5 }] };
    const registro = { fecha: "2026-08-01", tablaIds: ["t"], loteIds: ["l"] };
    expect(registroEnCicloPlantacion(registro, "2026-1", [primero, segundo], [])).toBe(true);
    expect(registroEnCicloPlantacion(registro, "2026-2", [primero, segundo], [])).toBe(false);
    expect(registroEnCicloPlantacion(registro, "todos", [primero, segundo], [])).toBe(true);
  });
  it("sin lote vinculado usa la plantación de la tabla en la fecha del pedido", () => {
    const primero = { ...lote, avances: [{ id: "a", fecha: "2026-05-01", semana: 18, ha: 5 }] };
    const segundo = { ...lote, id: "l2", avances: [{ id: "b", fecha: "2026-07-01", semana: 27, ha: 5 }] };
    expect(registroEnCicloPlantacion({ fecha: "2026-06-10", tablaIds: ["t"] }, "2026-2", [primero, segundo], [])).toBe(false);
    expect(registroEnCicloPlantacion({ fecha: "2026-07-10", tablaIds: ["t"] }, "2026-2", [primero, segundo], [])).toBe(true);
  });
  it("mantiene el ciclo de los lotes que solo existen en históricos", () => {
    const historico = { ...ciclo, loteId: "cerrado", tablaId: "t", fechaPlantacion: "2026-06-15" };
    const registro = { fecha: "2026-07-10", tablaIds: ["t"], loteIds: ["cerrado"] };
    expect(registroEnCicloPlantacion(registro, "2026-1", [], [historico])).toBe(true);
    expect(registroEnCicloPlantacion(registro, "2026-2", [], [historico])).toBe(false);
  });
  it("no acusa incumplimiento antes de terminar la semana planeada", () => {
    expect(plantacionesIncumplidas([lote], 45)).toEqual([]);
    expect(plantacionesIncumplidas([lote], 46)[0]).toMatchObject({ faltantes: 5, registradas: 0 });
  });
  it("compara el avance a tiempo y no oculta el incumplimiento con captura tardía", () => {
    const l = { ...lote, avances: [{ id: "a", fecha: "2026-11-03", semana: 45, ha: 3 }, { id: "b", fecha: "2026-11-09", semana: 46, ha: 2 }] };
    expect(plantacionesIncumplidas([l], 46)[0]).toMatchObject({ registradas: 3, faltantes: 2 });
    expect(plantacionesIncumplidas([{ ...l, avances: [{ id: "a", fecha: "2026-11-03", semana: 45, ha: 5 }] }], 46)).toEqual([]);
  });
  it("reconstruye los arrastres sin duplicar avisos", () => {
    const raiz = { ...lote, ha: 3, avances: [{ id: "a", fecha: "2026-11-03", semana: 45, ha: 3 }] };
    expect(plantacionesIncumplidas([raiz, { ...lote, id: "arr", origenId: "l", ha: 2, semanaPlaneada: 46 }], 47)).toHaveLength(1);
    expect(plantacionesIncumplidas([raiz, { ...lote, id: "arr", origenId: "l", ha: 2, semanaPlaneada: 46 }], 47)[0]).toMatchObject({ planeadas: 5, faltantes: 2 });
  });
  it("no acusa plantaciones canceladas", () => {
    expect(plantacionesIncumplidas([{ ...lote, cancelado: true }], 46)).toEqual([]);
  });
  it("muestra bajo meta solo después del cierre real y no al terminar cosecha", () => {
    expect(cierresBajoMeta([{ ...ciclo, fechaFinCosecha: "" }, { ...ciclo, reabierto: true }])).toEqual([]);
    expect(cierresBajoMeta([ciclo])).toEqual([ciclo]);
    expect(cierresBajoMeta([{ ...ciclo, kgPagables: 80000 }])).toEqual([]);
  });
  it("no acusa históricos pendientes de completar", () => {
    const pendiente = { ...ciclo, importacion: { pendiente: true } } as CicloCerrado;
    expect(cierresBajoMeta([pendiente])).toEqual([]);
  });
});