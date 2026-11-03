import { useMemo } from "react";

import {
  cargosPlanta,
  costoDevolucionesLote,
  costoExtraLote,
  costoLineas,
  costoPlaneacionLote,
  costoPlantaLote,
  estatusLinea,
  lineasSemana,
} from "./calc";
import { useFase3 } from "./fase3";
import { useCampo } from "./store";
import type { LineaDemanda } from "./types";

/** Gasto directo de cada lote: receta recibida + planeación + planta real + extraordinarios surtidos − devoluciones. */
export function useCostos() {
  const { lotes, recetas, adicionales, productos, recepciones, pedidos, semanaActual, solicitudes } = useCampo();
  const { extraordinarios, devoluciones } = useFase3();
  return useMemo(() => {
    const cargos = cargosPlanta(solicitudes);
    const plantaLote = (loteId: string) => costoPlantaLote(loteId, cargos);
    // Desde la primera plantación registrada hasta hoy.
    const desde = Math.min(semanaActual, ...lotes.flatMap((l) => l.avances.map((a) => a.semana)));
    const semanas = Array.from({ length: semanaActual - desde + 1 }, (_, i) => desde + i);
    const recibidas = lineasSemana(lotes, recetas, adicionales, semanas).filter(
      (l) => estatusLinea(l, recepciones, semanaActual) === "recibido",
    );
    const porLote = new Map<string, LineaDemanda[]>();
    for (const l of recibidas) porLote.set(l.loteId, [...(porLote.get(l.loteId) ?? []), l]);
    const costoLote = (loteId: string) => {
      const lote = lotes.find((x) => x.id === loteId);
      const semanal = costoLineas(porLote.get(loteId) ?? [], productos, recepciones);
      // Planta: costo real (plantas recibidas × costo por planta). Los descuentos por viaje no se cargan al lote.
      // Extraordinarios autorizados (por ha) suman; lo que el Almacén retiró se resta.
      return (
        semanal +
        (lote ? costoPlaneacionLote(lote, pedidos, productos) : 0) +
        plantaLote(loteId) +
        costoExtraLote(loteId, extraordinarios) -
        costoDevolucionesLote(loteId, devoluciones)
      );
    };
    const costoTabla = (tablaId: string, pasa: (l: (typeof lotes)[number]) => boolean = () => true) =>
      lotes.filter((l) => l.tablaId === tablaId && pasa(l)).reduce((s, l) => s + costoLote(l.id), 0);
    return { porLote, costoLote, costoTabla, plantaLote };
  }, [lotes, recetas, adicionales, productos, recepciones, pedidos, semanaActual, solicitudes, extraordinarios, devoluciones]);
}

