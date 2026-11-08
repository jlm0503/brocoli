import { describe, expect, it } from "vitest";
import { cargosPlanta, cuentaPlanta } from "@/lib/campo/calc";
import type { SolicitudPlanta } from "@/lib/campo/types";

const solicitud = (densidad: number): SolicitudPlanta => ({
  id: "inicial", folio: 1, fecha: "2026-11-08", viveroId: "",
  vivero: { nombre: "Sin identificar", contacto: "", telefono: "", correo: "" },
  ingeniero: "", status: "generada",
  cargaParametro: { fecha: "2026-11-08", costoPlanta: 0.27, plantasPorHa: densidad },
  lineas: [{ loteId: "l", ranchoId: "r", tablaId: "t", rancho: "R", tabla: "T", lote: "L", variedad: "V", ha: 1, plantas: densidad, semanaPlantacion: 45, fechaEntrega: "" }],
});
describe("Saldo inicial de planta por parámetro", () => {
  it("brócoli: 50,000 plantas por ha a $0.27", () => {
    expect(cargosPlanta([solicitud(50000)])[0]?.monto).toBe(13500);
  });
  it("coliflor: 30,000 plantas por ha a $0.27", () => {
    expect(cargosPlanta([solicitud(30000)])[0]?.monto).toBe(8100);
  });
  it("un abono de viaje reduce el saldo, no el costo original", () => {
    const cargos = cargosPlanta([solicitud(50000)]);
    expect(cuentaPlanta([...cargos, { fecha: "2026-11-09", tipo: "abono", monto: 10000 }], "2026-11-08", "2026-11-10").saldoAcumulado).toBe(3500);
  });
  it("recibir después no duplica el saldo inicial", () => {
    const s = solicitud(50000);
    s.status = "recibida";
    s.entregas = [{ fecha: "2026-11-09", foto: "ticket", costoPlanta: 0.27, plantasPorHa: 50000, recibidas: { l: 50000 } }];
    expect(cargosPlanta([s]).reduce((n, c) => n + c.monto, 0)).toBe(13500);
  });
});