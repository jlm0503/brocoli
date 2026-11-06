import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { completarImportado, formatoMXN, formatoNum, nombreConceptoGasto } from "@/lib/campo/calc";
import { useCosecha } from "@/lib/campo/cosecha";
import { useCampo } from "@/lib/campo/store";
import { useSesion } from "@/lib/campo/sesion";
import type { CicloCerrado, ConceptoGasto } from "@/lib/campo/types";

export function CompletarHistorico({ ciclo, cerrar }: { ciclo: CicloCerrado; cerrar: () => void }) {
  const { guardarCiclo } = useCosecha();
  const { hoy } = useCampo();
  const { nombre } = useSesion();
  const [d, setD] = useState({ kgBrutos: ciclo.kgBrutos, kgPagables: ciclo.kgPagables, ingreso: ciclo.ingreso, planta: ciclo.planta, fechaFinCosecha: ciclo.fechaFinCosecha, gastos: ciclo.importacion?.gastos ?? [] });
  const [error, setError] = useState("");
  const imp = ciclo.importacion;
  if (!imp) return null;
  const guardar = (fin: boolean) => {
    const r = completarImportado(ciclo, { ...d, cerrar: fin });
    if ("error" in r) return setError(r.error);
    guardarCiclo({ ...r.ciclo, bitacora: [...ciclo.bitacora, { fecha: hoy, por: nombre, accion: fin ? "cerrado" : "capturado", motivo: "Captura manual de cosecha y gastos históricos" }] });
    toast.success(fin ? "Histórico cerrado." : "Captura guardada.");
    cerrar();
  };
  const editable = imp.pendiente;
  return <Dialog open onOpenChange={(o) => !o && cerrar()}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
    <DialogHeader><DialogTitle>{editable ? "Completar histórico" : "Detalle del histórico"} · {ciclo.codigo}</DialogTitle></DialogHeader>
    <p className="text-sm text-muted-foreground">{imp.variedad} · {formatoNum(ciclo.ha)} ha · Plantación {ciclo.fechaPlantacion} · Inicio de cosecha {imp.fechaInicioCosecha}</p>
    <p className="text-xs text-muted-foreground">Folios: {imp.folios.join(" · ")}</p>
    <div className="grid gap-3 sm:grid-cols-2">
      {([ ["kgBrutos", "Kg recibidos"], ["kgPagables", "Kg pagables"], ["ingreso", "Ingreso real (MXN)"], ["planta", "Costo real de planta (MXN)"] ] as const).map(([k, label]) => <div key={k} className="space-y-1"><Label htmlFor={`hist-${k}`}>{label}</Label><Input id={`hist-${k}`} type="number" min={0} step="any" disabled={!editable} value={d[k] || ""} onChange={(e) => setD({ ...d, [k]: Number(e.target.value) })} /></div>)}
      <div className="space-y-1"><Label htmlFor="hist-fin">Fin de cosecha</Label><Input id="hist-fin" type="date" disabled={!editable} value={d.fechaFinCosecha} onChange={(e) => setD({ ...d, fechaFinCosecha: e.target.value })} /></div>
    </div>
    <h3 className="font-medium">Nómina y otros gastos</h3>
    {d.gastos.map((g, i) => <div key={i} className="flex flex-wrap gap-2">
      <Select disabled={!editable} value={g.concepto} onValueChange={(v) => setD({ ...d, gastos: d.gastos.map((x, j) => j === i ? { ...x, concepto: v as ConceptoGasto } : x) })}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent>{(["nomina", "diesel", "gasolina", "mano_obra_extra", "mantenimiento", "otros"] as const).map((c) => <SelectItem key={c} value={c}>{nombreConceptoGasto(c)}</SelectItem>)}</SelectContent></Select>
      <Input aria-label={`Fecha del gasto ${i + 1}`} disabled={!editable} className="w-40" type="date" value={g.fecha} onChange={(e) => setD({ ...d, gastos: d.gastos.map((x, j) => j === i ? { ...x, fecha: e.target.value } : x) })} />
      <Input aria-label={`Monto del gasto ${i + 1}`} disabled={!editable} className="w-40" type="number" min={0} step="any" value={g.monto || ""} onChange={(e) => setD({ ...d, gastos: d.gastos.map((x, j) => j === i ? { ...x, monto: Number(e.target.value) } : x) })} />
      {editable && <Button variant="ghost" onClick={() => setD({ ...d, gastos: d.gastos.filter((_, j) => j !== i) })}>Quitar</Button>}
    </div>)}
    {editable && <Button variant="outline" onClick={() => setD({ ...d, gastos: [...d.gastos, { concepto: "nomina", fecha: "", monto: 0 }] })}>Agregar gasto</Button>}
    <h3 className="font-medium">Consumos de origen · {formatoMXN(ciclo.insumos + ciclo.planta)}</h3>
    <div className="max-h-64 overflow-auto"><table className="w-full text-sm"><thead><tr className="text-left"><th className="p-2">Producto</th><th className="p-2">Cantidad</th><th className="p-2">Costo</th></tr></thead><tbody>{imp.productos.map((p, i) => <tr key={i} className="border-t"><td className="p-2">{p.nombre}{p.observacion && <div className="text-xs text-muted-foreground">{p.observacion}</div>}</td><td className="p-2 font-mono">{formatoNum(p.cantidad)} {p.unidad}</td><td className="p-2 font-mono">{formatoMXN(p.costo)}</td></tr>)}</tbody></table></div>
    {error && <p className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={cerrar}>Cerrar ventana</Button>{editable && <><Button variant="outline" onClick={() => guardar(false)}>Guardar avance</Button><Button onClick={() => guardar(true)}>Guardar y cerrar histórico</Button></>}</div>
  </DialogContent></Dialog>;
}