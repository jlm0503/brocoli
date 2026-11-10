import { describe, expect, it } from "vitest";
import { finalizarCosechados, loteEnCosecha, lotesParaSalida, hectareasDisponibles, estatusTabla } from "@/lib/campo/calc";
import type { Lote } from "@/lib/campo/types";

const junio: Lote = { id: "junio", codigo: "7-A", ranchoId: "sm", tablaId: "7", ha: 6.5, semanaPlaneada: 25, ingeniero: "", avances: [{ id: "av", fecha: "2026-06-20", semana: 25, ha: 6.5 }], insumos: [], variedadId: "v", cultivo: "brocoli", cicloDias: 87, fechaCosecha: "2026-09-15", folioProgramacion: "PC-SMO-062026-004", cosechaPendienteCaptura: true };

describe("Cosecha pendiente de la carga actual", () => {
  it("mantiene Santa Mónica 7 de junio en cosecha hasta capturarla y terminarla", () => {
    const l = finalizarCosechados([junio], 45)[0];
    expect(l?.finalizado).not.toBe(true);
    expect(l && loteEnCosecha(l, 45)).toBe(true);
    expect(lotesParaSalida(l ? [l] : []).map((x) => x.id)).toContain("junio");
    expect(l?.ha).toBe(6.5);
    expect(l?.fechaCosecha).toBe("2026-09-15");
  });
  it("mantiene Santa Mónica 1 de 27 junio abierta sin alterar sus 4 ha", () => {
    const tabla1 = { ...junio, id: "junio1", tablaId: "1", codigo: "1-A", ha: 4, avances: [{ id: "av1", fecha: "2026-06-27", semana: 26, ha: 4 }], folioProgramacion: "PC-SMO-062026-002" };
    const l = finalizarCosechados([tabla1], 60)[0];
    expect(l?.finalizado).not.toBe(true);
    expect(l?.ha).toBe(4);
    expect(l?.folioProgramacion).toBe("PC-SMO-062026-002");
  });
  it("respeta la terminación explícita pero nunca termina otros lotes por calendario", () => {
    expect(finalizarCosechados([{ ...junio, cosechaTerminada: "2026-11-08" }], 45)[0]?.finalizado).toBe(true);
    expect(finalizarCosechados([{ ...junio, cosechaPendienteCaptura: false }], 45)[0]?.finalizado).not.toBe(true);
  });
  it("Dolores 9, 10 y 11 no se liberan sin cierre aunque tengan finalizado por calendario", () => {
    for (const [id, ha] of [["9", 2.5], ["10", 2.5], ["11", 1.5]] as const) {
      const tabla = { id, ranchoId: "dolores", nombre: id, hectareas: ha };
      const l = { ...junio, tablaId: id, ranchoId: "dolores", ha, finalizado: true, avances: [{ id: "av", fecha: "2026-07-31", semana: 31, ha }], fechaCosecha: "2026-10-26" };
      expect(hectareasDisponibles(tabla, [l])).toBe(0);
      expect(estatusTabla(tabla, [l], 46)).toBe("en-cosecha");
      expect(hectareasDisponibles(tabla, [{ ...l, cosechaTerminada: "2026-11-09" }])).toBe(0);
      expect(hectareasDisponibles(tabla, [{ ...l, cerrado: true }])).toBe(ha);
    }
  });
});