import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarDays, Sprout, Tractor, Wallet, Wheat, Users, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/campo/AppShell";
import { PanelMulti } from "@/components/campo/PanelFiltros";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCampo } from "@/lib/campo/store";
import { useCosecha } from "@/lib/campo/cosecha";
import { useCostos } from "@/lib/campo/costos";
import { useFase3 } from "@/lib/campo/fase3";
import { useGastos } from "@/lib/campo/gastos";
import { useFiltro, useFiltroEstado } from "@/lib/campo/filtro";
import { consumoProductosLote, fechaCorta, fechaCosechaLote, fechaEnSemana, fechaPlantacionLote, pendientesLote, plantacionPanel, plantadasLote, prorrateoRango, semanaDeFecha, totalesPanel } from "@/lib/campo/calc";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({ meta: [{ title: "Panel de Dirección · Ultra Farms" }, { name: "description", content: "Plantaciones, cosechas, costos, aplicaciones y nómina por tabla y rancho." }, { property: "og:title", content: "Panel de Dirección · Ultra Farms" }, { property: "og:description", content: "Comparativos de campo con filtros de fechas, semanas, ranchos, cultivos y tablas." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Panel,
});
const entero = (n: number) => new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(n);
const dinero = (n: number) => `$${entero(n)}`;
const area = (n: number) => new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(n);

function Grafica({ titulo, datos, series, moneda = false }: { titulo: string; datos: Record<string, string | number>[]; series: { key: string; nombre: string; color: string }[]; moneda?: boolean }) {
  return <section className="min-w-0 space-y-3 border-t border-border pt-5"><h2 className="text-xl font-semibold">{titulo}</h2>{datos.length ? <div className="overflow-x-auto"><div className={datos.length > 12 ? "h-72 min-w-[1600px]" : datos.length > 6 ? "h-72 min-w-[900px]" : "h-72 w-full"}><ResponsiveContainer width="100%" height="100%"><BarChart data={datos} margin={{ bottom: 35, right: 10 }}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="nombre" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval={0} angle={-25} textAnchor="end" /><YAxis width={65} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(n) => moneda ? dinero(n) : entero(n)} /><Tooltip formatter={(n: number) => moneda ? dinero(n) : entero(n)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6 }} />{series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.nombre} fill={s.color} radius={[3, 3, 0, 0]} />)}</BarChart></ResponsiveContainer></div></div> : <p className="py-12 text-sm text-muted-foreground">Sin registros con estos filtros.</p>}<div className="flex flex-wrap gap-4 text-xs text-muted-foreground">{series.map((s) => <span key={s.key}>{s.nombre}</span>)}</div></section>;
}

