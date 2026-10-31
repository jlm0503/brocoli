import { describe, expect, it } from "vitest";

import {
  cerrarSemana,
  codigoArrastre,
  consolidar,
  descontar,
  etapa,
  fechaCosechaLote,
  finalizarCosechados,
  hectareasActivas,
  esPlaneacionTardia,
  estatusTabla,
  hectareasDisponibles,
  lineasLote,
  lineasPlaneacion,
  lineasSemana,
  pendientesConInsumos,
  radioValidacion,
  recetaEfectiva,
  repartirAvance,
  semaforoPedido,
  validarApartado,
  semanaCosechaLote,
  validarAvance,
  crearLotePlantado,
  validarPlantacionPrevia,
  validarRancho,
  validarTabla,
  corregirFechasLote,
  semanaRealLote,
} from "@/lib/campo/calc";
import { puedeCorregirFechas } from "@/lib/campo/roles";
import {
  LOTES_INICIALES,
  PEDIDOS_INICIALES,
  RANCHOS_INICIALES,
  RECETAS_INICIALES,
  TABLAS_INICIALES,
  VARIEDADES,
} from "@/lib/campo/seed";
import type { Adicional, Lote, PedidoPlaneacion, Producto, Receta, Recetas, Tabla } from "@/lib/campo/types";

const R = (brocoli: Receta): Recetas => ({ brocoli, coliflor: { dosis: {} } });

// Receta de prueba: la semana N de receta pide N kg de urea por ha (fácil de verificar).
const receta: Receta = {
  dosis: Object.fromEntries(
    Array.from({ length: 15 }, (_, i) => i - 2).map((w) => [
      w,
      w === -2 ? { cinta: 2.1, yeso: 500 } : w >= 0 ? { urea: w + 100 } : {},
    ]),
  ),
};
const productos: Producto[] = [
  { id: "urea", codigo: "FER-002", nombre: "Urea", familia: "Fertilizante", unidad: "kg", precio: 10 },
  { id: "cinta", codigo: "RIE-001", nombre: "Cinta", familia: "Riego", unidad: "rollo", precio: 1850 },
  { id: "yeso", codigo: "SUE-001", nombre: "Yeso", familia: "Suelo", unidad: "kg", precio: 4 },
];

const t12: Tabla = { id: "t1", ranchoId: "r", nombre: "Tabla 1", hectareas: 12 };

function lote(p: Partial<Lote> & { id: string; ha: number; semanaPlaneada: number }): Lote {
  return {
    codigo: "1-A",
    tablaId: "t1",
    ranchoId: "r",
    ingeniero: "Israel",
    avances: [],
    insumos: [],
    variedadId: "tlaloc",
    cultivo: "brocoli",
    cicloDias: 84,
    ...p,
  };
}
const av = (semana: number, ha: number) => ({ id: `a${semana}${ha}`, fecha: "2026-10-01", semana, ha });

