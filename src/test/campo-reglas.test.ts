import { describe, expect, it } from "vitest";

import {
  cohortes,
  lineasTabla,
  pendienteArrastrado,
  validarApartado,
  validarAvance,
} from "@/lib/campo/calc";
import type { Receta, Tabla } from "@/lib/campo/types";

const receta: Receta = {
  semanas: 12,
  dosis: { urea: [10, 20, 30, 0, 0, 0, 0, 0, 0, 0, 0, 5] },
};

const libre: Tabla = { id: "t", ranchoId: "r", nombre: "Tabla", hectareas: 5 };

describe("Reglas de planeación", () => {
  it("solo se apartan tablas libres", () => {
    const ocupada: Tabla = {
      ...libre,
      plan: { semana: 46, ha: 5, ingeniero: "Israel", avances: [] },
    };
    expect(validarApartado(ocupada, 46, 3, 44)).not.toBeNull();
  });

  it("exige dos semanas de anticipación", () => {
    expect(validarApartado(libre, 45, 3, 44)).not.toBeNull();
    expect(validarApartado(libre, 46, 3, 44)).toBeNull();
  });

  it("no permite apartar más hectáreas que las de la tabla", () => {
    expect(validarApartado(libre, 46, 5.5, 44)).not.toBeNull();
  });

  it("no permite registrar más hectáreas que las pendientes", () => {
    const t: Tabla = {
      ...libre,
      plan: {
        semana: 44,
        ha: 5,
        ingeniero: "Israel",
        avances: [{ id: "a", fecha: "2026-10-26", semana: 44, ha: 1 }],
      },
    };
    expect(validarAvance(t, 4.5, 44)).not.toBeNull();
    expect(validarAvance(t, 4, 44)).toBeNull();
  });

  it("arrastra lo no plantado a la semana actual", () => {
    const t: Tabla = {
      ...libre,
      plan: {
        semana: 43,
        ha: 5,
        ingeniero: "Israel",
        avances: [{ id: "a", fecha: "2026-10-20", semana: 43, ha: 3 }],
      },
    };
    expect(pendienteArrastrado(t.plan, 44)).toBe(true);
    expect(cohortes(t, 44)).toEqual([
      { semana: 43, ha: 3, real: true },
      { semana: 44, ha: 2, real: false },
    ]);
  });
});

describe("Pedido automático", () => {
  it("multiplica hectáreas de cada etapa por la dosis de su semana", () => {
    const t: Tabla = {
      ...libre,
      plan: {
        semana: 43,
        ha: 5,
        ingeniero: "Israel",
        avances: [{ id: "a", fecha: "2026-10-20", semana: 43, ha: 3 }],
      },
    };
    // Semana 45: 3 ha en semana de cultivo 3 (30/ha) + 2 ha en semana 2 (20/ha) = 130
    const [linea] = lineasTabla(t, receta, 45, 44);
    expect(linea.cantidad).toBe(130);
  });

  it("no pide insumos fuera del ciclo configurado", () => {
    const t: Tabla = {
      ...libre,
      plan: {
        semana: 30,
        ha: 2,
        ingeniero: "Israel",
        avances: [{ id: "a", fecha: "2026-07-21", semana: 30, ha: 2 }],
      },
    };
    // Semana de cultivo 12 tiene dosis 5, pero con ciclo de 10 semanas no se pide
    expect(lineasTabla(t, { ...receta, semanas: 10 }, 41, 44)).toEqual([]);
    expect(lineasTabla(t, receta, 41, 44)[0].cantidad).toBe(10);
  });
});
