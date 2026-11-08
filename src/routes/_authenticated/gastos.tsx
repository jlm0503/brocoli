import { createFileRoute } from "@tanstack/react-router";
import { FileUp, ImageIcon, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/campo/AppShell";
import { FotoInput, VerEvidencia } from "@/components/campo/Evidencia";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CONCEPTOS_GASTO,
  CULTIVO_TOTAL,
  PLANTILLA_GASTOS_CSV,
  cultivosDelRancho,
  formatoMXN,
  formatoNum,
  idGasto,
  leerGastosCsv,
  nombreConceptoGasto,
  nombreCultivo,
  prorrateoSemana,
  repartoVigente,
  type DatosGasto,
} from "@/lib/campo/calc";
import { useGastos } from "@/lib/campo/gastos";
import { useCampo } from "@/lib/campo/store";
import type { ConceptoGasto, GastoRancho } from "@/lib/campo/types";

export const Route = createFileRoute("/_authenticated/gastos")({
  head: () => ({
    meta: [
      { title: "Gastos de rancho · Brócoli" },
      { name: "description", content: "Captura semanal de nómina, diésel, gasolina, mantenimiento y otros por rancho y cultivo." },
      { property: "og:title", content: "Gastos de rancho · Brócoli" },
      { property: "og:description", content: "Cuadrícula por semana y rancho, reparto por % entre cultivos e importación desde Excel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GastosRancho,
});

/** Celda abierta en la ventana de captura. */
interface Celda {
  cultivo: string;
  modo: "directo" | "total";
  concepto: ConceptoGasto;
}

const TIPOS_CAPTURA: { id: ConceptoGasto; nombre: string }[] = [
  { id: "nomina", nombre: "Gasto de nómina" },
  { id: "diesel", nombre: "Gasto de combustible" },
  { id: "mantenimiento", nombre: "Gasto de reparaciones" },
  { id: "otros", nombre: "Otros gastos" },
];

function GastosRancho() {
  const { ranchos, lotes, cultivos, semanaActual } = useCampo();
  const { gastos, repartos, puedeCapturar, guardarGasto, eliminarGasto, guardarReparto } = useGastos();
  const [semana, setSemana] = useState(semanaActual);
  const [ranchoElegido, setRanchoElegido] = useState("");
  // Los ranchos llegan de la nube: si aún no se elige uno, usa el primero que exista.
  const ranchoId = ranchos.some((r) => r.id === ranchoElegido) ? ranchoElegido : (ranchos[0]?.id ?? "");
  const [celda, setCelda] = useState<Celda | null>(null);
  const [editando, setEditando] = useState<GastoRancho | null>(null);
  const [monto, setMonto] = useState("");
  const [detalle, setDetalle] = useState("");
  const [comentario, setComentario] = useState("");
  const [comprobante, setComprobante] = useState<string | undefined>();
  const [clave, setClave] = useState(0);
  const [csv, setCsv] = useState<{ filas: ReturnType<typeof leerGastosCsv>["filas"]; errores: string[] } | null>(null);
  const [pct, setPct] = useState<Record<string, string>>({});
  const [soloSemana, setSoloSemana] = useState(false);

  const rancho = ranchos.find((r) => r.id === ranchoId);
  const reparto = repartos.find((r) => r.ranchoId === ranchoId);
  const cultivosRancho = useMemo(() => cultivosDelRancho(lotes, ranchoId), [lotes, ranchoId]);
  const vigente = repartoVigente(reparto, semana);
  const semanas = Array.from({ length: 14 }, (_, i) => semanaActual + 1 - i);

  const deSemana = gastos
    .filter((g) => g.semana === semana && g.ranchoId === ranchoId)
    .sort((a, b) => a.cultivo.localeCompare(b.cultivo) || a.concepto.localeCompare(b.concepto));

  const celdaGasto = (cultivo: string, modo: "directo" | "total", concepto: ConceptoGasto) =>
    deSemana.find((g) => g.modo === modo && (modo === "total" ? g.cultivo === CULTIVO_TOTAL : g.cultivo === cultivo) && g.concepto === concepto);

  const totalCelda = (cultivo: string, concepto: ConceptoGasto) =>
    formatoMXN(
      deSemana
        .filter((g) => g.modo === "directo" && g.cultivo === cultivo && g.concepto === concepto)
        .reduce((s, g) => s + g.monto, 0),
    );

  const abrir = (c: Celda, previo?: GastoRancho) => {
    setCelda(c);
    setEditando(previo ?? null);
    setMonto(previo ? String(previo.monto) : "");
    setDetalle(previo?.detalle ?? "");
    setComentario(previo?.comentario ?? "");
    setComprobante(previo?.comprobante);
    setClave((k) => k + 1);
  };

  const guardar = () => {
    if (!celda) return;
    const d: DatosGasto = {
      semana,
      ranchoId,
      cultivo: celda.modo === "total" ? CULTIVO_TOTAL : celda.cultivo,
      concepto: celda.concepto,
      monto: Number(monto),
      modo: celda.modo,
      detalle: detalle || undefined,
      comentario: comentario || undefined,
      comprobante: comprobante || undefined,
    };
    const error = guardarGasto(d);
    if (error) return void toast.error(error);
    // Si el detalle de «Otros» cambió, la línea anterior queda sustituida.
    if (editando && editando.id !== idGasto(d)) eliminarGasto(editando.id);
    toast.success(`Gasto guardado: ${nombreConceptoGasto(celda.concepto)}.`);
    setCelda(null);
    setEditando(null);
  };

  const guardarPct = () => {
    const v = Object.fromEntries(Object.entries(pct).map(([c, p]) => [c, Number(p)]));
    const error = guardarReparto(ranchoId, v, soloSemana ? semana : undefined);
    if (error) return void toast.error(error);
    toast.success(soloSemana ? `Reparto ajustado solo para la semana ${semana}.` : "Reparto guardado para todas las semanas.");
  };

  const leerArchivo = async (file: File) => {
    const texto = await file.text();
    const r = leerGastosCsv(texto, { ranchos, cultivos });
    setCsv(r);
    if (r.filas.length === 0 && r.errores.length === 0) toast.error("El archivo no trae filas.");
  };

  const capturarCsv = () => {
    if (!csv) return;
    let ok = 0;
    const fallos: string[] = [];
    for (const f of csv.filas) {
      const error = guardarGasto({ ...f, modo: "directo" as const });
      if (error) fallos.push(`${nombreCultivo(cultivos, f.cultivo)} · ${nombreConceptoGasto(f.concepto)}: ${error}`);
      else ok += 1;
    }
    if (ok > 0) toast.success(`${ok} gasto(s) capturados.`);
    if (fallos.length > 0) toast.error(fallos.slice(0, 3).join(" · "));
    setCsv(null);
  };

  const repartoSemana = useMemo(
    () => prorrateoSemana({ semana, ranchoId, lotes, gastos, reparto }),
    [semana, ranchoId, lotes, gastos, reparto],
  );
  const nombreLote = (id: string) => {
    const l = lotes.find((x) => x.id === id);
    return l ? `${l.codigo} · ${formatoNum(l.ha)} ha · ${nombreCultivo(cultivos, l.cultivo)}` : id;
  };

  return (
    <AppShell
      path="/gastos"
      eyebrow={`Semana ${semana}${semana === semanaActual ? " (actual)" : ""}`}
      title="Gastos de rancho"
      description="Nómina, diésel, gasolina, mano de obra extra, mantenimiento y otros por semana, rancho y cultivo. Lo que no se puede repartir queda como gasto no asignado."
    >
      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>Semana</Label>
          <Select value={String(semana)} onValueChange={(v) => setSemana(Number(v))}>
            <SelectTrigger aria-label="Semana">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {semanas.map((w) => (
                <SelectItem key={w} value={String(w)}>
                  Semana {w}
                  {w === semanaActual ? " (actual)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Rancho</Label>
          <Select value={ranchoId} onValueChange={setRanchoElegido}>
            <SelectTrigger aria-label="Rancho">
              <SelectValue placeholder="Sin ranchos" />
            </SelectTrigger>
            <SelectContent>
              {ranchos.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="gs-csv">Importar de Excel o CSV</Label>
          <div className="flex gap-2">
            <Input
              id="gs-csv"
              type="file"
              accept=".csv,text/csv,text/plain"
              className="text-sm"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void leerArchivo(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              onClick={() => void navigator.clipboard.writeText(PLANTILLA_GASTOS_CSV).then(() => toast.success("Plantilla copiada."))}
            >
              Copiar plantilla
            </Button>
          </div>
        </div>
      </section>

      <div className="mb-6">
        <Button disabled={!puedeCapturar || !ranchoId} onClick={() => abrir({ cultivo: CULTIVO_TOTAL, modo: "total", concepto: "nomina" })}>
          <Plus /> Agregar gasto de rancho
        </Button>
      </div>

      {csv && (
        <section className="mb-8 rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-2xl font-semibold">Revisar importación</h2>
            <Button variant="ghost" size="sm" onClick={() => setCsv(null)} aria-label="Cerrar importación">
              <X /> Cerrar
            </Button>
          </div>
          {csv.errores.length > 0 && (
            <ul className="mb-3 space-y-1 text-sm text-destructive">
              {csv.errores.slice(0, 10).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
          {csv.filas.length > 0 && (
            <>
              <p className="mb-2 text-sm text-muted-foreground">{csv.filas.length} fila(s) listas para capturar.</p>
              <ul className="mb-3 grid gap-1 text-sm sm:grid-cols-2">
                {csv.filas.slice(0, 20).map((f, i) => (
                  <li key={i} className="num">
                    Sem {f.semana} · {nombreCultivo(cultivos, f.cultivo)} · {nombreConceptoGasto(f.concepto)} · {formatoMXN(f.monto)}
                  </li>
                ))}
              </ul>
              <Button onClick={capturarCsv}>
                <FileUp /> Capturar {csv.filas.length} gasto(s)
              </Button>
            </>
          )}
        </section>
      )}

      <section className="mb-8 rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="mb-1 text-2xl font-semibold">Cuadrícula · {rancho?.nombre ?? "sin rancho"}</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Toca una celda para capturar o corregir el monto de esa semana. La fila «Total del rancho» se reparte entre cultivos con los %.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Cultivo</th>
                {CONCEPTOS_GASTO.map((c) => (
                  <th key={c.id} className="px-3 py-2 text-right font-medium">
                    {c.nombre}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...cultivosRancho.map((c) => ({ cultivo: c, modo: "directo" as const, etiqueta: nombreCultivo(cultivos, c) })), {
                cultivo: CULTIVO_TOTAL,
                modo: "total" as const,
                etiqueta: "Total del rancho",
              }].map((f) => (
                <tr key={`${f.modo}-${f.cultivo}`} className="border-t border-border/60">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {f.etiqueta}
                  </th>
                  {CONCEPTOS_GASTO.map((c) => {
                    const gasto = celdaGasto(f.cultivo, f.modo, c.id);
                    const suma = f.modo === "directo" ? totalCelda(f.cultivo, c.id) : gasto ? formatoMXN(gasto.monto) : "";
                    return (
                      <td key={c.id} className="px-1 py-1 text-right">
                        <button
                          type="button"
                          onClick={() => abrir({ cultivo: f.cultivo, modo: f.modo, concepto: c.id }, gasto)}
                          className={`w-full rounded-md px-2 py-1 text-right num transition-colors hover:bg-primary/10 ${
                            gasto ? "font-medium text-foreground" : "text-muted-foreground/60"
                          }`}
                          aria-label={`${f.etiqueta} · ${c.nombre}`}
                        >
                          {suma || "—"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {cultivosRancho.length === 0 && (
                <tr>
                  <td colSpan={CONCEPTOS_GASTO.length + 1} className="px-3 py-6 text-center text-muted-foreground">
                    Este rancho aún no tiene cultivos planeados o plantados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="mb-1 text-2xl font-semibold">% de reparto entre cultivos</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Se usan cuando capturas «Total del rancho». Deben sumar 100%. Puedes dejar los generales y ajustar solo una semana.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cultivosRancho.map((c) => (
            <div key={c} className="flex items-center justify-between gap-3">
              <Label htmlFor={`pct-${c}`}>{nombreCultivo(cultivos, c)}</Label>
              <Input
                id={`pct-${c}`}
                type="number"
                inputMode="decimal"
                className="num w-28"
                value={pct[c] ?? String(vigente[c] ?? 0)}
                onChange={(e) => setPct((p) => ({ ...p, [c]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="num text-sm">
            Suma: {formatoNum(Object.entries(pct).length > 0 ? Object.values(pct).reduce((s, v) => s + Number(v), 0) : Object.values(vigente).reduce((s, v) => s + v, 0))}%
          </span>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={soloSemana} onChange={(e) => setSoloSemana(e.target.checked)} />
            Solo para la semana {semana}
          </label>
          <Button onClick={guardarPct}>Guardar reparto</Button>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold">Capturado en la semana {semana}</h2>
        {deSemana.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay gastos de {rancho?.nombre ?? "este rancho"} en la semana {semana}.</p>
        ) : (
          <ul className="space-y-2">
            {deSemana.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm">
                <span className="flex flex-wrap items-center gap-x-2">
                  <span className="font-medium">
                    {g.modo === "total" ? "Total del rancho" : nombreCultivo(cultivos, g.cultivo)}
                  </span>
                  · {nombreConceptoGasto(g.concepto)}
                  {g.detalle ? ` (${g.detalle})` : ""} · <span className="num">{formatoMXN(g.monto)}</span>
                  {g.comentario ? <span className="text-muted-foreground">· {g.comentario}</span> : null}
                </span>
                <span className="flex gap-1">
                  {g.comprobante ? (
                    <VerEvidencia foto={g.comprobante} title="Ver comprobante">
                      <ImageIcon className="size-4" />
                    </VerEvidencia>
                  ) : null}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Editar gasto"
                    onClick={() =>
                      abrir(
                        { cultivo: g.cultivo, modo: g.modo, concepto: g.concepto },
                        g,
                      )
                    }
                  >
                    <Pencil />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Eliminar gasto" onClick={() => eliminarGasto(g.id)}>
                    <Trash2 />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="mb-1 text-2xl font-semibold">Cómo se reparte esta semana</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Solo entre los lotes del mismo cultivo y rancho que están activos esa semana, proporcional a hectáreas.
        </p>
        {Object.keys(repartoSemana.porLote).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada repartido todavía en la semana {semana}.</p>
        ) : (
          <ul className="mb-4 grid gap-1 text-sm sm:grid-cols-2">
            {Object.entries(repartoSemana.porLote)
              .sort((a, b) => b[1] - a[1])
              .map(([loteId, monto2]) => (
                <li key={loteId} className="flex justify-between gap-3 rounded-md bg-secondary/40 px-3 py-1">
                  <span>{nombreLote(loteId)}</span>
                  <span className="num font-medium">{formatoMXN(monto2)}</span>
                </li>
              ))}
          </ul>
        )}
        {repartoSemana.noAsignado.length > 0 && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <p className="mb-1 font-medium text-destructive">Gasto no asignado ({formatoMXN(repartoSemana.noAsignado.reduce((s, n) => s + n.monto, 0))})</p>
            <ul className="space-y-0.5">
              {repartoSemana.noAsignado.map((n, i) => (
                <li key={i} className="num">
                  {nombreCultivo(cultivos, n.cultivo)} · {nombreConceptoGasto(n.concepto)} · {formatoMXN(n.monto)} · {n.motivo}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <Dialog open={!!celda} onOpenChange={(o) => !o && setCelda(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {celda ? `${nombreConceptoGasto(celda.concepto)} · ${celda.modo === "total" ? "Total del rancho" : nombreCultivo(cultivos, celda.cultivo)}` : ""}
            </DialogTitle>
            <DialogDescription>
              Semana {semana} · {rancho?.nombre}. El monto queda guardado con tu nombre y la fecha de hoy.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Tipo de gasto</Label>
              <Select value={celda?.concepto ?? "nomina"} onValueChange={(v) => {
                const tipo = TIPOS_CAPTURA.find((t) => t.id === v);
                if (tipo && celda) setCelda({ ...celda, concepto: tipo.id });
              }}>
                <SelectTrigger aria-label="Tipo de gasto"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_CAPTURA.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
                  {celda && !TIPOS_CAPTURA.some((t) => t.id === celda.concepto) && <SelectItem value={celda.concepto}>{nombreConceptoGasto(celda.concepto)}</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            {celda && (celda.concepto === "diesel" || celda.concepto === "gasolina") && <div className="space-y-2">
              <Label>Combustible</Label>
              <Select value={celda.concepto} onValueChange={(v) => {
                if (v === "diesel" || v === "gasolina") setCelda({ ...celda, concepto: v });
              }}>
                <SelectTrigger aria-label="Combustible"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="diesel">Diésel</SelectItem><SelectItem value="gasolina">Gasolina</SelectItem></SelectContent>
              </Select>
            </div>}
            <div className="space-y-2">
              <Label htmlFor="gs-monto">Monto (MXN)</Label>
              <Input id="gs-monto" type="number" inputMode="decimal" className="num" value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus />
            </div>
            {celda?.concepto === "otros" && (
              <div className="space-y-2">
                <Label htmlFor="gs-detalle">Concepto (obligatorio en «Otros»)</Label>
                <Input id="gs-detalle" value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Ej. Renta de bomba" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="gs-comentario">Comentario (opcional)</Label>
              <Input id="gs-comentario" value={comentario} onChange={(e) => setComentario(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Comprobante (opcional)</Label>
              <FotoInput key={clave} foto={comprobante} setFoto={setComprobante} texto="Foto o PDF del comprobante" galeria pdf />
            </div>
            {celda?.modo === "total" && (
              <p className="rounded-lg bg-secondary/50 p-3 text-sm text-muted-foreground">
                Se repartirá:{" "}
                {Object.entries(vigente)
                  .map(([c, p]) => `${nombreCultivo(cultivos, c)} ${formatoNum(p)}%`)
                  .join(" · ") || "define los % de reparto arriba"}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCelda(null)}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={!puedeCapturar}>
              Guardar gasto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
