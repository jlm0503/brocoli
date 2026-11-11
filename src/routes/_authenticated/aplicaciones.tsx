import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Plus, Undo2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/campo/AppShell";
import { FotoInput } from "@/components/campo/Evidencia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { formatoNum, saldoAplicacion } from "@/lib/campo/calc";
import { useCampo } from "@/lib/campo/store";
import { useFase3 } from "@/lib/campo/fase3";
import { useFiltro } from "@/lib/campo/filtro";

export const Route = createFileRoute("/_authenticated/aplicaciones")({
  head: () => ({ meta: [
    { title: "Aplicaciones en rancho · Ultra Farms" },
    { name: "description", content: "Dosis por tabla, productos recibidos, avance de aplicaciones y devolución de sobrantes." },
    { property: "og:title", content: "Aplicaciones en rancho · Ultra Farms" },
    { property: "og:description", content: "Seguimiento semanal de aplicaciones y sobrantes por rancho y tabla." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Aplicaciones,
});

function Aplicaciones() {
  return <AppShell path="/aplicaciones" title="Aplicaciones en rancho" eyebrow="Campo · avance semanal" filtros><Contenido /></AppShell>;
}

function Contenido() {
  const { semanaActual, hoy, productos, lotes, tablas, ranchos } = useCampo();
  const { fuentes, aplicaciones, continuaciones, devoluciones, aplicacionesListas, registrarAplicacion, continuarAplicacion, devolverSobrante } = useFase3();
  const { pasaLote } = useFiltro();
  const [semana, setSemana] = useState<string | null>(null);
  const [vista, setVista] = useState("semana");
  const [agrupar, setAgrupar] = useState("tabla");
  const [tablaId, setTablaId] = useState("todas");
  const [buscar, setBuscar] = useState("");
  const [dialogo, setDialogo] = useState<{ key: string; tipo: "avance" | "devolver" } | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [ha, setHa] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [foto, setFoto] = useState<string | undefined>();
  const [historial, setHistorial] = useState<string | null>(null);
  const elegida = Number(semana ?? semanaActual);
  const candidatas = fuentes.filter(f => { const l = lotes.find(x => x.id === f.loteId); return l && !l.cancelado && !l.cerrado && pasaLote(l); });
  const semanas = [...new Set([semanaActual, ...candidatas.map(f => f.semana)])].sort((a,b) => b-a);
  const opciones = tablas.filter(t => candidatas.some(f => f.tablaId === t.id));
  const filas = candidatas.map(f => ({ f, s: saldoAplicacion(f, aplicaciones, devoluciones, continuaciones, semanaActual) })).filter(({f,s}) =>
    (vista === "sobrantes" ? f.semana < semanaActual && s.saldo > 0 : f.semana === elegida) &&
    (tablaId === "todas" || f.tablaId === tablaId) && (productos.find(p => p.id === f.productoId)?.nombre ?? f.productoId).toLocaleLowerCase("es-MX").includes(buscar.toLocaleLowerCase("es-MX"))
  ).sort((a,b) => a.f.ranchoId.localeCompare(b.f.ranchoId) || a.f.tablaId.localeCompare(b.f.tablaId) || a.f.productoId.localeCompare(b.f.productoId));
  const grupos = [...filas.reduce((map, fila) => {
    const id = agrupar === "tabla" ? fila.f.tablaId : fila.f.productoId;
    const grupo = map.get(id) ?? [];
    grupo.push(fila);
    map.set(id, grupo);
    return map;
  }, new Map<string, typeof filas>())].map(([id, items]) => {
    const primera = items[0];
    const titulo = agrupar === "producto" ? (productos.find(p => p.id === id)?.nombre ?? id) : `${ranchos.find(r => r.id === primera?.f.ranchoId)?.nombre ?? ""} · Tabla ${tablas.find(t => t.id === id)?.nombre ?? id}`;
    const superficie = items.reduce((s, {f}) => s + f.ha, 0);
    const avance = superficie > 0 ? Math.min(100, items.reduce((s, {f, s: saldo}) => s + Math.min(f.ha, saldo.haAplicadas), 0) / superficie * 100) : 0;
    return { id, titulo, items, avance, total: items.reduce((s, {f}) => s + f.esperado, 0), unidad: productos.find(p => p.id === id)?.unidad };
  }).sort((a,b) => a.titulo.localeCompare(b.titulo, "es-MX", {numeric:true}));
  const abrir = (key: string, tipo: "avance" | "devolver") => { setDialogo({key,tipo}); setCantidad(""); setHa(""); setFecha(hoy); setFoto(undefined); };
  const seleccionada = fuentes.find(f => f.key === dialogo?.key);
  const saldo = seleccionada ? saldoAplicacion(seleccionada, aplicaciones, devoluciones, continuaciones, semanaActual) : null;
  const pSel = productos.find(p => p.id === seleccionada?.productoId);
  const guardar = () => {
    if (!dialogo) return;
    const error = dialogo.tipo === "avance" ? registrarAplicacion(dialogo.key, { cantidad: Number(cantidad), ha: Number(ha), fecha }) : devolverSobrante(dialogo.key, Number(cantidad), foto ?? "");
    if (error) return void toast.error(error);
    toast.success(dialogo.tipo === "avance" ? "Avance registrado." : "Devolución registrada."); setDialogo(null);
  };
  if (!aplicacionesListas) return <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Cargando aplicaciones…</p>;
  return <div className="space-y-5">
    <Tabs value={vista} onValueChange={setVista}><TabsList><TabsTrigger value="semana">Aplicaciones</TabsTrigger><TabsTrigger value="sobrantes">Sobrantes al cierre</TabsTrigger></TabsList></Tabs>
    <div className="flex flex-wrap items-center gap-3"><Label>Agrupar por</Label><Tabs value={agrupar} onValueChange={setAgrupar}><TabsList aria-label="Agrupar aplicaciones"><TabsTrigger value="tabla">Por tabla</TabsTrigger><TabsTrigger value="producto">Por producto</TabsTrigger></TabsList></Tabs></div>
    <div className="grid gap-3 sm:grid-cols-3">
      {vista === "semana" && <div className="space-y-1"><Label>Semana de aplicación</Label><Select value={String(elegida)} onValueChange={setSemana}><SelectTrigger aria-label="Semana de aplicación"><SelectValue /></SelectTrigger><SelectContent>{semanas.map(w => <SelectItem key={w} value={String(w)}>Semana {w}{w === semanaActual ? " · actual" : ""}</SelectItem>)}</SelectContent></Select></div>}
      <div className="space-y-1"><Label>Tabla</Label><Select value={tablaId} onValueChange={setTablaId}><SelectTrigger aria-label="Tabla"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas las tablas</SelectItem>{opciones.map(t => <SelectItem value={t.id} key={t.id}>{ranchos.find(r => r.id === t.ranchoId)?.nombre} · {t.nombre}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1"><Label htmlFor="buscar-aplicaciones">Producto</Label><Input id="buscar-aplicaciones" placeholder="Buscar producto" value={buscar} onChange={e => setBuscar(e.target.value)} /></div>
    </div>
    <div className="flex flex-wrap gap-x-6 gap-y-2 border-y border-border py-3 text-sm"><span><strong>{filas.length}</strong> aplicaciones</span><span><strong>{filas.filter(x => x.s.aplicado > 0).length}</strong> con avance</span><span className="text-destructive"><strong>{filas.filter(x => x.s.pendienteDevolver).length}</strong> sobrantes por resolver</span></div>
    {!filas.length && <p className="py-6 text-muted-foreground">No hay aplicaciones con esta selección.</p>}
    <div className="space-y-7">{grupos.map(grupo => <section key={grupo.id} aria-label={grupo.titulo} className="space-y-3">
      <header className="sticky top-0 z-10 border-b border-border bg-background py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-xl font-semibold break-words">{grupo.titulo}</h2><span className="text-sm font-mono">{formatoNum(grupo.avance)}% aplicado</span></div>
        <Progress value={grupo.avance} aria-label={`Avance de ${grupo.titulo}`} className="mt-2 h-2" />
        <p className="mt-2 text-xs text-muted-foreground">{grupo.items.length} aplicaciones{agrupar === "producto" ? ` · Total programado: ${formatoNum(grupo.total)} ${grupo.unidad ?? ""}` : " · Avance de las aplicaciones seleccionadas"}</p>
      </header>
      {grupo.items.map(({f,s}) => {
      const p = productos.find(p => p.id === f.productoId);
      const l = lotes.find(l => l.id === f.loteId);
      const estado = s.pendienteDevolver ? "Pendiente de devolver" : s.saldo === 0 && s.aplicado > 0 ? "Aplicado" : s.aplicado > 0 ? "Aplicado parcialmente" : f.recibido > 0 ? "Por aplicar" : "Sin recibir";
      return <article key={f.key} className="rounded-lg border border-border bg-card p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words font-semibold">{agrupar === "producto" ? `${ranchos.find(r => r.id === f.ranchoId)?.nombre} · Tabla ${tablas.find(t => t.id === f.tablaId)?.nombre} · ${l?.codigo}` : (p?.nombre ?? f.productoId)}</h3><p className="text-sm text-muted-foreground">{agrupar === "tabla" ? `Lote ${l?.codigo} · ` : ""}{f.tipo} · Sem {f.semana}</p></div><span className={`text-xs font-medium ${s.pendienteDevolver ? "text-destructive" : "text-primary"}`}>{estado}</span></div>
        <dl className="my-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4 lg:grid-cols-6">{[
          ["Dosis", `${formatoNum(s.dosis)} ${p?.unidad}/ha`], ["Programado", `${formatoNum(f.esperado)} ${p?.unidad}`], ["Recibido", `${formatoNum(f.recibido)} ${p?.unidad}`], ["Aplicado", `${formatoNum(s.aplicado)} ${p?.unidad}`], ["Disponible", `${formatoNum(s.saldo)} ${p?.unidad}`], ["Avance", `${formatoNum(s.haAplicadas)} / ${formatoNum(f.ha)} ha`],
        ].map(([label,value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-mono text-sm">{value}</dd></div>)}</dl>
        <Progress value={f.ha > 0 ? Math.min(100, s.haAplicadas / f.ha * 100) : 0} aria-label={`Avance de ${p?.nombre ?? f.productoId} en ${l?.codigo}`} className="mb-3 h-2" />
        {s.devuelto > 0 && <p className="mb-2 text-xs text-muted-foreground">Devuelto: {formatoNum(s.devuelto)} {p?.unidad}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!s.puedeAplicar || s.saldo <= 0 || s.haAplicadas >= f.ha} onClick={() => abrir(f.key,"avance")}><Plus />Registrar avance</Button>
          {f.semana < semanaActual && s.saldo > 0 && <><Button size="sm" variant="outline" onClick={() => abrir(f.key,"devolver")}><Undo2 />Devolver</Button>{s.pendienteDevolver && <Button size="sm" variant="outline" onClick={() => { const error = continuarAplicacion(f.key); if(error) toast.error(error); else toast.success("Disponible para continuar esta semana."); }}><ArrowRight />Continuar aplicando</Button>}</>}
          {!!s.avances.length && <Button size="sm" variant="ghost" onClick={() => setHistorial(historial === f.key ? null : f.key)}>Ver avances</Button>}
        </div>
        {historial === f.key && <ul className="mt-3 space-y-1 border-t border-border pt-2 text-xs">{s.avances.map(a => <li key={a.id}>{a.fecha} · {a.por} · {formatoNum(a.ha)} ha · {formatoNum(a.cantidad)} {a.unidad}</li>)}</ul>}
      </article>;
    })}</section>)}</div>
    <Dialog open={!!dialogo} onOpenChange={open => { if(!open) setDialogo(null); }}><DialogContent><DialogHeader><DialogTitle>{dialogo?.tipo === "avance" ? "Registrar avance" : "Devolver sobrante"} · {pSel?.nombre}</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">Disponible: {formatoNum(saldo?.saldo ?? 0)} {pSel?.unidad} · Dosis: {formatoNum(saldo?.dosis ?? 0)} {pSel?.unidad}/ha</p>
      {dialogo?.tipo === "avance" && <><div className="space-y-1"><Label htmlFor="ap-fecha">Fecha de aplicación</Label><Input id="ap-fecha" type="date" max={hoy} value={fecha} onChange={e => setFecha(e.target.value)} /></div><div className="space-y-1"><Label htmlFor="ap-ha">Hectáreas aplicadas en este avance</Label><Input id="ap-ha" type="number" min="0" step="any" value={ha} onChange={e => { setHa(e.target.value); setCantidad(String(Number(e.target.value) * (saldo?.dosis ?? 0))); }} /></div></>}
      <div className="space-y-1"><Label htmlFor="ap-cantidad">Cantidad {dialogo?.tipo === "avance" ? "aplicada" : "devuelta"} ({pSel?.unidad})</Label><Input id="ap-cantidad" type="number" min="0" step="any" max={saldo?.saldo} value={cantidad} onChange={e => setCantidad(e.target.value)} /></div>
      {dialogo?.tipo === "devolver" && <FotoInput foto={foto} setFoto={setFoto} texto="Foto de lo devuelto" />}
      <Button onClick={guardar}>Guardar {dialogo?.tipo === "avance" ? "avance" : "devolución"}</Button>
    </DialogContent></Dialog>
  </div>;
}