describe("Lotes de plantación", () => {
  it("una tabla de 12 ha se planea 6 ha en la sem 45 y 6 ha en la sem 46", () => {
    expect(validarApartado(t12, [], 45, 6, 43)).toBeNull();
    const conA = [lote({ id: "a", ha: 6, semanaPlaneada: 45 })];
    expect(hectareasDisponibles(t12, conA)).toBe(6);
    expect(validarApartado(t12, conA, 46, 6, 43)).toBeNull();
    expect(validarApartado(t12, conA, 46, 6.5, 43)).not.toBeNull();
  });

  it("permite hectáreas con decimales", () => {
    expect(validarApartado(t12, [], 46, 3.75, 44)).toBeNull();
  });

  it("estatus: parcialmente planeada → planeada completa → plantada parcial → plantada completa", () => {
    expect(estatusTabla(t12, [])).toBe("libre");
    expect(estatusTabla(t12, [lote({ id: "a", ha: 6, semanaPlaneada: 46 })])).toBe("parcial-planeada");
    expect(estatusTabla(t12, [lote({ id: "a", ha: 12, semanaPlaneada: 46 })])).toBe("planeada");
    expect(
      estatusTabla(t12, [lote({ id: "a", ha: 12, semanaPlaneada: 44, avances: [av(44, 4)] })]),
    ).toBe("plantada-parcial");
    expect(
      estatusTabla(t12, [lote({ id: "a", ha: 12, semanaPlaneada: 44, avances: [av(44, 12)] })]),
    ).toBe("plantada");
  });

  it("6 planeadas y 4 plantadas: al cerrar la semana las 2 restantes pasan al lote 1-A2", () => {
    const a = lote({
      id: "a",
      ha: 6,
      semanaPlaneada: 44,
      avances: [av(44, 4)],
      insumos: [{ productoId: "cinta", cantidad: 12.6, pedidoId: "p" }],
    });
    const out = cerrarSemana([a], 44, () => "nuevo");
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ id: "a", ha: 4 });
    expect(out[0]!.insumos[0]!.cantidad).toBe(8.4);
    expect(out[1]).toMatchObject({ id: "nuevo", codigo: "1-A2", ha: 2, semanaPlaneada: 45, origenId: "a" });
    expect(out[1]!.insumos[0]!.cantidad).toBe(4.2);
    expect(codigoArrastre({ ...a, codigo: "1-A2" })).toBe("1-A3");
  });

  it("el avance se aplica primero al lote más antiguo", () => {
    const ls = [
      lote({ id: "viejo", ha: 2, semanaPlaneada: 44, origenId: "x" }),
      lote({ id: "nuevo", ha: 6, semanaPlaneada: 45 }),
    ];
    expect(repartirAvance(ls, 5, 45)).toEqual([
      { loteId: "viejo", ha: 2 },
      { loteId: "nuevo", ha: 3 },
    ]);
    expect(validarAvance(ls, 8.5, 45)).not.toBeNull();
  });
});

describe("Paquete de planeación (semana -2)", () => {
  it("se pide al planear: receta -2 × hectáreas planeadas, con adicionales de la tabla", () => {
    const ad: Adicional[] = [
      { id: "x", ranchoId: "r", tablaIds: ["t1"], productoId: "yeso", semanas: [-2], dosis: 200, motivo: "salino" },
    ];
    const lineas = lineasPlaneacion(receta, ad, "t1", 6);
    expect(lineas.find((l) => l.productoId === "cinta")?.cantidad).toBe(12.6);
    expect(lineas.find((l) => l.productoId === "yeso")?.cantidad).toBe(4200);
    // Otra tabla no lleva el adicional
    expect(lineasPlaneacion(receta, ad, "t2", 6).find((l) => l.productoId === "yeso")?.cantidad).toBe(3000);
  });

  it("semáforo: amarillo en tiempo, rojo desde la semana P-1 sin entregar, verde entregado", () => {
    const p: PedidoPlaneacion = {
      id: "p", loteId: "a", tablaId: "t1", ranchoId: "r", semanaPlantacion: 47, ha: 6,
      lineas: [], fecha: "2026-10-28", ingeniero: "Israel", urgente: false, status: "pendiente",
    };
    expect(semaforoPedido(p, 45)).toBe("amarillo");
    expect(semaforoPedido(p, 46)).toBe("rojo");
    expect(semaforoPedido({ ...p, status: "entregado" }, 46)).toBe("verde");
  });

  it("planeación con menos de 2 semanas es tardía pero no se bloquea", () => {
    expect(esPlaneacionTardia(45, 44)).toBe(true);
    expect(esPlaneacionTardia(46, 44)).toBe(false);
    expect(validarApartado(t12, [], 45, 6, 44)).toBeNull();
  });

  it("los pendientes con insumos entregados se ofrecen y se descuentan del pedido", () => {
    const pedidos: PedidoPlaneacion[] = [
      { id: "p", loteId: "a", tablaId: "t1", ranchoId: "r", semanaPlantacion: 43, ha: 2,
        lineas: [], fecha: "", ingeniero: "", urgente: false, status: "entregado" },
    ];
    const pend = lote({ id: "a", ha: 2, semanaPlaneada: 43, insumos: [{ productoId: "cinta", cantidad: 4.2, pedidoId: "p" }] });
    expect(pendientesConInsumos([pend], pedidos, "r", 44).map((l) => l.id)).toEqual(["a"]);
    expect(pendientesConInsumos([{ ...pend, sinInsumos: true }], pedidos, "r", 44)).toEqual([]);
    expect(descontar([{ productoId: "cinta", cantidad: 6.3 }], pend.insumos)).toEqual([
      { productoId: "cinta", cantidad: 2.1 },
    ]);
  });
});

