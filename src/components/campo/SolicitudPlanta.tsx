import { FileDown } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { FotoInput } from "@/components/campo/Evidencia";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  fechaCorta,
  fechaEnSemana,
  folioSolicitud,
  formatoNum,
  lotesParaSolicitud,
  plantasSugeridas,
  totalesSolicitud,
  validarRecepcionPlanta,
} from "@/lib/campo/calc";
import { descargarSolicitud } from "@/lib/campo/pdf-solicitud";
import { useCampo } from "@/lib/campo/store";
import type { Lote, SolicitudPlanta } from "@/lib/campo/types";

/** Genera la solicitud de planta de un lote o consolidada (lotes del mismo vivero y semana). */
export function GenerarSolicitudDialog({
  open,
  lote,
  onClose,
}: {
  open: boolean;
  /** Si viene, la solicitud arranca solo con ese lote. */
  lote?: Lote | null;
  onClose: () => void;
}) {
  const { lotes, solicitudes, viveros, tablas, ranchos, variedades, parametro, generarSolicitud } = useCampo();
  const disponibles = useMemo(() => lotesParaSolicitud(lotes, solicitudes), [lotes, solicitudes]);
  const semanas = [...new Set(disponibles.map((l) => l.semanaPlaneada))].sort((a, b) => a - b);
  const [semanaTxt, setSemana] = useState(String(lote?.semanaPlaneada ?? semanas[0] ?? ""));
  const semana = Number(semanaTxt);
  const deSemana = disponibles.filter((l) => l.semanaPlaneada === semana);
  const [viveroElegido, setVivero] = useState(
    lote?.viveroId ?? deSemana.find((l) => l.viveroId)?.viveroId ?? viveros[0]?.id ?? "",
  );
  const viveroId = viveros.some((v) => v.id === viveroElegido) ? viveroElegido : (viveros[0]?.id ?? "");
  const candidatos = deSemana.filter((l) => !l.viveroId || l.viveroId === viveroId);
  const [elegidos, setElegidos] = useState<string[] | null>(lote ? [lote.id] : null);
  const seleccion = candidatos.filter((l) => (elegidos ?? candidatos.map((c) => c.id)).includes(l.id));
  const [observaciones, setObs] = useState("");
  const plantasPorHa = parametro("plantasPorHa");
  const plantasDe = (l: Lote) => l.plantas ?? plantasSugeridas(l.ha, plantasPorHa);
  const nombreTabla = (id: string) => tablas.find((t) => t.id === id)?.nombre ?? "";
  const nombreRancho = (id: string) => ranchos.find((r) => r.id === id)?.nombre ?? "";
  const nombreVariedad = (id: string) => variedades.find((v) => v.id === id)?.nombre ?? "";

  const toggle = (id: string, on: boolean) =>
    setElegidos((prev) => {
      const base = prev ?? candidatos.map((c) => c.id);
      return on ? [...new Set([...base, id])] : base.filter((x) => x !== id);
    });

  const generar = async () => {
    const r = generarSolicitud({ loteIds: seleccion.map((l) => l.id), viveroId, observaciones });
    if ("error" in r) return void toast.error(r.error);
    toast.success(`Solicitud ${folioSolicitud(r.solicitud.folio)} generada`);
    onClose();
    try {
      await descargarSolicitud(r.solicitud);
    } catch {
      toast.error("No se pudo crear el PDF. Descárgalo desde Solicitudes de planta.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Generar solicitud de planta</DialogTitle>
          <DialogDescription>
            Por lote o consolidada: todos los lotes del mismo vivero y semana de plantación. Los lotes
            arrastrados no piden planta nueva.
          </DialogDescription>
        </DialogHeader>

        {viveros.length === 0 ? (
          <p className="rounded-lg bg-soil-soft p-4 text-sm text-soil-foreground">
            Aún no hay viveros. El administrador los agrega en Catálogos.
          </p>
        ) : disponibles.length === 0 ? (
          <p className="rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
            No hay lotes planeados sin solicitud de planta.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Semana de plantación</Label>
                <Select
                  value={semanaTxt}
                  onValueChange={(v) => {
                    setSemana(v);
                    setElegidos(null);
                  }}
                >
                  <SelectTrigger aria-label="Semana de plantación">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {semanas.map((w) => (
                      <SelectItem key={w} value={String(w)}>
                        Semana {w} · {fechaCorta(fechaEnSemana(w))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vivero</Label>
                <Select
                  value={viveroId}
                  onValueChange={(v) => {
                    setVivero(v);
                    setElegidos(null);
                  }}
                >
                  <SelectTrigger aria-label="Vivero">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {viveros.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Lotes</Label>
              {candidatos.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay lotes de este vivero en esa semana.</p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {candidatos.map((l) => (
                    <li key={l.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm">
                        <Checkbox
                          checked={seleccion.some((x) => x.id === l.id)}
                          onCheckedChange={(c) => toggle(l.id, c === true)}
                          aria-label={`Lote ${l.codigo}`}
                        />
                        <span className="flex-1">
                          <span className="font-medium">
                            {nombreRancho(l.ranchoId)} · {nombreTabla(l.tablaId)} · lote {l.codigo}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {nombreVariedad(l.variedadId)} · entrega{" "}
                            {fechaCorta(l.fechaEntregaPlanta ?? fechaEnSemana(l.semanaPlaneada))}
                          </span>
                        </span>
                        <span className="num text-right text-xs">
                          {formatoNum(l.ha)} ha
                          <span className="block text-muted-foreground">{formatoNum(plantasDe(l))} plantas</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {seleccion.length > 0 && (
                <p className="num text-right text-sm">
                  Total: {formatoNum(seleccion.reduce((s, l) => s + l.ha, 0))} ha ·{" "}
                  {formatoNum(seleccion.reduce((s, l) => s + plantasDe(l), 0))} plantas
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sp-obs">Observaciones</Label>
              <Textarea id="sp-obs" value={observaciones} onChange={(e) => setObs(e.target.value)} rows={2} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={generar} disabled={seleccion.length === 0 || !viveroId}>
            <FileDown /> Generar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Captura la planta que llegó: cantidad real por lote, fecha y foto de la remisión. */
export function RecibirPlantaDialog({ solicitud, onClose }: { solicitud: SolicitudPlanta | null; onClose: () => void }) {
  const { hoy, recibirPlanta } = useCampo();
  const [fecha, setFecha] = useState(hoy);
  const [cant, setCant] = useState<Record<string, string>>(() =>
    Object.fromEntries((solicitud?.lineas ?? []).map((l) => [l.loteId, String(l.plantas)])),
  );
  const [foto, setFoto] = useState<string | undefined>();
  if (!solicitud) return null;

  const recibidas = Object.fromEntries(
    solicitud.lineas.map((l) => [l.loteId, cant[l.loteId] === "" ? NaN : Number(cant[l.loteId] ?? l.plantas)]),
  );
  const error = validarRecepcionPlanta(recibidas, solicitud.lineas, fecha, hoy, foto);
  const tot = totalesSolicitud(solicitud);
  const totalRecibido = solicitud.lineas.reduce((s, l) => s + (Number.isFinite(recibidas[l.loteId]) ? recibidas[l.loteId]! : 0), 0);
  const dif = totalRecibido - tot.plantas;

  const guardar = () => {
    const err = recibirPlanta(solicitud.id, { recibidas, fecha, foto });
    if (err) return void toast.error(err);
    toast.success(`Planta de ${folioSolicitud(solicitud.folio)} recibida`);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Planta recibida · {folioSolicitud(solicitud.folio)}
          </DialogTitle>
          <DialogDescription>
            Captura lo que realmente llegó. El cargo a la cuenta de planta se hace con estas plantas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rp-fecha-planta">Fecha de recepción</Label>
            <Input
              id="rp-fecha-planta"
              type="date"
              max={hoy}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="num"
            />
          </div>
          <ul className="space-y-3">
            {solicitud.lineas.map((l) => {
              const n = recibidas[l.loteId]!;
              const d = Number.isFinite(n) ? n - l.plantas : 0;
              return (
                <li key={l.loteId} className="grid grid-cols-[1fr_9rem] items-end gap-3">
                  <Label htmlFor={`rp-${l.loteId}`} className="flex-col items-start gap-0.5">
                    <span>
                      {l.tabla} · lote {l.lote}
                    </span>
                    <span className="num text-xs font-normal text-muted-foreground">
                      Solicitadas {formatoNum(l.plantas)}
                      {d !== 0 && (
                        <span className={d < 0 ? "text-destructive" : "text-primary"}>
                          {" "}
                          · {d > 0 ? "+" : ""}
                          {formatoNum(d)}
                        </span>
                      )}
                    </span>
                  </Label>
                  <Input
                    id={`rp-${l.loteId}`}
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    value={cant[l.loteId] ?? String(l.plantas)}
                    onChange={(e) => setCant((c) => ({ ...c, [l.loteId]: e.target.value }))}
                    className="num"
                  />
                </li>
              );
            })}
          </ul>
          <p className="num rounded-lg bg-secondary p-3 text-sm">
            Recibidas {formatoNum(totalRecibido)} de {formatoNum(tot.plantas)} solicitadas
            {dif !== 0 && (
              <span className={dif < 0 ? "font-medium text-destructive" : "font-medium text-primary"}>
                {" "}
                · diferencia {dif > 0 ? "+" : ""}
                {formatoNum(dif)}
              </span>
            )}
          </p>
          <div className="space-y-2">
            <Label>Foto de la remisión</Label>
            <FotoInput foto={foto} setFoto={setFoto} texto="Tomar o subir foto de la remisión" alt="Remisión" />
          </div>
          {error && foto && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!!error}>
            Guardar recepción
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
