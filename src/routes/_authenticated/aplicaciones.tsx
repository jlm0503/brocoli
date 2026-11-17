import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, FileDown } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/campo/AppShell";
import { MultiSelectTablas } from "@/components/campo/MultiSelectTablas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { consumoAsumidoAplicaciones, formatoNum } from "@/lib/campo/calc";
import { useCampo } from "@/lib/campo/store";
import { useFase3 } from "@/lib/campo/fase3";
import { useFiltro } from "@/lib/campo/filtro";

export const Route = createFileRoute("/_authenticated/aplicaciones")({
  head: () => ({ meta: [
    { title: "Aplicaciones en rancho · Ultra Farms" },
    { name: "description", content: "Lista de lo que lleva cada tabla: dosis, recibido, devuelto y consumido, para imprimir en PDF." },
    { property: "og:title", content: "Aplicaciones en rancho · Ultra Farms" },
    { property: "og:description", content: "Lista por tabla de productos y dosis de la semana, imprimible en PDF." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Aplicaciones,
});

function Aplicaciones() {
  return <AppShell path="/aplicaciones" title="Aplicaciones en rancho" eyebrow="Campo · lista por tabla" filtros><Contenido /></AppShell>;
}

function Contenido() {
  const { semanaActual, productos, lotes, tablas, ranchos } = useCampo();
  const { fuentes, devoluciones, aplicacionesListas } = useFase3();
  const { pasaLote } = useFiltro();
  const [semana, setSemana] = useState<string | null>(null);
  const [agrupar, setAgrupar] = useState("tabla");
  const [tablasSel, setTablasSel] = useState<string[]>([]);
  const [buscar, setBuscar] = useState("");
  const [generando, setGenerando] = useState(false);
  const elegida = Number(semana ?? semanaActual);
  const candidatas = fuentes.filter(f => { const l = lotes.find(x => x.id === f.loteId); return l && !l.cancelado && !l.cerrado && pasaLote(l); });
  const semanas = [...new Set([semanaActual, ...candidatas.map(f => f.semana)])].sort((a, b) => b - a);
  const opciones = tablas.filter(t => candidatas.some(f => f.tablaId === t.id));
  const nombreP = (id: string) => productos.find(p => p.id === id)?.nombre ?? id;
  const unidad = (id: string) => productos.find(p => p.id === id)?.unidad ?? "";
  const nombreTabla = (tablaId: string, ranchoId: string) => `${ranchos.find(r => r.id === ranchoId)?.nombre ?? ""} · Tabla ${tablas.find(t => t.id === tablaId)?.nombre ?? tablaId}`;
  // El reparto proporcional se hace con todas las tablas de la semana, antes de filtrar la vista.
  const filas = consumoAsumidoAplicaciones(candidatas.filter(f => f.semana === elegida), devoluciones)
    .filter(({ fuente: f }) => (tablasSel.length === 0 || tablasSel.includes(f.tablaId)) && nombreP(f.productoId).toLocaleLowerCase("es-MX").includes(buscar.toLocaleLowerCase("es-MX")));
  const grupos = [...filas.reduce((m, x) => { const id = agrupar === "tabla" ? x.fuente.tablaId : x.fuente.productoId; m.set(id, [...(m.get(id) ?? []), x]); return m; }, new Map<string, typeof filas>())]
    .map(([id, items]) => ({ id, titulo: agrupar === "tabla" ? `${nombreTabla(id, items[0]!.fuente.ranchoId)} · ${formatoNum(Math.max(...items.map(i => i.fuente.ha)))} ha` : `${nombreP(id)} (${unidad(id)})`, items: items.sort((a, b) => agrupar === "tabla" ? nombreP(a.fuente.productoId).localeCompare(nombreP(b.fuente.productoId), "es-MX") : nombreTabla(a.fuente.tablaId, a.fuente.ranchoId).localeCompare(nombreTabla(b.fuente.tablaId, b.fuente.ranchoId), "es-MX", { numeric: true })) }))
    .sort((a, b) => a.titulo.localeCompare(b.titulo, "es-MX", { numeric: true }));
  const etiqueta = (x: (typeof filas)[number]) => agrupar === "tabla" ? nombreP(x.fuente.productoId) : nombreTabla(x.fuente.tablaId, x.fuente.ranchoId);
  const imprimir = async () => {
    setGenerando(true);
    try {
      const { pdfAplicaciones, entregarPdfAplicaciones } = await import("@/lib/campo/pdf-aplicaciones");
      const blob = await pdfAplicaciones(`Aplicaciones · Semana ${elegida}`, `Ultra Farms de México · lo no devuelto se considera consumido, repartido proporcional entre tablas`, grupos.map(g => ({ titulo: g.titulo, filas: g.items.map(x => { const u = unidad(x.fuente.productoId); return { producto: etiqueta(x), tipo: x.fuente.tipo, dosis: `${formatoNum(x.dosis)} ${u}`, ha: formatoNum(x.fuente.ha), programado: formatoNum(x.programado), recibido: formatoNum(x.recibido), devuelto: formatoNum(x.devuelto), consumido: `${formatoNum(x.consumido)} ${u}` }; }) })));
      await entregarPdfAplicaciones(blob, `aplicaciones-semana-${elegida}.pdf`);
    } catch { toast.error("No se pudo generar el PDF."); } finally { setGenerando(false); }
  };
  if (!aplicacionesListas) return <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Cargando aplicaciones…</p>;
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">Lista de lo que lleva cada tabla. Todo lo recibido que no se devuelve se considera aplicado, repartido entre las tablas en proporción a su dosis y hectáreas. Las devoluciones se registran en Devoluciones.</p>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Tabs value={agrupar} onValueChange={setAgrupar}><TabsList aria-label="Agrupar aplicaciones"><TabsTrigger value="tabla">Por tabla</TabsTrigger><TabsTrigger value="producto">Por producto</TabsTrigger></TabsList></Tabs>
      <Button onClick={imprimir} disabled={generando || !filas.length}>{generando ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}Imprimir PDF</Button>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1"><Label>Semana</Label><Select value={String(elegida)} onValueChange={setSemana}><SelectTrigger aria-label="Semana"><SelectValue /></SelectTrigger><SelectContent>{semanas.map(w => <SelectItem key={w} value={String(w)}>Semana {w}{w === semanaActual ? " · actual" : ""}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1"><Label>Tablas</Label><MultiSelectTablas ariaLabel="Tablas" opciones={opciones.map(t => ({ id: t.id, etiqueta: `${ranchos.find(r => r.id === t.ranchoId)?.nombre} · ${t.nombre}` }))} seleccion={tablasSel} onChange={setTablasSel} /></div>
      <div className="space-y-1"><Label htmlFor="buscar-aplicaciones">Producto</Label><Input id="buscar-aplicaciones" placeholder="Buscar producto" value={buscar} onChange={e => setBuscar(e.target.value)} /></div>
    </div>
    {!filas.length && <p className="py-6 text-muted-foreground">No hay aplicaciones con esta selección.</p>}
    <div className="space-y-4">{grupos.map(g => <section key={g.id} aria-label={g.titulo} className="overflow-x-auto">
      <h2 className="border-b border-border bg-secondary px-2 py-1.5 text-sm font-semibold tracking-normal">{g.titulo}</h2>
      <table className="w-full min-w-[560px] text-xs">
        <thead className="text-muted-foreground"><tr className="border-b border-border"><th className="px-2 py-1 text-left font-medium">{agrupar === "tabla" ? "Producto" : "Tabla"}</th><th className="px-2 py-1 text-right font-medium">Dosis/ha</th><th className="px-2 py-1 text-right font-medium">Ha</th><th className="px-2 py-1 text-right font-medium">Programado</th><th className="px-2 py-1 text-right font-medium">Recibido</th><th className="px-2 py-1 text-right font-medium">Devuelto</th><th className="px-2 py-1 text-right font-medium">Consumido</th></tr></thead>
        <tbody>{g.items.map(x => { const u = unidad(x.fuente.productoId); return <tr key={x.fuente.key} className="border-b border-border">
          <td className="px-2 py-1"><span className="font-medium">{etiqueta(x)}</span> <span className="text-muted-foreground">· {x.fuente.tipo}</span></td>
          <td className="px-2 py-1 text-right font-mono">{formatoNum(x.dosis)} {u}</td><td className="px-2 py-1 text-right font-mono">{formatoNum(x.fuente.ha)}</td><td className="px-2 py-1 text-right font-mono">{formatoNum(x.programado)}</td><td className="px-2 py-1 text-right font-mono">{formatoNum(x.recibido)}</td><td className="px-2 py-1 text-right font-mono">{formatoNum(x.devuelto)}</td><td className="px-2 py-1 text-right font-mono font-semibold">{formatoNum(x.consumido)} {u}</td>
        </tr>; })}</tbody>
      </table>
    </section>)}</div>
  </div>;
}
