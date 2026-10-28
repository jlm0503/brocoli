import { describe, expect, it } from "vitest";

import {
  cohortes,
  hectareasSinPlanear,
  lineasTabla,
  pendienteArrastrado,
  repartirAvance,
  validarApartado,
  validarAvance,
} from "@/lib/campo/calc";
import type { Plan, Receta, Tabla } from "@/lib/campo/types";

const receta: Receta = {
  semanas: 12,
  dosis: { urea: [10, 20, 30, 0, 0, 0, 0, 0, 0, 0, 0, 5] },
  presiembra: {},
};

const libre: Tabla = { id: "t", ranchoId: "r", nombre: "Tabla", hectareas: 5, planes: [] };

function plan(id: string, semana: number, ha: number, avances: Plan["avances"] = []): Plan {
  return { id, semana, ha, ingeniero: "Israel", avances };
}

describe("Reglas de planeación", () => {
  it("no se aparta una tabla que ya está planeada completa", () => {
    const ocupada: Tabla = { ...libre, planes: [plan("p", 46, 5)] };
    expect(validarApartado(ocupada, 47, 1, 44)).not.toBeNull();
  });

  it("exige dos semanas de anticipación", () => {
    expect(validarApartado(libre, 45, 3, 44)).not.toBeNull();
    expect(validarApartado(libre, 46, 3, 44)).toBeNull();
  });

  it("no permite apartar más hectáreas que las de la tabla", () => {
    expect(validarApartado(libre, 46, 5.5, 44)).not.toBeNull();
  });

  it("una tabla de 12 ha se puede planear 6 ha una semana y 6 ha la siguiente", () => {
    const t12: Tabla = { ...libre, hectareas: 12 };
    expect(validarApartado(t12, 46, 6, 44)).toBeNull();
    const conPrimera: Tabla = { ...t12, planes: [plan("a", 46, 6)] };
    expect(hectareasSinPlanear(conPrimera)).toBe(6);
    expect(validarApartado(conPrimera, 47, 6, 44)).toBeNull();
    expect(validarApartado(conPrimera, 47, 6.5, 44)).not.toBeNull();
  });

  it("no permite dos siembras de la misma tabla en la misma semana", () => {
    const t12: Tabla = { ...libre, hectareas: 12, planes: [plan("a", 46, 6)] };
    expect(validarApartado(t12, 46, 3, 44)).not.toBeNull();
  });

  it("no permite registrar más hectáreas que las pendientes", () => {
    const t: Tabla = {
      ...libre,
      planes: [plan("p", 44, 5, [{ id: "a", fecha: "2026-10-26", semana: 44, ha: 1 }])],
    };
    expect(validarAvance(t, 4.5, 44)).not.toBeNull();
    expect(validarAvance(t, 4, 44)).toBeNull();
  });

  it("no deja registrar avance de una siembra que aún no llega", () => {
    const t: Tabla = { ...libre, hectareas: 12, planes: [plan("a", 44, 6), plan("b", 45, 6)] };
    expect(validarAvance(t, 7, 44)).not.toBeNull();
    expect(validarAvance(t, 6, 44)).toBeNull();
  });

  it("el avance se aplica primero a lo arrastrado", () => {
    const t: Tabla = {
      ...libre,
      hectareas: 12,
      planes: [
        plan("vieja", 43, 6, [{ id: "x", fecha: "2026-10-20", semana: 43, ha: 4 }]),
        plan("nueva", 44, 6),
      ],
    };
    expect(repartirAvance(t, 5, 44)).toEqual([
      { planId: "vieja", ha: 2 },
      { planId: "nueva", ha: 3 },
    ]);
  });

  it("arrastra lo no plantado a la semana actual", () => {
    const t: Tabla = {
      ...libre,
      planes: [plan("p", 43, 5, [{ id: "a", fecha: "2026-10-20", semana: 43, ha: 3 }])],
    };
    expect(pendienteArrastrado(t, 44)).toBe(true);
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
      planes: [plan("p", 43, 5, [{ id: "a", fecha: "2026-10-20", semana: 43, ha: 3 }])],
    };
    // Semana 45: 3 ha en semana de cultivo 3 (30/ha) + 2 ha en semana 2 (20/ha) = 130
    const [linea] = lineasTabla(t, receta, 45, 44);
    expect(linea?.cantidad).toBe(130);
  });

  it("no pide insumos fuera del ciclo configurado", () => {
    const t: Tabla = {
      ...libre,
      planes: [plan("p", 30, 2, [{ id: "a", fecha: "2026-07-21", semana: 30, ha: 2 }])],
    };
    // Semana de cultivo 12 tiene dosis 5, pero con ciclo de 10 semanas no se pide
    expect(lineasTabla(t, { ...receta, semanas: 10 }, 41, 44)).toEqual([]);
    expect(lineasTabla(t, receta, 41, 44)[0]?.cantidad).toBe(10);
  });

  it("pide la presiembra 2 semanas antes de plantar, por las hectáreas planeadas", () => {
    const conPre: Receta = { ...receta, presiembra: { cinta: 4 } };
    const t: Tabla = { ...libre, hectareas: 12, planes: [plan("a", 46, 6), plan("b", 47, 6)] };
    const sem44 = lineasTabla(t, conPre, 44, 44).find((l) => l.productoId === "cinta");
    const sem45 = lineasTabla(t, conPre, 45, 44).find((l) => l.productoId === "cinta");
    const sem46 = lineasTabla(t, conPre, 46, 44).find((l) => l.productoId === "cinta");
    expect(sem44?.cantidad).toBe(24);
    expect(sem45?.cantidad).toBe(24);
    expect(sem46).toBeUndefined();
  });
});
