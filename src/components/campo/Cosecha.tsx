import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { FotoInput } from "@/components/campo/Evidencia";
import { PdfSalida } from "@/components/campo/PdfSalida";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  KG_POR_BIN,
  estimadoViaje,
  evaluarViaje,
  fechaCorta,
  formatoMXN,
  formatoNum,
  loteEnCosecha,
  lotesParaSalida,
  plantadasLote,
  repartirKg,
} from "@/lib/campo/calc";
import { useCosecha, type DatosSalida } from "@/lib/campo/cosecha";
import { useFiltro } from "@/lib/campo/filtro";
import { useSesion } from "@/lib/campo/sesion";
import { useCampo } from "@/lib/campo/store";
import type { Lote, ProblemaEvaluado, Viaje } from "@/lib/campo/types";

export function useNombreLote() {
  const { tablas, ranchos } = useCampo();
  return (l: Lote | undefined) => {
    if (!l) return "—";
    const t = tablas.find((x) => x.id === l.tablaId);
    const r = ranchos.find((x) => x.id === l.ranchoId);
    return `${r?.nombre ?? ""} · ${t?.nombre ?? "?"} · ${l.codigo}`;
  };
}

/* ───────────── 4.1 Salida del embarque ───────────── */

export function SalidaForm() {
  const { lotes, choferes, hoy, semanaActual } = useCampo();
  const { roles } = useSesion();
  const { registrarSalida } = useCosecha();
  const { pasaLote } = useFiltro();
  const nombreLote = useNombreLote();
  const superAdmin = roles.includes("admin");
  const ahora = () => new Date().toTimeString().slice(0, 5);
  const [folio, setFolio] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [hora, setHora] = useState(ahora);
  const [choferId, setChoferId] = useState("");
  const [choferNombre, setChoferNombre] = useState("");
  const [placas, setPlacas] = useState("");
  const [destino, setDestino] = useState("");
  const [cumple, setCumple] = useState<boolean | undefined>();
  const [observaciones, setObservaciones] = useState("");
  const [fotoCamion, setFotoCamion] = useState<string | undefined>();
  const [guardando, setGuardando] = useState(false);
  const [salidaPdf, setSalidaPdf] = useState<Viaje | null>(null);
  const [loteIds, setLoteIds] = useState<string[]>([]);
  const [bins, setBins] = useState<Record<string, string>>({});
  const [modoCantidad, setModoCantidad] = useState<"bins" | "kg">("bins");
  const [kilos, setKilos] = useState<Record<string, string>>({});
  const [kgPorBin, setKgPorBin] = useState(String(KG_POR_BIN));
  const [verCerrados, setVerCerrados] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [foto, setFoto] = useState<string | undefined>();
  const [clave, setClave] = useState(0);

  const opciones = useMemo(
    () =>
      lotesParaSalida(lotes, superAdmin && verCerrados)
        .filter((l) => pasaLote(l))
        .sort(
          (a, b) =>
            Number(loteEnCosecha(b, semanaActual)) - Number(loteEnCosecha(a, semanaActual)) ||
            nombreLote(a).localeCompare(nombreLote(b)),
        ),
    [lotes, superAdmin, verCerrados, pasaLote, semanaActual, nombreLote],
  );
  const hayCerrado = lotes.some((l) => loteIds.includes(l.id) && l.finalizado);

  const guardar = async () => {
    if (guardando) return;
    if (cumple === undefined) return void toast.error("Indica si cumple o no los requisitos.");
    const datos: DatosSalida = {
      folio,
      fecha,
      hora,
      loteIds,
      choferId: choferId || (choferNombre.trim() ? "capturado-en-salida" : ""),
      salida: { placas, destino, cumpleRequisitos: cumple, choferNombre, fotoCamion: fotoCamion ?? "", observaciones,
        tablas: loteIds.map((id) => { const l = lotes.find((x) => x.id === id); return { loteId: id, nombre: nombreLote(l), ha: l ? plantadasLote(l) : 0 }; }) },
      foto,
      motivoCerrado: motivo,
      bins: modoCantidad === "bins" ? Object.fromEntries(loteIds.map((id) => [id, Number(bins[id] ?? 0)])) : undefined,
      kgSalida: modoCantidad === "kg" ? Object.fromEntries(loteIds.map((id) => [id, Number(kilos[id] ?? 0)])) : undefined,
      kgPorBin: modoCantidad === "bins" ? Number(kgPorBin) : undefined,
    };
    setGuardando(true);
    let resultado: string | Viaje;
    try { resultado = await registrarSalida(datos); }
    catch { toast.error("No se pudo guardar la salida. Inténtalo de nuevo."); return; }
    finally { setGuardando(false); }
    if (typeof resultado === "string") return void toast.error(resultado);
    setSalidaPdf(resultado);
    toast.success(`Viaje ${folio} registrado: en tránsito, sin evaluación.`);
    setFolio("");
    setLoteIds([]);
    setBins({});
    setKilos({});
    setMotivo("");
    setFoto(undefined);
    setFotoCamion(undefined);
    setPlacas("");
    setDestino("");
    setCumple(undefined);
    setObservaciones("");
    setChoferId("");
    setChoferNombre("");
    setHora(ahora());
    setClave((k) => k + 1);
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h2 className="text-2xl font-semibold">Registrar salida</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="sl-folio">Folio de la hoja</Label>
          <Input id="sl-folio" value={folio} onChange={(e) => setFolio(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sl-fecha">Fecha de salida</Label>
          <Input id="sl-fecha" type="date" max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sl-hora">Hora de salida</Label>
          <Input id="sl-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Chofer del catálogo</Label>
          <Select value={choferId} onValueChange={(id) => { setChoferId(id); setChoferNombre(choferes.find((c) => c.id === id)?.nombre ?? ""); }}>
            <SelectTrigger aria-label="Chofer del catálogo">
              <SelectValue placeholder={choferes.length ? "Elige" : "Sin choferes en Catálogos"} />
            </SelectTrigger>
            <SelectContent>
              {choferes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2"><Label htmlFor="sl-placas">Placas</Label><Input id="sl-placas" value={placas} onChange={(e) => setPlacas(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="sl-destino">Destino</Label><Input id="sl-destino" value={destino} onChange={(e) => setDestino(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="sl-chofer-nombre">Nombre del chofer</Label><Input id="sl-chofer-nombre" value={choferNombre} onChange={(e) => { setChoferNombre(e.target.value); setChoferId(""); }} /></div>
        <div className="space-y-2"><Label>Cumple los requisitos</Label><div className="flex gap-2" role="group" aria-label="Cumplimiento de requisitos"><Button variant={cumple === true ? "default" : "outline"} aria-pressed={cumple === true} onClick={() => setCumple(true)}>Sí cumple</Button><Button variant={cumple === false ? "default" : "outline"} aria-pressed={cumple === false} onClick={() => setCumple(false)}>No cumple</Button></div></div>
      </div>
      <div className="mt-4 space-y-2"><Label htmlFor="sl-observaciones">Observaciones de la revisión</Label><Textarea id="sl-observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} /></div>

      <div className="mt-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>Tablas o lotes de origen</Label>
          {superAdmin && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={verCerrados} onCheckedChange={(v) => setVerCerrados(v === true)} />
              Mostrar lotes cerrados
            </label>
          )}
        </div>
        {opciones.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay lotes plantados para elegir.</p>
        ) : (
          <div className="grid max-h-64 gap-1 overflow-y-auto rounded-lg border border-border p-2 sm:grid-cols-2">
            {opciones.map((l) => (
              <label key={l.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                <Checkbox
                  checked={loteIds.includes(l.id)}
                  onCheckedChange={(v) => setLoteIds((xs) => (v === true ? [...xs, l.id] : xs.filter((x) => x !== l.id)))}
                />
                <span className="flex-1">{nombreLote(l)}</span>
                <span className="num text-xs text-muted-foreground">{formatoNum(plantadasLote(l))} ha</span>
                {l.finalizado ? (
                  <Badge variant="gris">Cerrado</Badge>
                ) : loteEnCosecha(l, semanaActual) ? (
                  <Badge variant="en-cosecha">En cosecha</Badge>
                ) : null}
              </label>
            ))}
          </div>
        )}
      </div>

      {loteIds.length > 0 && (
        <div className="mt-4 space-y-2 rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1" role="group" aria-label="Cantidad de salida">
              <Button size="sm" variant={modoCantidad === "bins" ? "default" : "outline"} aria-pressed={modoCantidad === "bins"} onClick={() => setModoCantidad("bins")}>Bins</Button>
              <Button size="sm" variant={modoCantidad === "kg" ? "default" : "outline"} aria-pressed={modoCantidad === "kg"} onClick={() => setModoCantidad("kg")}>Kilos</Button>
            </div>
            {modoCantidad === "bins" && <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Kg aprox. por bin
              <Input type="number" inputMode="decimal" className="num h-8 w-20" value={kgPorBin} onChange={(e) => setKgPorBin(e.target.value)} />
            </label>}
          </div>
          {loteIds.map((id) => {
            const l = lotes.find((x) => x.id === id);
            const n = Number(bins[id] ?? 0);
            return (
              <div key={id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="flex-1">{nombreLote(l)}</span>
                <Input
                  type="number"
                  inputMode={modoCantidad === "bins" ? "numeric" : "decimal"}
                  min={modoCantidad === "bins" ? 1 : 0.01}
                  step={modoCantidad === "bins" ? 1 : "any"}
                  className="num w-24"
                  aria-label={`${modoCantidad === "bins" ? "Bins" : "Kilos"} de ${l?.codigo ?? ""}`}
                  placeholder={modoCantidad === "bins" ? "bins" : "kg"}
                  value={(modoCantidad === "bins" ? bins : kilos)[id] ?? ""}
                  onChange={(e) => (modoCantidad === "bins" ? setBins : setKilos)((b) => ({ ...b, [id]: e.target.value }))}
                />
                {modoCantidad === "bins" && <span className="num w-28 text-right text-xs text-muted-foreground">≈ {formatoNum(n * (Number(kgPorBin) || 0))} kg</span>}
              </div>
            );
          })}
          <p className="num text-right text-xs text-muted-foreground">
            Total: {modoCantidad === "bins" ? `${formatoNum(loteIds.reduce((s, id) => s + Number(bins[id] ?? 0), 0))} bins ≈ ${formatoNum(loteIds.reduce((s, id) => s + Number(bins[id] ?? 0), 0) * (Number(kgPorBin) || 0))} kg` : `${formatoNum(loteIds.reduce((s, id) => s + Number(kilos[id] ?? 0), 0))} kg`}
          </p>
        </div>
      )}

      {hayCerrado && (
        <div className="mt-4 space-y-2">
          <Label htmlFor="sl-motivo">Motivo para incluir un lote cerrado</Label>
          <Textarea id="sl-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FotoInput key={clave} foto={foto} setFoto={setFoto} galeria texto="Foto de la hoja (cámara o galería)" />
        <FotoInput key={`camion-${clave}`} foto={fotoCamion} setFoto={setFotoCamion} galeria texto="Foto del camión (cámara o galería)" alt="Camión de la salida" />
      </div>
      <div className="mt-4 flex justify-end"><Button disabled={guardando} onClick={() => void guardar()}>{guardando ? "Guardando salida…" : "Dar salida y generar PDF"}</Button></div>
      <PdfSalida viaje={salidaPdf} onClose={() => setSalidaPdf(null)} />
    </section>
  );
}

/* ───────────── 4.2 Evaluación de la congeladora ───────────── */

type FilaProblema = Omit<ProblemaEvaluado, "kg"> & { key: number };

export function EvaluarDialog({ viaje, onClose }: { viaje: Viaje | null; onClose: () => void }) {
  return (
    <Dialog open={!!viaje} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        {viaje && <EvaluarForm key={viaje.id} viaje={viaje} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function EvaluarForm({ viaje, onClose }: { viaje: Viaje; onClose: () => void }) {
  const { lotes, parametros, hoy, problemas: catalogo, choferes } = useCampo();
  const { roles, nombre } = useSesion();
  const { evaluar } = useCosecha();
  const nombreLote = useNombreLote();
  const superAdmin = roles.includes("admin");
  const [brutos, setBrutos] = useState("");
  const [pagables, setPagables] = useState("");
  const [calificacion, setCalificacion] = useState("8");
  const [problemas, setProblemas] = useState<FilaProblema[]>([]);
  const [reporte, setReporte] = useState<string | undefined>();
  const [modo, setModo] = useState<"auto" | "pct" | "kg">("auto");
  const [valores, setValores] = useState<Record<string, string>>({});
  const ls = viaje.loteIds.map((id) => lotes.find((l) => l.id === id)).filter((l): l is Lote => !!l);
  const varios = ls.length > 1;

  const datos = {
    kgBrutos: Number(brutos),
    kgPagables: Number(pagables),
    calificacion: Number(calificacion),
    problemas: problemas.map(({ key: _k, ...p }) => ({ ...p, valor: Number(p.valor) })),
    reporte,
    ajuste:
      varios && modo !== "auto"
        ? { modo, valores: Object.fromEntries(ls.map((l) => [l.id, Number(valores[l.id] ?? 0)])) }
        : undefined,
  };
  const previa = Number(brutos) > 0 ? evaluarViaje(viaje, { ...datos, reporte: "previa" }, { lotes, parametros, hoy, por: nombre }) : null;
  const repartoAuto = Number(brutos) > 0 ? repartirKg(ls, Number(brutos), Number(pagables) || 0, undefined, viaje.bins, viaje.kgSalida) : null;
  const est = estimadoViaje(viaje);

  const guardar = () => {
    const e = evaluar(viaje.id, datos);
    if (e) return void toast.error(e);
    toast.success(`Viaje ${viaje.folio} evaluado.`);
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Evaluar viaje {viaje.folio}</DialogTitle>
        <DialogDescription>
          Salió el {fechaCorta(viaje.fecha)} a las {viaje.hora} · {choferes.find((c) => c.id === viaje.choferId)?.nombre} ·{" "}
          {ls.map(nombreLote).join(" + ")}
        </DialogDescription>
      </DialogHeader>

      {est.kg > 0 && (
        <div className="rounded-lg bg-muted/60 p-3 text-sm">
          <p className="font-medium">
            El rancho dice que mandó {viaje.kgSalida ? "" : `${formatoNum(est.bins)} bins ≈ `}<span className="num">{formatoNum(est.kg)} kg</span>
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {ls.map((l) => (
              <li key={l.id} className="num">
                {nombreLote(l)}: {viaje.kgSalida ? "" : `${est.porLote[l.id]?.bins ?? 0} bins ≈ `}{formatoNum(est.porLote[l.id]?.kg ?? 0)} kg
              </li>
            ))}
          </ul>
          {Number(brutos) > 0 && (
            <p className="num mt-1 text-xs">
              Llegaron {formatoNum(Number(brutos))} kg brutos · diferencia {Number(brutos) - est.kg >= 0 ? "+" : ""}
              {formatoNum(Number(brutos) - est.kg)} kg
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="ev-b">Kg brutos</Label>
          <Input id="ev-b" type="number" inputMode="decimal" className="num" value={brutos} onChange={(e) => setBrutos(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ev-p">Kg netos pagables</Label>
          <Input id="ev-p" type="number" inputMode="decimal" className="num" value={pagables} onChange={(e) => setPagables(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ev-c">Calificación general (1 a 10)</Label>
          <Input id="ev-c" type="number" min={1} max={10} className="num" value={calificacion} onChange={(e) => setCalificacion(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Problemas de calidad</Label>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setProblemas((xs) => [...xs, { key: Date.now(), problemaId: "", modo: "pct", valor: 0, comentario: "" }])
            }
          >
            <Plus /> Agregar problema
          </Button>
        </div>
        {problemas.length === 0 && <p className="text-xs text-muted-foreground">Sin problemas reportados.</p>}
        {problemas.map((p) => {
          const set = (c: Partial<FilaProblema>) => setProblemas((xs) => xs.map((x) => (x.key === p.key ? { ...x, ...c } : x)));
          return (
            <div key={p.key} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1.4fr_0.8fr_0.8fr_1.4fr_auto]">
              <Select value={p.problemaId} onValueChange={(v) => set({ problemaId: v })}>
                <SelectTrigger aria-label="Problema">
                  <SelectValue placeholder="Problema" />
                </SelectTrigger>
                <SelectContent>
                  {catalogo.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={p.modo} onValueChange={(v) => set({ modo: v as "pct" | "kg" })}>
                <SelectTrigger aria-label="En % o kg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pct">% castigado</SelectItem>
                  <SelectItem value="kg">Kg castigados</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                inputMode="decimal"
                className="num"
                aria-label="Cantidad castigada"
                value={p.valor || ""}
                onChange={(e) => set({ valor: Number(e.target.value) })}
              />
              <Input placeholder="Comentario" value={p.comentario} onChange={(e) => set({ comentario: e.target.value })} />
              <Button size="icon" variant="ghost" aria-label="Quitar problema" onClick={() => setProblemas((xs) => xs.filter((x) => x.key !== p.key))}>
                <Trash2 />
              </Button>
            </div>
          );
        })}
      </div>

      {varios && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Reparto entre tablas</Label>
            {superAdmin && (
              <Select value={modo} onValueChange={(v) => setModo(v as typeof modo)}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{viaje.kgSalida ? "Proporcional a los kilos de salida" : est.bins > 0 ? "Proporcional a los bins" : "Por hectáreas en cosecha"}</SelectItem>
                  <SelectItem value="pct">Ajustar %</SelectItem>
                  <SelectItem value="kg">Kg pagables por tabla</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          {ls.map((l) => {
            const auto = repartoAuto && "filas" in repartoAuto ? repartoAuto.filas.find((f) => f.loteId === l.id) : undefined;
            return (
              <div key={l.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {nombreLote(l)} <span className="num text-xs text-muted-foreground">({formatoNum(plantadasLote(l))} ha)</span>
                </span>
                {modo === "auto" ? (
                  <span className="num">
                    {auto ? `${auto.pct}% · ${formatoNum(auto.kgBrutos)} kg brutos · ${formatoNum(auto.kgPagables)} pagables` : "—"}
                  </span>
                ) : (
                  <Input
                    type="number"
                    inputMode="decimal"
                    className="num w-32"
                    aria-label={modo === "pct" ? `% de ${l.codigo}` : `Kg de ${l.codigo}`}
                    placeholder={modo === "pct" ? "%" : "kg"}
                    value={valores[l.id] ?? ""}
                    onChange={(e) => setValores((v) => ({ ...v, [l.id]: e.target.value }))}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <FotoInput foto={reporte} setFoto={setReporte} galeria pdf texto="Foto o PDF del reporte de la congeladora" />

      {previa && "evaluacion" in previa && (
        <dl className="grid grid-cols-2 gap-2 rounded-lg bg-muted/60 p-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Merma</dt>
            <dd className="num">{previa.evaluacion.merma}%</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Importe bruto</dt>
            <dd className="num">{formatoMXN(previa.evaluacion.importeBruto)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Descuento de planta</dt>
            <dd className="num">−{formatoMXN(previa.evaluacion.descuento)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Importe neto</dt>
            <dd className="num font-medium">{formatoMXN(previa.evaluacion.importeNeto)}</dd>
          </div>
        </dl>
      )}
      {previa && "error" in previa && <p className="text-sm text-destructive">{previa.error}</p>}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={guardar}>Guardar evaluación</Button>
      </DialogFooter>
    </>
  );
}
