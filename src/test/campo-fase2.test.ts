import { describe, expect, it } from "vitest";

import {
  cargosPlanta,
  costoPlantaLote,
  costoPorPlanta,
  cuentaPlanta,
  diferenciaPlantas,
  faltantesSolicitud,
  registrarEntregaPlanta,
  solicitudesAlCancelarLote,
  folioSolicitud,
  lineasSolicitud,
  lotesParaSolicitud,
  pedidosQueLleganEnSemana,
  plantaQueLlegaEnSemana,
  semanaDeFecha,
  siguienteFolio,
  validarPlantasSolicitud,
  validarRecepcionPlanta,
  validarSolicitud,
} from "@/lib/campo/calc";
import type {
  Lote,
  MovimientoPlanta,
  Parametro,
  PedidoPlaneacion,
  SolicitudPlanta,
} from "@/lib/campo/types";

function lote(p: Partial<Lote> & { id: string }): Lote {
  return {
    codigo: "1-A",
    tablaId: "t1",
    ranchoId: "r",
    ha: 5,
    semanaPlaneada: 47,
    ingeniero: "Israel",
    avances: [],
    insumos: [],
    variedadId: "tlaloc",
    cultivo: "brocoli",
    cicloDias: 84,
    ...p,
  };
}

const params: Parametro[] = [
  { id: "a", clave: "plantasPorHa", valor: 60000, desde: "2026-01-01" },
  { id: "b", clave: "costoPlantaHa", valor: 16200, desde: "2026-01-01" },
];

function solicitud(p: Partial<SolicitudPlanta> & { lotes: Lote[] }): SolicitudPlanta {
  const { lotes, ...resto } = p;
  return {
    id: "sp1",
    folio: 1,
    fecha: "2026-11-02",
    viveroId: "v1",
    vivero: { nombre: "Vivero", contacto: "", telefono: "", correo: "" },
    lineas: lineasSolicitud(lotes, {
      ranchos: [],
      tablas: [],
      variedades: [],
      plantasPorHa: 60000,
    }),
    ingeniero: "Israel",
    status: "generada",
    ...resto,
  };
}

describe("Fase 2 · solicitud de planta", () => {
  it("folio consecutivo SP-0001, SP-0002…", () => {
    expect(folioSolicitud(1)).toBe("SP-0001");
    expect(siguienteFolio([])).toBe(1);
    expect(siguienteFolio([solicitud({ lotes: [], folio: 7 })])).toBe(8);
  });

  it("un lote arrastrado no genera nueva solicitud, ni uno que ya tiene una vigente", () => {
    const a = lote({ id: "a" });
    const arr = lote({ id: "b", origenId: "a" });
    const c = lote({ id: "c" });
    const vigente = solicitud({ lotes: [c] });
    expect(lotesParaSolicitud([a, arr, c], [vigente]).map((l) => l.id)).toEqual(["a"]);
    // Al cancelar la solicitud, el lote puede pedir planta de nuevo.
    expect(lotesParaSolicitud([c], [{ ...vigente, status: "cancelada" }]).map((l) => l.id)).toEqual(
      ["c"],
    );
  });

  it("consolidada: mismo vivero y misma semana de plantación", () => {
    const a = lote({ id: "a", semanaPlaneada: 47 });
    const b = lote({ id: "b", semanaPlaneada: 48 });
    const otroVivero = lote({ id: "c", semanaPlaneada: 47, viveroId: "v2" });
    expect(validarSolicitud([a, b], "v1", [a, b])).toMatch(/misma semana/);
    expect(validarSolicitud([a, otroVivero], "v1", [a, otroVivero])).toMatch(/otro vivero/);
    expect(validarSolicitud([a], "", [a])).toMatch(/vivero/);
    expect(validarSolicitud([a], "v1", [a])).toBeNull();
  });

  it("sin plantas capturadas, la solicitud lleva ha × 60,000", () => {
    const [l] = lineasSolicitud([lote({ id: "a", ha: 6 })], {
      ranchos: [],
      tablas: [],
      variedades: [],
      plantasPorHa: 60000,
    });
    expect(l!.plantas).toBe(360000);
  });

  it("planta recibida: foto obligatoria y se marca la diferencia contra lo solicitado", () => {
    const s = solicitud({ lotes: [lote({ id: "a" })] });
    expect(
      validarRecepcionPlanta({ a: 290000 }, s.lineas, "2026-11-02", "2026-11-02", undefined),
    ).toMatch(/foto/);
    expect(
      validarRecepcionPlanta({ a: 290000 }, s.lineas, "2026-11-03", "2026-11-02", "f.jpg"),
    ).toMatch(/futura/);
    expect(
      validarRecepcionPlanta({ a: 290000 }, s.lineas, "2026-11-02", "2026-11-02", "f.jpg"),
    ).toBeNull();
    expect(diferenciaPlantas({ ...s.lineas[0]!, plantasRecibidas: 290000 })).toBe(-10000);
  });
});