describe("Entregar semana N y comprar N+2", () => {
  const ls = [
    lote({ id: "t1", tablaId: "t1", codigo: "1-A", ha: 5, semanaPlaneada: 40, avances: [av(40, 5)] }),
    lote({ id: "t2", tablaId: "t2", codigo: "2-A", ha: 3, semanaPlaneada: 41, avances: [av(41, 3)] }),
  ];

  it("caso obligatorio: en la sem 45 se entrega receta 5 × 5 ha + receta 4 × 3 ha", () => {
    const l45 = lineasSemana(ls, R(receta), [], [45]);
    expect(l45.find((l) => l.loteId === "t1")).toMatchObject({ semanaReceta: 5, cantidad: 105 * 5 });
    expect(l45.find((l) => l.loteId === "t2")).toMatchObject({ semanaReceta: 4, cantidad: 104 * 3 });
  });

  it("caso obligatorio: se compra para la sem 47 receta 7 × 5 ha + receta 6 × 3 ha", () => {
    const l47 = lineasSemana(ls, R(receta), [], [47]);
    expect(l47.find((l) => l.loteId === "t1")).toMatchObject({ semanaReceta: 7, cantidad: 107 * 5 });
    expect(l47.find((l) => l.loteId === "t2")).toMatchObject({ semanaReceta: 6, cantidad: 106 * 3 });
  });

  it("solo cuenta hectáreas realmente plantadas y no repite la semana -2", () => {
    const parcial = lote({ id: "p", ha: 6, semanaPlaneada: 44, avances: [av(44, 4)] });
    expect(lineasLote(parcial, R(receta), [], 45)[0]?.cantidad).toBe(101 * 4);
    const sinPlantar = lote({ id: "s", ha: 6, semanaPlaneada: 46 });
    expect(lineasLote(sinPlantar, R(receta), [], 44)).toEqual([]);
  });

  it("el ciclo inicia en la semana real de plantación, no en la planeada", () => {
    const tarde = lote({ id: "x", ha: 2, semanaPlaneada: 43, avances: [av(44, 2)] });
    expect(lineasLote(tarde, R(receta), [], 46)[0]?.semanaReceta).toBe(2);
  });

  it("los rollos se redondean hacia arriba después de sumar los lotes del rancho", () => {
    const cinta: Receta = { dosis: { 0: { cinta: 2.1 } } };
    const dos = [
      lote({ id: "a", ha: 1, semanaPlaneada: 44, avances: [av(44, 1)] }),
      lote({ id: "b", ha: 1, semanaPlaneada: 44, avances: [av(44, 1)], tablaId: "t2" }),
    ];
    const [fila] = consolidar(lineasSemana(dos, R(cinta), [], [44]), productos, {}, 44);
    expect(fila?.cantidad).toBe(4.2);
    expect(fila?.cantidadPedido).toBe(5);
  });

  it("la receta del lote se fija al plantarse: cambios posteriores no la afectan", () => {
    const copia = recetaEfectiva(receta, [], "t1");
    const plantado = lote({ id: "f", ha: 1, semanaPlaneada: 40, avances: [av(40, 1)], receta: copia });
    const nueva: Receta = { dosis: { ...receta.dosis, 5: { urea: 999 } } };
    expect(lineasLote(plantado, R(nueva), [], 45)[0]?.cantidad).toBe(105);
  });
});

describe("Catálogos", () => {
  it("radio automático = √(ha × 10,000 ÷ 3.1416) × 1.5 con mínimo de 100 m", () => {
    expect(radioValidacion({ ...t12, hectareas: 12 })).toBe(293);
    expect(radioValidacion({ ...t12, hectareas: 0.2 })).toBe(100);
    expect(radioValidacion({ ...t12, radio: 250 })).toBe(250);
  });
});

