import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CICLOS_PLANTACION, perteneceCicloPlantacion, fechaPlantacionLote, fechaCosechaLote, formatoNum, formatoMXN, loteEnCosecha, rendimientoLote, totalesPanel } from "@/lib/campo/calc";
import { useCampo } from "@/lib/campo/store";
import { useCosecha } from "@/lib/campo/cosecha";
import { useCostos } from "@/lib/campo/costos";
import { useFiltro } from "@/lib/campo/filtro";

export function CiclosPlantacion() {
  const [ciclo, setCiclo] = useState("2026-1");
  const { lotes, tablas, ranchos, parametros, semanaActual } = useCampo();
  const { ciclos, viajes } = useCosecha();
  const { costoLote } = useCostos();
  const { pasaLote, pasaRancho, pasaCultivo } = useFiltro();
  const snapshots = ciclos.filter((c) => !c.reabierto);
  const idsCerrados = new Set(snapshots.flatMap((c) => c.loteId ? [c.loteId] : []));
  const nombre = (ranchoId: string, tablaId: string) => `${ranchos.find((r) => r.id === ranchoId)?.nombre ?? ranchoId} · ${tablas.find((t) => t.id === tablaId)?.nombre ?? tablaId}`;
  const actuales = lotes.filter((l) => !l.cancelado && !idsCerrados.has(l.id) && pasaLote(l) && perteneceCicloPlantacion(fechaPlantacionLote(l), ciclo)).map((l) => {
    const r = rendimientoLote(l, viajes, parametros, costoLote(l.id));
    return { id: l.id, nombre: nombre(l.ranchoId, l.tablaId), folio: l.folioProgramacion || l.codigo, fecha: fechaPlantacionLote(l), cosecha: fechaCosechaLote(l), ha: l.ha, kgBrutos: r.kgBrutos, kgPagables: r.kgPagables, costo: r.gasto, nomina: 0, estado: l.cerrado ? "Cerrado" : l.finalizado || l.cosechaTerminada ? "Pendiente de cierre" : loteEnCosecha(l, semanaActual) ? "En cosecha" : l.avances.length ? "Plantado" : "Planeado" };
  });
  const historicos = snapshots.filter((c) => pasaRancho(c.ranchoId) && pasaCultivo(c.cultivo) && perteneceCicloPlantacion(c.fechaPlantacion, ciclo)).map((c) => ({ id: c.id, nombre: nombre(c.ranchoId, c.tablaId), folio: c.codigo, fecha: c.fechaPlantacion, cosecha: c.importacion?.fechaInicioCosecha || c.fechaFinCosecha, ha: c.ha, kgBrutos: c.kgBrutos, kgPagables: c.kgPagables, costo: c.insumos + c.planta + c.gastosComunes, nomina: 0, estado: c.conPendientes || c.importacion?.pendiente ? "Histórico con pendientes" : "Cerrado" }));
  const filas = [...actuales, ...historicos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const total = totalesPanel(filas);
  return <section className="space-y-5" aria-label="Ciclos de plantación">
    <Select value={ciclo} onValueChange={setCiclo}><SelectTrigger aria-label="Ciclo de plantación" className="w-full sm:w-80"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos los ciclos</SelectItem>{CICLOS_PLANTACION.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent></Select>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[["Plantaciones", formatoNum(filas.length)], ["Superficie plantada y planeada", `${formatoNum(total.ha)} ha`], ["Kg pagables registrados", formatoNum(total.kgPagables)], ["Kg pagables / ha", formatoNum(total.kgHa)]].map(([label, valor]) => <div key={label} className="border-l-2 border-primary pl-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-mono text-xl font-semibold">{valor}</p></div>)}</div>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted text-left"><tr>{["Rancho · tabla · folio", "Plantación", "Inicio cosecha", "Estado", "Ha", "Kg pagables", "Kg/ha", "Gasto registrado"].map((h) => <th key={h} className="whitespace-nowrap p-3">{h}</th>)}</tr></thead><tbody>{filas.map((f) => <tr key={f.id} className="border-b border-border"><td className="min-w-56 p-3"><strong>{f.nombre}</strong><span className="block text-xs text-muted-foreground">{f.folio}</span></td><td className="whitespace-nowrap p-3">{f.fecha}</td><td className="whitespace-nowrap p-3">{f.cosecha || "—"}</td><td className="p-3"><Badge variant="outline">{f.estado}</Badge></td>{[formatoNum(f.ha), formatoNum(f.kgPagables), formatoNum(f.ha ? f.kgPagables / f.ha : 0), formatoMXN(f.costo)].map((v, i) => <td key={i} className="whitespace-nowrap p-3 text-right font-mono">{v}</td>)}</tr>)}{!filas.length && <tr><td colSpan={8} className="p-4 text-muted-foreground">Sin plantaciones en este ciclo con los filtros seleccionados.</td></tr>}</tbody></table></div>
  </section>;
}