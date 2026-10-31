import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fechaCorta, formatoNum, semanaDeFecha, sumarDias } from "@/lib/campo/calc";
import { useCampo } from "@/lib/campo/store";
import type { Lote } from "@/lib/campo/types";

/** Ventana del administrador para corregir fechas de plantación y cosecha de un lote ya plantado. */
export function CorregirFechasDialog({ lote, onClose }: { lote: Lote | null; onClose: () => void }) {
  const { corregirFechas, hoy } = useCampo();
  const [fechas, setFechas] = useState<Record<string, string>>({});
  const [cosecha, setCosecha] = useState("");

  useEffect(() => {
    if (!lote) return;
    setFechas(Object.fromEntries(lote.avances.map((a) => [a.id, a.fecha])));
    setCosecha(lote.fechaCosecha ?? "");
  }, [lote]);

  const primera = Object.values(fechas).filter(Boolean).sort()[0];
  const calculada = lote && primera ? sumarDias(primera, lote.cicloDias) : null;

  const guardar = () => {
    if (!lote) return;
    const err = corregirFechas(lote.id, { avances: fechas, fechaCosecha: cosecha });
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(`Fechas del lote ${lote.codigo} corregidas`);
    onClose();
  };

  return (
    <Dialog open={!!lote} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Corregir fechas · lote {lote?.codigo}</DialogTitle>
          <DialogDescription>
            Solo el administrador puede hacerlo. La semana de receta y las compras del lote se recorren con la
            nueva fecha.
          </DialogDescription>
        </DialogHeader>

        {lote && (
          <div className="space-y-5">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Plantación</h4>
              {lote.avances.map((a, i) => (
                <div key={a.id} className="grid grid-cols-[1fr_auto] items-end gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`f-${a.id}`}>
                      {lote.avances.length > 1 ? `Registro ${i + 1} · ` : ""}
                      <span className="num">{formatoNum(a.ha)} ha</span>
                    </Label>
                    <Input
                      id={`f-${a.id}`}
                      type="date"
                      max={hoy}
                      value={fechas[a.id] ?? ""}
                      onChange={(e) => setFechas((f) => ({ ...f, [a.id]: e.target.value }))}
                      className="num"
                    />
                  </div>
                  <span className="num pb-2 text-xs text-muted-foreground">
                    {fechas[a.id] ? `sem ${semanaDeFecha(fechas[a.id]!)}` : ""}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <h4 className="text-sm font-semibold">Cosecha</h4>
              <Label htmlFor="f-cosecha" className="sr-only">
                Fecha de cosecha
              </Label>
              <div className="flex gap-2">
                <Input
                  id="f-cosecha"
                  type="date"
                  value={cosecha}
                  onChange={(e) => setCosecha(e.target.value)}
                  className="num"
                />
                {cosecha && (
                  <Button type="button" variant="outline" onClick={() => setCosecha("")}>
                    Usar ciclo
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {cosecha
                  ? "Fecha capturada a mano."
                  : calculada
                    ? `Vacía: se calcula con el ciclo de ${lote.cicloDias} días → ${fechaCorta(calculada)}.`
                    : "Vacía: se calcula con el ciclo de la variedad."}
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar}>Guardar fechas</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
