import { describe, expect, it } from "vitest";
import { validarChecklistSalida } from "../lib/campo/calc";

const datos = { hora: "15:10", salida: { placas: "ABC-123", destino: "Ultracongelados", cumpleRequisitos: true, choferNombre: "Chofer de prueba", fotoCamion: "prueba/camion.jpg" } };

describe("Lista de revisión de salida", () => {
  it("requiere placas", () => expect(validarChecklistSalida({ ...datos, salida: { ...datos.salida, placas: " " } })).not.toBeNull());
  it("requiere destino", () => expect(validarChecklistSalida({ ...datos, salida: { ...datos.salida, destino: "" } })).not.toBeNull());
  it("requiere una hora válida", () => expect(validarChecklistSalida({ ...datos, hora: "25:00" })).not.toBeNull());
  it("requiere seleccionar cumplimiento", () => expect(validarChecklistSalida({ ...datos, salida: { ...datos.salida, cumpleRequisitos: undefined } })).not.toBeNull());
  it("conserva la decisión de no cumplir sin bloquear la salida", () => expect(validarChecklistSalida({ ...datos, salida: { ...datos.salida, cumpleRequisitos: false } })).toBeNull());
  it("requiere nombre del chofer", () => expect(validarChecklistSalida({ ...datos, salida: { ...datos.salida, choferNombre: " " } })).not.toBeNull());
  it("requiere foto del camión", () => expect(validarChecklistSalida({ ...datos, salida: { ...datos.salida, fotoCamion: "" } })).not.toBeNull());
  it("acepta la revisión completa", () => expect(validarChecklistSalida(datos)).toBeNull());
});