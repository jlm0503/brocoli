import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatoNum, plantadasLote, saldoAplicacion } from "@/lib/campo/calc";
import { MultiSelectTablas } from "@/components/campo/MultiSelectTablas";
import { useCampo } from "@/lib/campo/store";
import { useFase3 } from "@/lib/campo/fase3";
import { useFiltro } from "@/lib/campo/filtro";

export function AplicacionAdicional({ alGuardar }: { alGuardar: () => void }) {
  const { lotes, tablas, ranchos, productos, hoy, semanaActual } = useCampo();
  const { fuentes, aplicaciones, devoluciones, continuaciones, registrarAplicacion, registrarAplicacionManual } = useFase3();
  const { pasaLote } = useFiltro();
  const [open, setOpen] = useState(false);
  const [modo, setModo] = useState("pendiente");
  const [loteId, setLoteId] = useState("");
  const [loteIds, setLoteIds] = useState<string[]>([]);
  const [productoId, setProductoId] = useState("");
  const [key, setKey] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [ha, setHa] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [recibido, setRecibido] = useState("");
  const [dosis, setDosis] = useState("");
  const [motivo, setMotivo] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const opciones = lotes.filter(l => !l.cancelado && !l.cerrado && plantadasLote(l) > 0 && pasaLote(l));
  const pendientes = fuentes.filter(f => f.loteId === loteId && f.semana <= semanaActual && saldoAplicacion(f, aplicaciones, devoluciones, continuaciones, semanaActual).saldo > 0);
  const fuente = pendientes.find(f => f.key === key);
  const saldo = fuente ? saldoAplicacion(fuente, aplicaciones, devoluciones, continuaciones, semanaActual) : null;
  const producto = productos.find(p => p.id === (modo === "pendiente" ? fuente?.productoId : productoId));
  const dosisActual = modo === "pendiente" ? saldo?.dosis ?? 0 : Number(dosis);
  const guardar = () => {
    const d = { cantidad: Number(cantidad), ha: Number(ha), fecha };
    let error: string | null;
    if (modo === "pendiente") {
      if (!fuente || !saldo) return void toast.error("Selecciona la entrega pendiente.");
      error = registrarAplicacion(fuente.key, d, true);
      if (error) return void toast.error(error);
      toast.success("Aplicación registrada.");
    } else {
      if (!loteIds.length) return void toast.error("Selecciona al menos una tabla.");
      const fallos: string[] = [];
      for (const id of loteIds) {
        const e = registrarAplicacionManual({ ...d, loteId: id, productoId, recibido: Number(recibido), dosis: Number(dosis), motivo });
        if (e) fallos.push(`${tablas.find(t => t.id === lotes.find(l => l.id === id)?.tablaId)?.nombre ?? id}: ${e}`);
      }
      if (fallos.length) return void toast.error(fallos.join(" · "));
      toast.success(loteIds.length > 1 ? `Aplicación registrada en ${loteIds.length} tablas.` : "Aplicación registrada.");
    }
    setOpen(false); alGuardar();
  };
  return <>
    <Button size="sm" variant="outline" onClick={() => { setOpen(true); setLoteId(""); setLoteIds([]); setProductoId(""); setKey(""); setHa(""); setCantidad(""); setRecibido(""); setDosis(""); setMotivo(""); setFecha(hoy); setBusqueda(""); }}><Plus />Agregar aplicación</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Agregar aplicación</DialogTitle></DialogHeader>
      <Tabs value={modo} onValueChange={v => { setModo(v); setCantidad(""); setHa(""); }}><TabsList className="h-auto flex-wrap"><TabsTrigger value="pendiente">Usar recibido pendiente</TabsTrigger><TabsTrigger value="manual">Fuera de planeación</TabsTrigger></TabsList></Tabs>
      {modo === "pendiente" ? <div className="space-y-1"><Label>Tabla y lote</Label><Select value={loteId} onValueChange={v => { setLoteId(v); setKey(""); }}><SelectTrigger aria-label="Tabla y lote"><SelectValue placeholder="Selecciona la tabla" /></SelectTrigger><SelectContent>{opciones.map(l => <SelectItem key={l.id} value={l.id}>{ranchos.find(r => r.id === l.ranchoId)?.nombre} · {tablas.find(t => t.id === l.tablaId)?.nombre} · {l.codigo} · {formatoNum(plantadasLote(l))} ha</SelectItem>)}</SelectContent></Select></div> : <div className="space-y-1"><Label>Tablas y lotes</Label><MultiSelectTablas ariaLabel="Tablas y lotes" placeholder="Selecciona una o varias tablas" opciones={opciones.map(l => ({ id: l.id, etiqueta: `${ranchos.find(r => r.id === l.ranchoId)?.nombre} · ${tablas.find(t => t.id === l.tablaId)?.nombre} · ${l.codigo} · ${formatoNum(plantadasLote(l))} ha` }))} seleccion={loteIds} onChange={setLoteIds} />{loteIds.length > 1 && <p className="text-xs text-muted-foreground">Se registrará la misma dosis, hectáreas y cantidad en cada tabla elegida.</p>}</div>}
      {modo === "pendiente" ? <div className="space-y-1"><Label>Entrega disponible</Label><Select value={key} onValueChange={setKey}><SelectTrigger aria-label="Entrega disponible"><SelectValue placeholder="Selecciona el producto recibido" /></SelectTrigger><SelectContent>{pendientes.map(f => <SelectItem key={f.key} value={f.key}>{productos.find(p => p.id === f.productoId)?.nombre} · Sem {f.semana} · {formatoNum(saldoAplicacion(f, aplicaciones, devoluciones, continuaciones, semanaActual).saldo)} {productos.find(p => p.id === f.productoId)?.unidad}</SelectItem>)}</SelectContent></Select>{loteId && !pendientes.length && <p className="text-xs text-muted-foreground">Sin entregas pendientes para esta tabla.</p>}</div> : <>
        <div className="space-y-1"><Label htmlFor="ad-buscar">Buscar producto</Label><Input id="ad-buscar" value={busqueda} onChange={e => setBusqueda(e.target.value)} /><Select value={productoId} onValueChange={setProductoId}><SelectTrigger aria-label="Producto fuera de planeación"><SelectValue placeholder="Selecciona un producto del catálogo" /></SelectTrigger><SelectContent>{productos.filter(p => p.nombre.toLocaleLowerCase("es-MX").includes(busqueda.toLocaleLowerCase("es-MX"))).sort((a,b) => a.nombre.localeCompare(b.nombre)).map(p => <SelectItem key={p.id} value={p.id}>{p.nombre} · {p.unidad}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label htmlFor="ad-recibido">Cantidad disponible en esta tabla ({producto?.unidad})</Label><Input id="ad-recibido" type="number" min="0" step="any" value={recibido} onChange={e => setRecibido(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="ad-dosis">Dosis ({producto?.unidad}/ha)</Label><Input id="ad-dosis" type="number" min="0" step="any" value={dosis} onChange={e => { setDosis(e.target.value); setCantidad(String(Number(e.target.value) * Number(ha))); }} /></div>
        <div className="space-y-1"><Label htmlFor="ad-motivo">Motivo</Label><Input id="ad-motivo" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Llegó después de la semana planeada" /></div>
      </>}
      {saldo && <p className="text-xs text-muted-foreground">Disponible: {formatoNum(saldo.saldo)} {producto?.unidad} · Dosis: {formatoNum(saldo.dosis)} {producto?.unidad}/ha</p>}
      <div className="space-y-1"><Label htmlFor="ad-fecha">Fecha de aplicación</Label><Input id="ad-fecha" type="date" max={hoy} value={fecha} onChange={e => setFecha(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label htmlFor="ad-ha">Hectáreas aplicadas</Label><Input id="ad-ha" type="number" min="0" step="any" value={ha} onChange={e => { setHa(e.target.value); setCantidad(String(Number(e.target.value) * dosisActual)); }} /></div><div className="space-y-1"><Label htmlFor="ad-cantidad">Cantidad aplicada ({producto?.unidad})</Label><Input id="ad-cantidad" type="number" min="0" step="any" value={cantidad} onChange={e => setCantidad(e.target.value)} /></div></div>
      <Button onClick={guardar}>Guardar aplicación</Button>
    </DialogContent></Dialog>
  </>;
}