describe("Variedades y ciclo", () => {
  it("Diamante (10 semanas) recibe receta hasta la semana 10; Tlaloc (12) hasta la 12", () => {
    const diamante = lote({ id: "d", ha: 1, semanaPlaneada: 30, avances: [av(30, 1)], variedadId: "diamante", cicloDias: 70 });
    const tlaloc = lote({ id: "t", ha: 1, semanaPlaneada: 30, avances: [av(30, 1)] });
    expect(semanaCosechaLote(diamante)).toBe(10);
    expect(semanaCosechaLote(tlaloc)).toBe(12);
    expect(lineasLote(diamante, R(receta), [], 40)[0]?.semanaReceta).toBe(10);
    expect(lineasLote(diamante, R(receta), [], 41)).toEqual([]);
    expect(lineasLote(tlaloc, R(receta), [], 42)[0]?.semanaReceta).toBe(12);
    expect(lineasLote(tlaloc, R(receta), [], 43)).toEqual([]);
  });

  it("coliflor: 95 días de la plantación a la cosecha", () => {
    const col = lote({
      id: "c", ha: 4, semanaPlaneada: 44, cultivo: "coliflor", variedadId: "altamira", cicloDias: 95,
      avances: [{ id: "x", fecha: "2026-10-29", semana: 44, ha: 4 }],
    });
    expect(fechaCosechaLote(col)).toBe("2027-02-01");
    expect(semanaCosechaLote(col)).toBe(14);
  });

  it("un lote de coliflor sin receta no genera compras", () => {
    const col = lote({ id: "c", ha: 4, semanaPlaneada: 40, avances: [av(40, 4)], cultivo: "coliflor", cicloDias: 95 });
    expect(lineasSemana([col], R(receta), [], [44, 46])).toEqual([]);
  });

  it("dos semanas después de la cosecha el lote se finaliza y la tabla queda libre", () => {
    const t: Tabla = { id: "t1", ranchoId: "r", nombre: "Tabla 7", hectareas: 6.5 };
    const viejo = lote({ id: "v", ha: 6.5, semanaPlaneada: 25, avances: [av(25, 6.5)], fechaCosecha: "2026-09-15" });
    expect(semanaCosechaLote(viejo)).toBe(13);
    expect(finalizarCosechados([viejo], 39)[0]!.finalizado).toBeUndefined();
    const [fin] = finalizarCosechados([viejo], 40);
    expect(fin!.finalizado).toBe(true);
    expect(hectareasDisponibles(t, [fin!])).toBe(6.5);
    expect(hectareasActivas([fin!], "t1", 40)).toBe(0);
  });

  it("la etapa de cosecha depende de la variedad", () => {
    expect(etapa(10, 10)).toBe("Cosecha");
    expect(etapa(10, 12)).toBe("Desarrollo");
  });
});

describe("Datos reales cargados", () => {
  it("variedades: Diamante 10 semanas, Tlaloc 12 semanas, coliflor 95 días", () => {
    const ciclo = Object.fromEntries(VARIEDADES.map((v) => [v.id, v.cicloDias]));
    expect(ciclo).toEqual({ diamante: 70, tlaloc: 84, altamira: 95 });
  });

  it("paquete de planeación de brócoli: GOAL 2XL 1 L, Dual Gold 1 L, cintilla 2 rollos, Silifosca 300 kg por ha", () => {
    expect(RECETAS_INICIALES.brocoli.dosis[-2]).toEqual({ goal: 1, dualgold: 1, cintilla: 2, silifosca: 300 });
    expect(RECETAS_INICIALES.coliflor.dosis).toEqual({});
  });

  it("arranca sin ranchos, tablas ni plantaciones (el usuario los captura)", () => {
    expect(RANCHOS_INICIALES).toEqual([]);
    expect(TABLAS_INICIALES).toEqual([]);
    expect(LOTES_INICIALES).toEqual([]);
    expect(PEDIDOS_INICIALES).toEqual([]);
  });
});

