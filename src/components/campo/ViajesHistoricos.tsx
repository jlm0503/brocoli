import { useState } from "react";
import { ImageIcon, RotateCcw } from "lucide-react";
import { Stat } from "@/components/campo/AppShell";
import { PanelMulti } from "@/components/campo/PanelFiltros";
import { VerEvidencia } from "@/components/campo/Evidencia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CICLOS_PLANTACION, viajesConsulta, filtrarViajesConsulta, totalesConsultaViajes, fechaCorta, formatoNum, formatoMXN } from "@/lib/campo/calc";
import { useCosecha } from "@/lib/campo/cosecha";
import { useCampo } from "@/lib/campo/store";
import { useFiltro } from "@/lib/campo/filtro";
import { useSesion } from "@/lib/campo/sesion";

export function ViajesHistoricos() {
  const { viajes, ciclos } = useCosecha();
  const { lotes, tablas, choferes } = useCampo();
  const { ranchos, pasaRancho, pasaCultivo } = useFiltro();
  const { roles } = useSesion();
  const conImportes = roles.includes("admin");
  const [ciclo, setCiclo] = useState("todos");
  const [ranchoId, setRancho] = useState("");
  const [tablaIds, setTablas] = useState<string[]>([]);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [buscar, setBuscar] = useState("");
  const [orden, setOrden] = useState("recientes");
  const nombreRancho = (id: string) => ranchos.find((r) => r.id === id)?.nombre ?? id;
  const nombreTabla = (id: string) => tablas.find((t) => t.id === id)?.nombre ?? id;
  const todas = viajesConsulta(viajes, lotes, ciclos, choferes);
  const base = filtrarViajesConsulta(todas, { ciclo, ranchoId, tablaIds: [], desde: "", hasta: "" }, (r) => pasaRancho(r.ranchoId) && pasaCultivo(r.cultivo));
  const ids = new Set(base.flatMap((v) => v.reparto.map((r) => r.tablaId)));
  const opciones = tablas.filter((t) => ids.has(t.id)).map((t) => ({ id: t.id, nombre: `${nombreRancho(t.ranchoId)} · ${t.nombre}` })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true }));
  const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const lista = filtrarViajesConsulta(base, { ciclo: "todos", ranchoId: "", tablaIds, desde, hasta }).filter((v) => normalizar([v.folio, v.fecha, v.chofer, v.placas, ...v.reparto.map((r) => `${nombreRancho(r.ranchoId)} ${nombreTabla(r.tablaId)}`)].join(" ")).includes(normalizar(buscar.trim()))).sort((a, b) => orden === "antiguos" ? a.fecha.localeCompare(b.fecha) : orden === "folio" ? a.folio.localeCompare(b.folio, "es", { numeric: true }) : b.fecha.localeCompare(a.fecha));
  const total = totalesConsultaViajes(lista);
  const numero = (n: number | null) => n === null ? "—" : formatoNum(n);
  const dinero = (n: number | null) => n === null ? "—" : formatoMXN(n);
  return <section>
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="space-y-1"><Label>Ciclo de plantación</Label><Select value={ciclo} onValueChange={(v) => { setCiclo(v); setTablas([]); }}><SelectTrigger aria-label="Ciclo de plantación" className="w-72 max-w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos los ciclos</SelectItem>{CICLOS_PLANTACION.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1"><Label>Rancho</Label><Select value={ranchoId || "todos"} onValueChange={(v) => { setRancho(v === "todos" ? "" : v); setTablas([]); }}><SelectTrigger aria-label="Rancho de los viajes" className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos los ranchos</SelectItem>{ranchos.map((r) => <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>)}</SelectContent></Select></div>
      <PanelMulti nombre="Tablas" opciones={opciones} valor={tablaIds} cambiar={setTablas} buscable />
      <div className="space-y-1"><Label htmlFor="viajes-desde">Desde</Label><Input id="viajes-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="viajes-hasta">Hasta</Label><Input id="viajes-hasta" type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} /></div>
      <Button variant="ghost" size="icon" title="Restablecer filtros de viajes" aria-label="Restablecer filtros de viajes" onClick={() => { setCiclo("todos"); setRancho(""); setTablas([]); setDesde(""); setHasta(""); setBuscar(""); }}><RotateCcw /></Button>
    </div>
    <div className="mb-4 flex flex-wrap gap-3"><Input className="max-w-sm" aria-label="Buscar embarque histórico" placeholder="Buscar ticket, tabla, chofer o placas…" value={buscar} onChange={(e) => setBuscar(e.target.value)} /><Select value={orden} onValueChange={setOrden}><SelectTrigger className="w-48" aria-label="Orden de los viajes"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="recientes">Más recientes primero</SelectItem><SelectItem value="antiguos">Más antiguos primero</SelectItem><SelectItem value="folio">Por ticket</SelectItem></SelectContent></Select></div>
    {desde && hasta && desde > hasta && <p className="mb-3 text-sm text-destructive">La fecha final debe ser igual o posterior a la inicial.</p>}
    <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Totales de viajes históricos"><Stat compact label="Viajes de la selección" value={total.viajes} /><Stat compact label="Kg recibidos de la selección" value={numero(total.kgBrutos)} tone="primary" /><Stat compact label="Kg pagables de la selección" value={numero(total.kgPagables)} />{conImportes && <Stat compact label="Neto calculado de la selección" value={dinero(total.neto)} tone="soil" />}</div>
    <div className="overflow-x-auto" aria-label="Listado de viajes históricos"><table className="w-full text-sm"><thead className="bg-muted text-left"><tr>{["Fecha", "Ticket", "Rancho", "Tabla(s)", "Chofer / placas", "Bins del viaje", "Kg total del viaje", "Kg recibidos · selección", "Kg pagables · selección", "Merma", "Calificación", ...(conImportes ? ["Precio/kg", "Descuento · selección", "Neto · selección"] : []), "Estado", "Comprobantes"].map((h) => <th className="whitespace-nowrap px-3 py-2 font-medium" key={h}>{h}</th>)}</tr></thead>
      <tbody>{lista.map((v) => {
        const t = totalesConsultaViajes([v]);
        const precios = [...new Set(v.reparto.map((r) => r.precio))];
        const merma = t.kgBrutos && t.kgPagables !== null ? (1 - t.kgPagables / t.kgBrutos) * 100 : null;
        return <tr key={v.id} className="border-b border-border align-top"><td className="whitespace-nowrap px-3 py-2">{fechaCorta(v.fecha)}<span className="block text-xs text-muted-foreground">{v.hora}</span></td><td className="whitespace-nowrap px-3 py-2 font-semibold">{v.folio}</td><td className="px-3 py-2">{[...new Set(v.reparto.map((r) => nombreRancho(r.ranchoId)))].join(" + ")}</td><td className="min-w-40 px-3 py-2">{v.reparto.map((r, i) => <div key={`${r.loteId}-${i}`}>{nombreTabla(r.tablaId)}<span className="block text-xs text-muted-foreground">{numero(r.kgBrutos)} kg recibidos · {numero(r.kgPagables)} pagables</span></div>)}</td><td className="px-3 py-2">{v.chofer}<span className="block text-xs text-muted-foreground">{v.placas}</span></td><td className="num px-3 py-2">{numero(v.bins)}</td><td className="num whitespace-nowrap px-3 py-2">{numero(v.kgTotal)}</td><td className="num whitespace-nowrap px-3 py-2">{numero(t.kgBrutos)}</td><td className="num whitespace-nowrap px-3 py-2">{numero(t.kgPagables)}</td><td className="num px-3 py-2">{merma === null ? "—" : `${formatoNum(merma)}%`}</td><td className="num px-3 py-2">{numero(v.calidad)}</td>{conImportes && <><td className="num whitespace-nowrap px-3 py-2">{precios.map((p) => p === null ? "—" : p.toLocaleString("es-MX", { style: "currency", currency: "MXN" })).join(" / ")}</td><td className="num whitespace-nowrap px-3 py-2">{dinero(t.descuento)}</td><td className="num whitespace-nowrap px-3 py-2">{dinero(t.neto)}</td></>}<td className="whitespace-nowrap px-3 py-2">{v.historico ? "Histórico" : v.evaluado ? "Evaluado" : "En tránsito"}</td><td className="px-3 py-2"><div className="flex gap-1">{v.foto && <VerEvidencia foto={v.foto} title="Ver hoja de embarque"><ImageIcon className="size-4" /></VerEvidencia>}{v.reporte && <VerEvidencia foto={v.reporte} title="Ver evaluación"><ImageIcon className="size-4" /></VerEvidencia>}{!v.foto && !v.reporte && <span className="text-muted-foreground">—</span>}</div></td></tr>;
      })}{!lista.length && <tr><td colSpan={conImportes ? 16 : 13} className="p-6 text-center text-muted-foreground">No hay viajes con los filtros seleccionados.</td></tr>}</tbody>
    </table></div>
  </section>;
}