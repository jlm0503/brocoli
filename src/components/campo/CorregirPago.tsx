import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCosecha } from "@/lib/campo/cosecha";
import { formatoMXN } from "@/lib/campo/calc";
import type { PagoLiquidacion, Viaje } from "@/lib/campo/types";

export function CorregirPago({ pago, jueves, viajes, cerrar }: { pago: PagoLiquidacion; jueves: string; viajes: Viaje[]; cerrar: () => void }) {
  const { corregirPago } = useCosecha();
  const [fecha, setFecha] = useState(pago.fecha);
  const [monto, setMonto] = useState(String(pago.pagado));
  const [montos, setMontos] = useState(Object.fromEntries(pago.viajes.map((v) => [v.viajeId, String(v.monto)])));
  const [motivo, setMotivo] = useState("");
  const [anular, setAnular] = useState(false);
  const [guardando, setGuardando] = useState(false);
  async function guardar() {
    setGuardando(true);
    try {
      const error = await corregirPago(jueves, { pagoId: pago.id, fecha, pagado: Number(monto), viajes: pago.viajes.map((v) => ({ viajeId: v.viajeId, monto: Number(montos[v.viajeId]) })), motivo, anular });
      if (error) return void toast.error(error);
      toast.success(anular ? "Pago anulado. Saldo actualizado." : "Pago corregido. Saldo actualizado.");
      cerrar();
    } catch { toast.error("No se pudo guardar la corrección."); }
    finally { setGuardando(false); }
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !guardando) cerrar(); }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>{anular ? "Anular pago duplicado" : "Editar pago"}</DialogTitle><DialogDescription>Pago original: {formatoMXN(pago.pagado)} · {pago.fecha}</DialogDescription></DialogHeader>
      {!anular && <>
        <Label htmlFor="corregir-fecha">Fecha del pago</Label><Input id="corregir-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        {pago.viajes.length ? pago.viajes.map((v) => <div key={v.viajeId} className="space-y-2"><Label htmlFor={`corregir-${v.viajeId}`}>Monto · {viajes.find((x) => x.id === v.viajeId)?.folio ?? v.viajeId}</Label><Input id={`corregir-${v.viajeId}`} type="number" inputMode="decimal" min="0.01" step="0.01" value={montos[v.viajeId]} onChange={(e) => setMontos((xs) => ({ ...xs, [v.viajeId]: e.target.value }))} /></div>) : <><Label htmlFor="corregir-monto">Monto pagado</Label><Input id="corregir-monto" type="number" inputMode="decimal" min="0.01" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} /></>}
      </>}
      <Label htmlFor="corregir-motivo">Motivo de la corrección</Label><Input id="corregir-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={guardando} onClick={() => setAnular(!anular)}>{anular ? "Volver a editar" : "Anular pago"}</Button><Button variant={anular ? "destructive" : "default"} disabled={guardando || !motivo.trim()} onClick={() => void guardar()}>{guardando ? "Guardando…" : anular ? "Confirmar anulación" : "Guardar corrección"}</Button></div>
    </DialogContent>
  </Dialog>;
}