describe("Captura de ranchos, tablas y plantaciones", () => {
  const ranchos = [{ id: "r", nombre: "Dolores", zona: "Dolores" }];

  it("no se repite el nombre de un rancho", () => {
    expect(validarRancho("dolores ", ranchos)).not.toBeNull();
    expect(validarRancho("Trejo", ranchos)).toBeNull();
  });

  it("una tabla necesita rancho, nombre único en su rancho y hectáreas", () => {
    expect(validarTabla("r", "Tabla 2", 4, ranchos, [t12])).toBeNull();
    expect(validarTabla("r", "tabla 1", 4, ranchos, [t12])).not.toBeNull();
    expect(validarTabla("r", "Tabla 2", 0, ranchos, [t12])).not.toBeNull();
    expect(validarTabla("x", "Tabla 2", 4, ranchos, [t12])).not.toBeNull();
  });

  it("plantación ya hecha: no puede ser futura ni pasar las hectáreas libres", () => {
    expect(validarPlantacionPrevia(t12, [], 6, "2026-10-15", "2026-10-30")).toBeNull();
    expect(validarPlantacionPrevia(t12, [], 6, "2026-11-02", "2026-10-30")).not.toBeNull();
    expect(validarPlantacionPrevia(t12, [], 12.5, "2026-10-15", "2026-10-30")).not.toBeNull();
    expect(validarPlantacionPrevia(t12, [], 6, "2026-10-15", "2026-10-30", "2026-10-10")).not.toBeNull();
  });

  it("plantación ya hecha de 4 ha de Diamante: plantada completa y paquete de planeación entregado", () => {
    let n = 0;
    const diamante = VARIEDADES.find((v) => v.id === "diamante")!;
    const { lote: l, pedido } = crearLotePlantado({
      tabla: t12,
      lotes: [],
      ha: 4,
      variedad: diamante,
      fechaPlantacion: "2026-10-15",
      recetas: RECETAS_INICIALES,
      adicionales: [],
      ingeniero: "Israel",
      nuevoId: (p) => `${p}${++n}`,
    });
    expect(l.codigo).toBe("1-A");
    expect(l.avances).toHaveLength(1);
    expect(l.avances[0]!.ha).toBe(4);
    expect(semanaCosechaLote(l)).toBe(10);
    expect(pedido?.status).toBe("entregado");
    expect(pedido?.lineas).toContainEqual({ productoId: "silifosca", cantidad: 1200 });
    expect(hectareasDisponibles(t12, [l])).toBe(8);
  });
});

describe("Corrección de fechas (solo administrador)", () => {
  const plantado = lote({
    id: "l1",
    ha: 4,
    semanaPlaneada: 42,
    variedadId: "diamante",
    cicloDias: 70,
    avances: [{ id: "a1", fecha: "2026-10-15", semana: 42, ha: 4 }],
  });

  it("solo el administrador puede corregir fechas; ingeniero y compras no", () => {
    expect(puedeCorregirFechas("admin")).toBe(true);
    expect(puedeCorregirFechas("ingeniero")).toBe(false);
    expect(puedeCorregirFechas("compras")).toBe(false);
    expect(puedeCorregirFechas(null)).toBe(false);
  });

  it("al mover la plantación del 15 al 8 oct, el lote pasa a la semana 41 y la cosecha se recalcula con el ciclo", () => {
    const r = corregirFechasLote(plantado, { avances: { a1: "2026-10-08" } }, "2026-10-30");
    if ("error" in r) throw new Error(r.error);
    expect(semanaRealLote(r.lote)).toBe(41);
    expect(r.lote.semanaPlaneada).toBe(41);
    expect(fechaCosechaLote(r.lote)).toBe("2026-12-17");
  });

  it("la cosecha capturada a mano se respeta; vacía vuelve al ciclo", () => {
    const r = corregirFechasLote(plantado, { avances: {}, fechaCosecha: "2027-01-05" }, "2026-10-30");
    if ("error" in r) throw new Error(r.error);
    expect(fechaCosechaLote(r.lote)).toBe("2027-01-05");
    const r2 = corregirFechasLote(r.lote, { avances: {}, fechaCosecha: "" }, "2026-10-30");
    if ("error" in r2) throw new Error(r2.error);
    expect(fechaCosechaLote(r2.lote)).toBe("2026-12-24");
  });

  it("no acepta plantación futura ni cosecha antes de la plantación", () => {
    expect("error" in corregirFechasLote(plantado, { avances: { a1: "2026-11-05" } }, "2026-10-30")).toBe(true);
    expect("error" in corregirFechasLote(plantado, { avances: {}, fechaCosecha: "2026-10-10" }, "2026-10-30")).toBe(true);
  });
});
