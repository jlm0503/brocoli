import { describe, expect, it } from "vitest";
import { plantacionesIncumplidas, cierresBajoMeta } from "@/lib/campo/calc";
import type { Lote, CicloCerrado } from "@/lib/campo/types";

const lote = { id: "l", codigo: "1-A", tablaId: "t", ranchoId: "r", ha: 5, semanaPlaneada: 45, ingeniero: "Israel", avances: [], insumos: [], variedadId: "v", cultivo: "brocoli", cicloDias: 84 } satisfies Lote;
const ciclo = { id: "c", fechaFinCosecha: "2026-11-09", ha: 5, kgPagables: 60000, meta: 16000 } as CicloCerrado;
describe("Alertas a Dirección", () => {
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