function Panel() {
  return <AppShell path="/panel" eyebrow="Ultra Farms · Dirección" title="Panorama del campo" filtros><Contenido /></AppShell>;
}
function Contenido() {
  const { lotes, tablas, ranchos, variedades, productos, recepciones, pedidos, semanaActual, hoy } = useCampo();
  const { ciclos, viajes } = useCosecha();
  const { costoLote, porLote } = useCostos();
  const { extraordinarios, devoluciones } = useFase3();
  const { gastos, repartos } = useGastos();
  const { pasaLote, pasaRancho, pasaCultivo } = useFiltro();
  const { setRanchoIds, setCultivos } = useFiltroEstado();
  const [desde, setDesde] = useState(""); const [hasta, setHasta] = useState("");
  const [semana, setSemana] = useState(semanaActual);
  const [tablaIds, setTablaIds] = useState<string[]>([]); const [variedadIds, setVariedadIds] = useState<string[]>([]);
  const [estado, setEstado] = useState("vigentes"); const [fechaTipo, setFechaTipo] = useState("plantacion");
  const [grupo, setGrupo] = useState("tabla"); const [producto, setProducto] = useState(""); const [concepto, setConcepto] = useState("todos");
  const enFecha = (f: string) => (!desde || f >= desde) && (!hasta || f <= hasta);
  const base = lotes.filter((l) => !l.cancelado && pasaLote(l) && (!tablaIds.length || tablaIds.includes(l.tablaId)) && (!variedadIds.length || variedadIds.includes(l.variedadId)));
  const ls = base.filter((l) => {
    const vigente = !l.finalizado && !l.cerrado;
    const est = plantadasLote(l) === 0 ? "planeado" : fechaCosechaLote(l) <= hoy ? "cosecha" : "plantado";
    return (estado === "todos" || (vigente && (estado === "vigentes" || estado === est))) && enFecha(fechaTipo === "cosecha" ? fechaCosechaLote(l) : fechaPlantacionLote(l));
  });
  const ids = new Set(ls.map((l) => l.id));
  const hist = estado === "historicos" || estado === "todos" ? ciclos.filter((c) => !c.reabierto && pasaRancho(c.ranchoId) && pasaCultivo(c.cultivo) && (!tablaIds.length || tablaIds.includes(c.tablaId)) && (!variedadIds.length || (c.variedadId && variedadIds.includes(c.variedadId))) && enFecha(fechaTipo === "cosecha" ? c.importacion?.fechaInicioCosecha || c.fechaFinCosecha : c.fechaPlantacion)) : [];
  const histLotes = new Set(hist.flatMap((c) => c.loteId ? [c.loteId] : []));
  const inicioGasto = desde ? semanaDeFecha(desde) : -100; const finGasto = hasta ? semanaDeFecha(hasta) : 200;
  const reparto = prorrateoRango({ desde: inicioGasto, hasta: finGasto, lotes, gastos, repartos });
  const filas = ls.filter((l) => !histLotes.has(l.id)).map((l) => {
    const repartoViajes = viajes.filter((v) => v.status === "evaluado").flatMap((v) => v.evaluacion?.reparto ?? []).filter((r) => r.loteId === l.id);
    const comunes = reparto.porLoteConcepto[l.id] ?? {};
    return { id: l.id, tablaId: l.tablaId, ranchoId: l.ranchoId, nombre: `${ranchos.find((r) => r.id === l.ranchoId)?.nombre} · ${tablas.find((t) => t.id === l.tablaId)?.nombre} · ${l.codigo}`, ha: l.ha, kgBrutos: repartoViajes.reduce((s, r) => s + r.kgBrutos, 0), kgPagables: repartoViajes.reduce((s, r) => s + r.kgPagables, 0), costo: costoLote(l.id) + (reparto.porLote[l.id] ?? 0), nomina: comunes.nomina ?? 0, combustible: (comunes.diesel ?? 0) + (comunes.gasolina ?? 0), reparaciones: comunes.mantenimiento ?? 0, otros: (comunes.otros ?? 0) + (comunes.mano_obra_extra ?? 0), cosecha: fechaCosechaLote(l), pendiente: !repartoViajes.length && fechaCosechaLote(l) <= hoy && plantadasLote(l) > 0 };
  });
  for (const c of hist) {
    const gs = c.importacion?.gastos ?? [];
    filas.push({ id: c.id, tablaId: c.tablaId, ranchoId: c.ranchoId, nombre: `${ranchos.find((r) => r.id === c.ranchoId)?.nombre} · ${tablas.find((t) => t.id === c.tablaId)?.nombre} · ${c.codigo} (histórico)`, ha: c.ha, kgBrutos: c.kgBrutos, kgPagables: c.kgPagables, costo: c.insumos + c.planta + c.gastosComunes, nomina: gs.filter((g) => g.concepto === "nomina").reduce((s, g) => s + g.monto, 0), combustible: gs.filter((g) => g.concepto === "diesel" || g.concepto === "gasolina").reduce((s, g) => s + g.monto, 0), reparaciones: gs.filter((g) => g.concepto === "mantenimiento").reduce((s, g) => s + g.monto, 0), otros: gs.filter((g) => g.concepto === "otros" || g.concepto === "mano_obra_extra").reduce((s, g) => s + g.monto, 0), cosecha: c.importacion?.fechaInicioCosecha || c.fechaFinCosecha, pendiente: c.conPendientes });
  }
  const total = totalesPanel(filas);
  const semanaDatos = [semana - 1, semana, semana + 1].map((w) => ({ nombre: `Sem ${w}`, ...plantacionPanel(base.filter((l) => enFecha(fechaTipo === "cosecha" ? fechaCosechaLote(l) : fechaPlantacionLote(l))), w) }));
  const agrupados = new Map<string, typeof filas>();
  for (const f of filas) { const key = grupo === "rancho" ? f.ranchoId : f.tablaId; agrupados.set(key, [...(agrupados.get(key) ?? []), f]); }
  const comparativos = [...agrupados].map(([id, fs]) => ({ nombre: grupo === "rancho" ? ranchos.find((r) => r.id === id)?.nombre ?? id : `${ranchos.find((r) => r.id === fs[0]?.ranchoId)?.nombre} · ${tablas.find((t) => t.id === id)?.nombre}`, ...totalesPanel(fs), combustible: fs.reduce((s, f) => s + f.combustible, 0), reparaciones: fs.reduce((s, f) => s + f.reparaciones, 0), otros: fs.reduce((s, f) => s + f.otros, 0) }));
  const consumos: { lote: string; nombre: string; unidad: string; cantidad: number; ha: number }[] = [];
  for (const l of ls) {
    for (const a of l.aplicacionesPrevias ?? []) consumos.push({ lote: l.id, nombre: a.nombre, unidad: a.unidad, cantidad: a.cantidad, ha: l.ha });
    for (const c of consumoProductosLote(l, { lineas: porLote.get(l.id) ?? [], recepciones, pedidos, extraordinarios, devoluciones })) { const p = productos.find((p) => p.id === c.productoId); consumos.push({ lote: l.id, nombre: p?.nombre ?? c.productoId, unidad: p?.unidad ?? "", cantidad: c.neto, ha: l.ha }); }
  }
  for (const c of hist) for (const p of c.importacion?.productos ?? []) consumos.push({ lote: c.id, nombre: p.nombre, unidad: p.unidad, cantidad: p.cantidad, ha: c.ha });
  const nombres = [...new Set(consumos.map((c) => c.nombre))].sort();
  const productosGrupo = new Map<string, { nombre: string; unidad: string; cantidad: number }>();
  for (const c of consumos.filter((c) => !producto || c.nombre === producto)) { const key = `${c.nombre}|${c.unidad.toUpperCase()}`; const prev = productosGrupo.get(key); productosGrupo.set(key, { nombre: c.nombre, unidad: c.unidad, cantidad: (prev?.cantidad ?? 0) + c.cantidad }); }
  const agenda = ls.filter((l) => !l.finalizado && !l.cerrado && plantadasLote(l) > 0).sort((a, b) => fechaCosechaLote(a).localeCompare(fechaCosechaLote(b)));
  const siguiente = agenda.find((l) => fechaCosechaLote(l) >= hoy);
  const kpis = [{ icon: Sprout, nombre: "Plantado semana pasada", valor: `${area(semanaDatos[0]?.plantadas ?? 0)} ha` }, { icon: CalendarDays, nombre: "Por plantar esta semana", valor: `${area(semanaDatos[1]?.planeadas ?? 0)} ha` }, { icon: Tractor, nombre: "Por plantar próxima semana", valor: `${area(semanaDatos[2]?.planeadas ?? 0)} ha` }, { icon: Wheat, nombre: "Tablas activas", valor: entero(new Set(ls.filter((l) => !l.finalizado && !l.cerrado && plantadasLote(l) > 0).map((l) => l.tablaId)).size) }, { icon: Wallet, nombre: "Costo acumulado / ha", valor: dinero(total.costoHa) }, { icon: Users, nombre: "Nómina / ha", valor: dinero(total.nominaHa) }];
  return <div className="space-y-8">
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-1"><Label>Desde</Label><Input aria-label="Fecha desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
      <div className="space-y-1"><Label>Hasta</Label><Input aria-label="Fecha hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
      <div className="space-y-1"><Label>Fecha de</Label><Select value={fechaTipo} onValueChange={setFechaTipo}><SelectTrigger aria-label="Fecha de"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="plantacion">Plantación</SelectItem><SelectItem value="cosecha">Inicio de cosecha</SelectItem></SelectContent></Select></div>
      <div className="space-y-1"><Label>Semana de referencia</Label><Input aria-label="Semana de referencia" type="number" min="1" max="105" value={semana} onChange={(e) => setSemana(Number(e.target.value) || semanaActual)} /></div>
      <PanelMulti nombre="Tablas" valor={tablaIds} cambiar={setTablaIds} opciones={tablas.filter((t) => pasaRancho(t.ranchoId)).map((t) => ({ id: t.id, nombre: `${ranchos.find((r) => r.id === t.ranchoId)?.nombre} · ${t.nombre}` }))} />
      <PanelMulti nombre="Variedades" valor={variedadIds} cambiar={setVariedadIds} opciones={variedades.map((v) => ({ id: v.id, nombre: v.nombre }))} />
      <Select value={estado} onValueChange={setEstado}><SelectTrigger aria-label="Estado de plantaciones"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="vigentes">Vigentes (planeadas y plantadas)</SelectItem><SelectItem value="planeado">Planeadas</SelectItem><SelectItem value="plantado">Plantadas</SelectItem><SelectItem value="cosecha">En cosecha</SelectItem><SelectItem value="historicos">Históricos</SelectItem><SelectItem value="todos">Vigentes e históricos</SelectItem></SelectContent></Select>
      <Button variant="ghost" onClick={() => { setDesde(""); setHasta(""); setTablaIds([]); setVariedadIds([]); setEstado("vigentes"); setSemana(semanaActual); setProducto(""); setRanchoIds([]); setCultivos([]); }}><RotateCcw /> Restablecer filtros</Button>
    </section>
    {desde && hasta && desde > hasta ? <p role="alert" className="text-destructive">La fecha inicial debe ser anterior a la final.</p> : null}
    <p className="text-xs text-muted-foreground">Costos y consumos acumulados de las plantaciones seleccionadas. Nómina y gastos comunes del intervalo indicado. Semana de referencia: {fechaCorta(fechaEnSemana(semana))} al {fechaCorta(fechaEnSemana(semana, 6))}.</p>
    <section className="grid grid-cols-2 gap-4 xl:grid-cols-3">{kpis.map((k) => <div key={k.nombre} className="border-l-2 border-primary pl-4 py-2"><k.icon className="mb-2 size-5 text-primary" /><p className="text-xs text-muted-foreground">{k.nombre}</p><p className="mt-1 font-mono text-2xl font-semibold">{k.valor}</p></div>)}</section>
    <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-4"><span className="text-sm">{filas.length} plantaciones · {area(total.ha)} ha · {entero(total.kgPagables)} kg pagables · {dinero(total.costo)} de gasto</span><Select value={grupo} onValueChange={setGrupo}><SelectTrigger className="w-44" aria-label="Comparar por"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tabla">Por tabla</SelectItem><SelectItem value="rancho">Por rancho</SelectItem></SelectContent></Select></div>
    <div className="grid gap-8 xl:grid-cols-2"><Grafica titulo="Plantación · tres semanas" datos={semanaDatos} series={[{ key: "plantadas", nombre: "Plantadas (ha)", color: "var(--primary)" }, { key: "planeadas", nombre: "Por plantar (ha)", color: "var(--chart-2)" }]} /><Grafica titulo="Kilos por hectárea" datos={comparativos} series={[{ key: "kgHa", nombre: "Kg pagables / ha", color: "var(--primary)" }]} /><Grafica titulo="Gasto por hectárea" datos={comparativos} moneda series={[{ key: "costoHa", nombre: "Costo acumulado / ha", color: "var(--chart-2)" }]} /><Grafica titulo="Nómina por hectárea" datos={comparativos} moneda series={[{ key: "nominaHa", nombre: "Nómina / ha", color: "var(--primary)" }]} /></div>
    <section className="space-y-4 border-t border-border pt-5"><h2 className="text-xl font-semibold">Cosecha · calendario</h2><p className="text-sm">Próximo inicio: <strong>{siguiente ? `${fechaCorta(fechaCosechaLote(siguiente))} · ${tablas.find((t) => t.id === siguiente.tablaId)?.nombre}` : "Sin inicios futuros registrados"}</strong></p><div className="grid gap-2 sm:grid-cols-2">{agenda.map((l) => <div key={l.id} className="flex gap-3 border-b border-border py-3"><CalendarDays className="size-5 shrink-0 text-primary" /><div className="min-w-0 text-sm"><strong>{ranchos.find((r) => r.id === l.ranchoId)?.nombre} · {tablas.find((t) => t.id === l.tablaId)?.nombre}</strong><p className="text-muted-foreground">{fechaCorta(fechaCosechaLote(l))} · {area(l.ha)} ha · {fechaCosechaLote(l) < hoy ? "Inicio ya registrado" : "Inicio previsto"}</p>{filas.find((f) => f.id === l.id)?.pendiente && <p className="text-destructive">Pendiente de cargar viajes</p>}</div></div>)}</div></section>
    <section className="space-y-4 border-t border-border pt-5"><h2 className="text-xl font-semibold">Gastos de rancho y tabla</h2><Select value={concepto} onValueChange={setConcepto}><SelectTrigger className="w-60" aria-label="Comparar gasto"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos los gastos comunes</SelectItem><SelectItem value="nomina">Nómina</SelectItem><SelectItem value="combustible">Combustible</SelectItem><SelectItem value="reparaciones">Reparaciones</SelectItem><SelectItem value="otros">Otros gastos</SelectItem></SelectContent></Select><Grafica titulo="Comparativo de gastos comunes" datos={comparativos} moneda series={(concepto === "todos" ? ["nomina", "combustible", "reparaciones", "otros"] : [concepto]).map((key, i) => ({ key, nombre: key === "nomina" ? "Nómina" : key === "combustible" ? "Combustible" : key === "reparaciones" ? "Reparaciones" : "Otros", color: i % 2 ? "var(--chart-2)" : "var(--primary)" }))} />{reparto.noAsignado.filter((n) => pasaRancho(n.ranchoId) && pasaCultivo(n.cultivo)).length > 0 && <p className="text-sm text-destructive">Gasto no asignado a tablas: {dinero(reparto.noAsignado.filter((n) => pasaRancho(n.ranchoId) && pasaCultivo(n.cultivo)).reduce((s, n) => s + n.monto, 0))}</p>}</section>
    <section className="space-y-4 border-t border-border pt-5"><h2 className="text-xl font-semibold">Productos aplicados</h2><Select value={producto || "todos"} onValueChange={(v) => setProducto(v === "todos" ? "" : v)}><SelectTrigger className="w-full sm:w-80" aria-label="Producto aplicado"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos los productos</SelectItem>{nombres.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent></Select><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted text-left"><tr><th className="p-3">Producto</th><th className="p-3 text-right">Consumo neto</th><th className="p-3 text-right">Por ha seleccionada</th></tr></thead><tbody>{[...productosGrupo].map(([key, p]) => <tr key={key} className="border-b border-border"><td className="p-3">{p.nombre}</td><td className="p-3 text-right font-mono">{area(p.cantidad)} {p.unidad}</td><td className="p-3 text-right font-mono">{area(total.ha > 0 ? p.cantidad / total.ha : 0)} {p.unidad}/ha</td></tr>)}{!productosGrupo.size && <tr><td colSpan={3} className="p-4 text-muted-foreground">Sin aplicaciones registradas.</td></tr>}</tbody></table></div></section>
    <section className="space-y-4 border-t border-border pt-5"><h2 className="text-xl font-semibold">Detalle por plantación</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted text-left"><tr>{["Rancho · tabla · lote", "Ha", "Kg cosechados", "Kg pagables/ha", "Gasto", "Gasto/ha", "Nómina", "Nómina/ha"].map((h) => <th key={h} className="whitespace-nowrap p-3">{h}</th>)}</tr></thead><tbody>{filas.map((f) => <tr key={f.id} className="border-b border-border"><td className="min-w-60 p-3">{f.nombre}{f.pendiente && <span className="block text-xs text-muted-foreground">Datos pendientes de completar</span>}</td>{[area(f.ha), entero(f.kgBrutos), entero(f.ha ? f.kgPagables / f.ha : 0), dinero(f.costo), dinero(f.ha ? f.costo / f.ha : 0), dinero(f.nomina), dinero(f.ha ? f.nomina / f.ha : 0)].map((v, i) => <td key={i} className="whitespace-nowrap p-3 text-right font-mono">{v}</td>)}</tr>)}{!filas.length && <tr><td colSpan={8} className="p-4 text-muted-foreground">No hay plantaciones con estos filtros.</td></tr>}</tbody></table></div></section>
  </div>;
}