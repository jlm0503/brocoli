import { describe, expect, it } from "vitest";

import {
  cantidadesExtraordinario,
  consumoTeorico,
  radioValidacion,
  siguienteFolioExtra,
  urgenteSurtido,
  validarExtraordinario,
  validarUbicacionFotos,
} from "@/lib/campo/calc";
import type { Extraordinario, FotoGps, Tabla } from "@/lib/campo/types";

const tabla = (id: string, ha: number, gps?: { lat: number; lng: number }): Tabla =>
  ({ id, ranchoId: "r1", nombre: id, hectareas: ha, ...(gps ? { gps } : {}) }) as Tabla;
const foto = (lat?: number, lng?: number): FotoGps => ({ ruta: "x", fecha: "2026-11-02T10:00:00Z", lat, lng });

describe("Fase 3 · validación de ubicación", () => {
  it("radio = raíz(ha×10,000/π)×1.5, mínimo 100 m", () => {
    expect(radioValidacion(tabla("a", 12))).toBe(293);
    expect(radioValidacion(tabla("b", 0.2))).toBe(100);
  });
  it("todas las fotos dentro de alguna tabla → válida; una fuera → no válida", () => {
    const t = [tabla("a", 12, { lat: 20, lng: -100 })];
    expect(validarUbicacionFotos([foto(20, -100), foto(20.001, -100), foto(20, -100.001)], t)).toBe("valida");
    expect(validarUbicacionFotos([foto(20, -100), foto(20.05, -100), foto(20, -100)], t)).toBe("no_valida");
  });
  it("tabla sin punto GPS → no verificable", () => {
    expect(validarUbicacionFotos([foto(20, -100)], [tabla("a", 5)])).toBe("no_verificable");
  });
});

describe("Fase 3 · solicitud extraordinaria", () => {
  const base = {
    tablaIds: ["a"],
    descripcion: "Gusano",
    lineas: [{ productoId: "p", porHa: 1.5 }],
    fotos: [foto(), foto(), foto()],
    diasEfecto: 7,
    fechaMaxSurtido: "2026-11-05",
  };
  it("pide mínimo 3 fotos", () => {
    expect(validarExtraordinario({ ...base, fotos: [foto(), foto()] }, "2026-11-02")).toMatch(/3 fotos/);
    expect(validarExtraordinario(base, "2026-11-02")).toBeNull();
  });
  it("cantidad = dosis por ha × hectáreas de todas las tablas", () => {
    const ex = { ...base, tablaIds: ["a", "b"] } as unknown as Extraordinario;
    expect(cantidadesExtraordinario(ex, [tabla("a", 12), tabla("b", 6)])).toEqual([{ productoId: "p", cantidad: 27 }]);
  });
  it("rojo cuando falta un día o menos y sigue por autorizar", () => {
    const ex = { ...base, status: "por_autorizar" } as unknown as Extraordinario;
    expect(urgenteSurtido(ex, "2026-11-04")).toBe(true);
    expect(urgenteSurtido(ex, "2026-11-02")).toBe(false);
    expect(urgenteSurtido({ ...ex, status: "autorizada" }, "2026-11-04")).toBe(false);
  });
  it("folios consecutivos EX-0001", () => {
    expect(siguienteFolioExtra([])).toBe("EX-0001");
    expect(siguienteFolioExtra([{ folio: "EX-0007" } as Extraordinario])).toBe("EX-0008");
  });
});

describe("Fase 3 · devoluciones", () => {
  it("consumo teórico = entregado − retirado", () => {
    expect(consumoTeorico(30, 4.5)).toBe(25.5);
  });
});

import { costoPorPlanta, parametroVigente } from "@/lib/campo/calc";
import type { Parametro } from "@/lib/campo/types";

describe("Parámetros por variedad", () => {
  const ps: Parametro[] = [
    { id: "g", clave: "plantasPorHa", valor: 60000, desde: "2026-01-01" },
    { id: "d", clave: "plantasPorHa", valor: 55000, desde: "2026-11-01", variedadId: "diamante" },
    { id: "c", clave: "costoPlantaHa", valor: 16200, desde: "2026-01-01" },
    { id: "dv", clave: "descuentoViaje", valor: 9000, desde: "2026-11-01", variedadId: "diamante" },
  ];
  it("la variedad con valor propio lo usa desde su fecha", () => {
    expect(parametroVigente(ps, "plantasPorHa", "2026-11-03", "diamante")).toBe(55000);
  });
  it("antes de su fecha, o sin valor propio, usa el general", () => {
    expect(parametroVigente(ps, "plantasPorHa", "2026-10-30", "diamante")).toBe(60000);
    expect(parametroVigente(ps, "plantasPorHa", "2026-11-03", "tlaloc")).toBe(60000);
  });
  it("descuento por viaje es igual para todas las variedades", () => {
    expect(parametroVigente(ps, "descuentoViaje", "2026-11-03", "diamante")).toBe(10000);
  });
  it("costo por planta con las plantas por ha de la variedad", () => {
    expect(costoPorPlanta(ps, "2026-11-03", "diamante")).toBeCloseTo(16200 / 55000, 4);
  });
});