describe("Fase 2 · cuenta de planta", () => {
  it("caso de prueba: 300,000 plantas → $81,000; 2 viajes → saldo $61,000 y 24.7%", () => {
    const costo = costoPorPlanta(params, "2026-11-02");
    expect(costo).toBe(0.27);
    const s: SolicitudPlanta = {
      ...solicitud({ lotes: [lote({ id: "a", ha: 5, plantas: 300000 })] }),
      status: "recibida",
      recepcion: { fecha: "2026-11-02", foto: "f.jpg", costoPlanta: costo, plantasPorHa: 60000 },
    };
    s.lineas = s.lineas.map((l) => ({ ...l, plantasRecibidas: 300000 }));
    const cargos = cargosPlanta([s]);
    expect(cargos[0]!.monto).toBe(81000);
    expect(costoPlantaLote("a", cargos)).toBe(81000);

    const viajes: MovimientoPlanta[] = [
      { fecha: "2027-01-14", tipo: "abono", monto: 10000 },
      { fecha: "2027-01-18", tipo: "abono", monto: 10000 },
    ];
    const r = cuentaPlanta([...cargos, ...viajes], "2026-01-01", "2027-12-31");
    expect(r.cargos).toBe(81000);
    expect(r.descuentos).toBe(20000);
    expect(r.saldoPeriodo).toBe(61000);
    expect(r.relacion).toBe(24.7);
    expect(r.haEquivalentes).toBe(5);
  });

  it("el costo por planta es el vigente el día que llegó; un cambio posterior no recalcula", () => {
    const conCambio: Parametro[] = [
      ...params,
      { id: "c", clave: "costoPlantaHa", valor: 18000, desde: "2026-12-01" },
    ];
    expect(costoPorPlanta(conCambio, "2026-11-02")).toBe(0.27);
    expect(costoPorPlanta(conCambio, "2026-12-05")).toBe(0.3);
  });

  it("la cuenta no se cierra: el saldo acumulado arrastra periodos anteriores", () => {
    const movs: MovimientoPlanta[] = [
      { fecha: "2026-09-10", tipo: "cargo", monto: 50000, plantas: 185185, ha: 3.09 },
      { fecha: "2026-11-10", tipo: "abono", monto: 10000 },
    ];
    const nov = cuentaPlanta(movs, "2026-11-01", "2026-11-30");
    expect(nov.cargos).toBe(0);
    expect(nov.saldoPeriodo).toBe(-10000);
    expect(nov.saldoAcumulado).toBe(40000);
    expect(nov.relacion).toBeNull();
  });
});

describe("Fase 2 · plantas capturadas en la solicitud", () => {
  it("las plantas indicadas en la solicitud mandan sobre las del lote", () => {
    const [l] = lineasSolicitud([lote({ id: "a", ha: 5, plantas: 300000 })], {
      ranchos: [],
      tablas: [],
      variedades: [],
      plantasPorHa: 60000,
      plantas: { a: 310000 },
    });
    expect(l!.plantas).toBe(310000);
  });

  it("más de ±10% de ha × 60,000 pide motivo; dentro del rango no", () => {
    const a = lote({ id: "a", ha: 5 });
    expect(validarPlantasSolicitud([a], { a: 330000 }, {}, 60000)).toBeNull(); // 66,000/ha = +10%
    expect(validarPlantasSolicitud([a], { a: 350000 }, {}, 60000)).toMatch(/1-A.*motivo/);
    expect(validarPlantasSolicitud([a], { a: 350000 }, { a: "Más densidad" }, 60000)).toBeNull();
    expect(validarPlantasSolicitud([a], { a: NaN }, {}, 60000)).toMatch(/plantas/);
  });
});

