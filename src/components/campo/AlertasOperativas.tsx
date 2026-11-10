import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { fechaCorta, formatoNum, formatoMXN, plantacionesIncumplidas, cierresBajoMeta } from "@/lib/campo/calc";
import { useCampo } from "@/lib/campo/store";
import { useCosecha } from "@/lib/campo/cosecha";
import { useFase3 } from "@/lib/campo/fase3";
import { useFiltro } from "@/lib/campo/filtro";

function Informe({ titulo, columnas, filas }: { titulo: string; columnas: string[]; filas: { id: string; valores: string[] }[] }) {
  return <section className="mb-8 space-y-3"><h2 className="text-2xl font-semibold">{titulo} <span className="font-mono text-base text-muted-foreground">({filas.length})</span></h2>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted text-left"><tr>{columnas.map((c) => <th key={c} className="whitespace-nowrap p-3">{c}</th>)}</tr></thead><tbody>{filas.map((f) => <tr key={f.id} className="border-b border-border">{f.valores.map((v, i) => <td key={i} className="p-3">{v}</td>)}</tr>)}{!filas.length && <tr><td colSpan={columnas.length} className="p-3 text-muted-foreground">Sin registros con los filtros seleccionados.</td></tr>}</tbody></table></div>
  </section>;
}

export function AlertasOperativas() {
  const { lotes, semanaActual, ranchos, tablas, productos } = useCampo();
  const { ciclos } = useCosecha();
  const { extraordinarios, devoluciones } = useFase3();
  const { pasaLote, pasaRancho, pasaCultivo } = useFiltro();
  const rancho = (id: string) => ranchos.find((r) => r.id === id)?.nombre ?? "—";
  const tabla = (id: string) => tablas.find((t) => t.id === id)?.nombre ?? "—";
  const pasaTabla = (id: string) => lotes.some((l) => l.tablaId === id && pasaLote(l)) || ciclos.some((c) => c.tablaId === id && pasaRancho(c.ranchoId) && pasaCultivo(c.cultivo));
  const estados = { por_autorizar: "Por autorizar", autorizada: "Autorizado", rechazada: "Rechazado", surtida: "Surtido" };
  const extras = extraordinarios.filter((e) => pasaRancho(e.ranchoId) && e.tablaIds.some(pasaTabla)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const incumplidas = plantacionesIncumplidas(lotes, semanaActual).filter((x) => pasaLote(x.lote)).sort((a, b) => b.lote.semanaPlaneada - a.lote.semanaPlaneada);
  const devs = devoluciones.filter((d) => pasaRancho(d.ranchoId) && (d.loteId ? pasaLote(lotes.find((l) => l.id === d.loteId)) : pasaTabla(d.tablaId))).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const cierres = cierresBajoMeta(ciclos).filter((c) => pasaRancho(c.ranchoId) && pasaCultivo(c.cultivo)).sort((a, b) => b.fechaFinCosecha.localeCompare(a.fechaFinCosecha));
  return <>
    <div className="mb-5 flex flex-wrap gap-2"><Button variant="outline" asChild><Link to="/extraordinarios">Pedidos extraordinarios</Link></Button><Button variant="outline" asChild><Link to="/planeacion">Planeación y avance</Link></Button><Button variant="outline" asChild><Link to="/devoluciones">Devoluciones</Link></Button><Button variant="outline" asChild><Link to="/historicos">Cierres</Link></Button></div>
    <Informe titulo="Pedidos extraordinarios" columnas={["Fecha", "Folio", "Rancho · tablas", "Ingeniero", "Motivo", "Estatus"]} filas={extras.map((e) => ({ id: e.id, valores: [fechaCorta(e.fecha), e.folio, `${rancho(e.ranchoId)} · ${e.tablaIds.map(tabla).join(", ")}`, e.ingeniero, e.descripcion, estados[e.status]] }))} />
    <Informe titulo="Plantaciones incumplidas" columnas={["Semana planeada", "Rancho · tabla", "Lote", "Ingeniero", "Ha planeadas", "Ha registradas a tiempo", "Ha faltantes al cierre de semana"]} filas={incumplidas.map(({ lote: l, planeadas, registradas, faltantes }) => ({ id: l.id, valores: [`Sem ${l.semanaPlaneada}`, `${rancho(l.ranchoId)} · ${tabla(l.tablaId)}`, l.codigo, l.ingeniero || "Sin ingeniero registrado", formatoNum(planeadas), formatoNum(registradas), formatoNum(faltantes)] }))} />
    <Informe titulo="Devoluciones de productos" columnas={["Fecha", "Rancho · tabla", "Producto", "Cantidad", "Importe devuelto", "Registró"]} filas={devs.map((d) => { const p = productos.find((p) => p.id === d.productoId); return { id: d.id, valores: [fechaCorta(d.fecha), `${rancho(d.ranchoId)} · ${tabla(d.tablaId)}`, p?.nombre ?? d.productoId, `${formatoNum(d.cantidad)} ${p?.unidad ?? ""}`, formatoMXN(d.cantidad * d.precio), d.por] }; })} />
    <Informe titulo="Cierres de cosecha por debajo de la meta" columnas={["Fecha de cierre", "Rancho · tabla", "Lote", "Ingeniero", "Kg pagables/ha", "Meta kg/ha", "% de meta"]} filas={cierres.map((c) => ({ id: c.id, valores: [fechaCorta(c.fechaFinCosecha), `${rancho(c.ranchoId)} · ${tabla(c.tablaId)}`, c.codigo, c.ingeniero, formatoNum(c.kgPagables / c.ha), formatoNum(c.meta), `${formatoNum(c.kgPagables / c.ha / c.meta * 100)}%`] }))} />
  </>;
}