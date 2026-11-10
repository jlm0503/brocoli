import { describe, expect, it } from "vitest";
import { viajesConsulta, filtrarViajesConsulta, totalesConsultaViajes } from "@/lib/campo/calc";
import type { CicloCerrado, Lote, Viaje } from "@/lib/campo/types";

const lotes: Lote[] = ["t1", "t2"].map((tablaId, i) => ({ id: `l${i}`, tablaId, ranchoId: "trejo", codigo: tablaId, ingeniero: "Jaime", ha: 2, semanaPlaneada: 27, cultivo: "brocoli", variedadId: "v", cicloDias: 84, avances: [{ id: `a${i}`, fecha: "2026-07-01", semana: 27, ha: 2 }], insumos: [] }));
const viaje: Viaje = { id: "v1", folio: "B0611", fecha: "2026-09-01", hora: "10:00", loteIds: ["l0", "l1"], choferId: "c", congeladoraId: "f", foto: "", por: "u", status: "evaluado", evaluacion: { fecha: "2026-09-01", por: "u", kgBrutos: 1000, kgPagables: 800, calificacion: 8, problemas: [], reporte: "", merma: 20, importeBruto: 8000, descuento: 1000, importeNeto: 7000, reparto: lotes.map((l) => ({ loteId: l.id, tablaId: l.tablaId, ranchoId: "trejo", pct: 50, kgBrutos: 500, kgPagables: 400, precio: 10, importe: 4000 })) } };
const historico: CicloCerrado = { id: "h", tipo: "historico", ranchoId: "trejo", tablaId: "rios3", codigo: "h", cultivo: "brocoli", ingeniero: "Jaime", ha: 2, plantas: 0, fechaPlantacion: "2026-02-01", fechaFinCosecha: "2026-05-01", viajes: 1, kgBrutos: 600, kgPagables: 500, brutosHa: 300, pagablesHa: 250, meta: 16000, pctMeta: 1, merma: 0, calidad: null, ingreso: 5000, insumos: 0, planta: 0, gastosComunes: 0, utilidadDirecta: 0, utilidadReal: 0, retorno: null, utilidadHa: 0, conPendientes: false, bitacora: [], viajesHistoricos: [{ fecha: "2026-07-20", folio: "H001", kgBrutos: 600, kgPagables: 500 }] };
const filtro = { ciclo: "todos", ranchoId: "", tablaIds: [] as string[], desde: "", hasta: "" };

describe("Consulta de viajes por ciclo y tablas", () => {
  it("Ríos 3 conserva sus viajes importados aunque la tabla esté retirada del catálogo operativo", () => {
    const filas = filtrarViajesConsulta(viajesConsulta([viaje], lotes, [historico]), { ...filtro, tablaIds: ["rios3"] });
    expect(filas.map((v) => v.folio)).toEqual(["H001"]);
    expect(totalesConsultaViajes(filas).kgBrutos).toBe(600);
  });
  it("el ciclo se define por plantación, no por fecha de viaje", () => {
    const filas = viajesConsulta([viaje], lotes, [historico]);
    expect(filtrarViajesConsulta(filas, { ...filtro, ciclo: "2026-1" }).map((v) => v.folio)).toEqual(["H001"]);
    expect(filtrarViajesConsulta(filas, { ...filtro, ciclo: "2026-2" }).map((v) => v.folio)).toEqual(["B0611"]);
  });
  it("dos tablas del mismo ticket cuentan un solo viaje y un solo descuento", () => {
    const filas = filtrarViajesConsulta(viajesConsulta([viaje], lotes, []), { ...filtro, tablaIds: ["t1", "t2"] });
    expect(totalesConsultaViajes(filas)).toEqual({ viajes: 1, kgBrutos: 1000, kgPagables: 800, descuento: 1000, neto: 7000 });
  });
  it("una tabla muestra su reparto y conserva el total original del ticket", () => {
    const filas = filtrarViajesConsulta(viajesConsulta([viaje], lotes, []), { ...filtro, tablaIds: ["t1"] });
    expect(filas[0]?.kgTotal).toBe(1000);
    expect(totalesConsultaViajes(filas)).toEqual({ viajes: 1, kgBrutos: 500, kgPagables: 400, descuento: 500, neto: 3500 });
  });
  it("agrupa tickets históricos compartidos y no duplica fotos de cierre del sistema", () => {
    const filas = viajesConsulta([viaje], lotes, [historico, { ...historico, id: "h2", tablaId: "rios4" }, { ...historico, id: "l0", loteId: "l0", tipo: "sistema" }]);
    expect(filas).toHaveLength(2);
    expect(filas.find((v) => v.folio === "H001")?.kgTotal).toBe(1200);
  });
  it("combina rancho, fecha y autorización de consulta sin alterar originales", () => {
    const filas = viajesConsulta([viaje], lotes, [historico]);
    expect(filtrarViajesConsulta(filas, { ...filtro, desde: "2026-09-01", hasta: "2026-09-01", ranchoId: "trejo" })).toHaveLength(1);
    expect(filtrarViajesConsulta(filas, filtro, () => false)).toHaveLength(0);
    expect(viaje.evaluacion?.reparto).toHaveLength(2);
  });
  it("no inventa neto cuando el histórico no trae precio o descuento", () => {
    expect(totalesConsultaViajes(viajesConsulta([], [], [historico])).neto).toBeNull();
  });
});