describe("Fase 2 · entregas parciales y lotes cancelados", () => {
  const entrega = (recibidas: Record<string, number>, fecha = "2026-11-02") => ({
    fecha,
    foto: "ticket.jpg",
    recibidas,
    costoPlanta: 0.27,
    plantasPorHa: 60000,
  });

  it("si llega una parte queda parcial; con la segunda entrega queda recibida", () => {
    const s = solicitud({ lotes: [lote({ id: "a", ha: 5 })] }); // 300,000 plantas
    const p1 = registrarEntregaPlanta(s, entrega({ a: 200000 }));
    expect(p1.status).toBe("parcial");
    expect(faltantesSolicitud(p1)).toEqual({ a: 100000 });
    const p2 = registrarEntregaPlanta(p1, entrega({ a: 100000 }, "2026-11-05"));
    expect(p2.status).toBe("recibida");
    // Cada entrega es su propio cargo con su fecha.
    expect(cargosPlanta([p2]).map((c) => [c.fecha, c.monto])).toEqual([
      ["2026-11-02", 54000],
      ["2026-11-05", 27000],
    ]);
  });

  it("una parcial ya cobra lo que llegó, y se puede cerrar aunque falte", () => {
    const s = solicitud({ lotes: [lote({ id: "a", ha: 5 })] });
    const p1 = registrarEntregaPlanta(s, entrega({ a: 200000 }));
    expect(cargosPlanta([p1])[0]!.monto).toBe(54000);
    expect(registrarEntregaPlanta(s, entrega({ a: 200000 }), true).status).toBe("recibida");
  });

  it("la recepción pide foto del ticket y al menos una planta", () => {
    const s = solicitud({ lotes: [lote({ id: "a" })] });
    expect(validarRecepcionPlanta({ a: 0 }, s.lineas, "2026-11-02", "2026-11-02", "f.jpg")).toMatch(
      /cuántas/,
    );
    expect(
      validarRecepcionPlanta({ a: 10 }, s.lineas, "2026-11-02", "2026-11-02", undefined),
    ).toMatch(/ticket/);
  });

  it("al cancelar un lote se cancela su solicitud sin recibir; en una consolidada solo sale el lote", () => {
    const sola = solicitud({ id: "s1", lotes: [lote({ id: "a" })] });
    const consolidada = solicitud({
      id: "s2",
      folio: 2,
      status: "enviada",
      lotes: [lote({ id: "b" }), lote({ id: "c" })],
    });
    const recibida = {
      ...registrarEntregaPlanta(
        solicitud({ id: "s3", folio: 3, lotes: [lote({ id: "a" })] }),
        entrega({ a: 300000 }),
      ),
    };
    const [r1, r2, r3] = solicitudesAlCancelarLote(
      [sola, consolidada, recibida],
      "a",
      "2026-11-02",
    );
    expect(r1!.status).toBe("cancelada");
    expect(r3!.status).toBe("recibida");
    const [, r2b] = solicitudesAlCancelarLote([sola, consolidada], "b", "2026-11-02");
    expect(r2b!.status).toBe("enviada");
    expect(r2b!.lineas.map((l) => l.loteId)).toEqual(["c"]);
    expect(r2).toBe(consolidada);
  });
});

describe("Lo que llega al rancho", () => {
  it("la planta llega en la semana de su fecha de entrega; las canceladas no cuentan", () => {
    const s = solicitud({ lotes: [lote({ id: "a", semanaPlaneada: 47 })] });
    const semana = semanaDeFecha(s.lineas[0]!.fechaEntrega);
    expect(plantaQueLlegaEnSemana([s], semana)).toHaveLength(1);
    expect(plantaQueLlegaEnSemana([s], semana + 1)).toHaveLength(0);
    expect(plantaQueLlegaEnSemana([{ ...s, status: "cancelada" }], semana)).toHaveLength(0);
  });

  it("el pedido de planeación llega 2 semanas antes de plantar", () => {
    const p = {
      id: "p",
      loteId: "a",
      tablaId: "t",
      ranchoId: "r",
      semanaPlantacion: 48,
      ha: 6,
      lineas: [],
      fecha: "",
      ingeniero: "",
      urgente: false,
      status: "pendiente",
    } as unknown as PedidoPlaneacion;
    expect(pedidosQueLleganEnSemana([p], 46)).toHaveLength(1);
    expect(pedidosQueLleganEnSemana([p], 47)).toHaveLength(0);
    expect(pedidosQueLleganEnSemana([{ ...p, status: "cancelado" }], 46)).toHaveLength(0);
  });
});
