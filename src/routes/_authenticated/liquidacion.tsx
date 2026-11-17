import { createFileRoute } from "@tanstack/react-router";
import { FileDown, FileSpreadsheet, ImageIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/campo/AppShell";
import { useNombreLote } from "@/components/campo/Cosecha";
import { FotoInput, VerEvidencia } from "@/components/campo/Evidencia";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  estatusLiquidacion,
  cobrosLiquidacion,
  fechaCorta,
  formatoMXN,
  formatoNum,
  porTablaViajes,
  resumenSemanaPago,
  semanasDePago,
  type ResumenPago,
  enviadoVsLlegado,
} from "@/lib/campo/calc";
import { useCosecha } from "@/lib/campo/cosecha";
import { exportarExcel, exportarPdf } from "@/lib/campo/exportar-liquidacion";
import { useCampo } from "@/lib/campo/store";
import { useSesion } from "@/lib/campo/sesion";
import type { EstatusLiquidacion, Liquidacion } from "@/lib/campo/types";

export const Route = createFileRoute("/_authenticated/liquidacion")({
  head: () => ({
    meta: [
      { title: "Liquidación semanal · Brócoli" },
      { name: "description", content: "Semanas de pago de jueves a miércoles: viajes, kilos, importes, descuentos de planta y pago real de la congeladora." },
      { property: "og:title", content: "Liquidación semanal · Brócoli" },
      { property: "og:description", content: "Lo que la congeladora debe pagar cada semana contra lo que pagó." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LiquidacionPage,
});

const ESTATUS: Record<EstatusLiquidacion, { label: string; variant: "pendiente" | "gris" | "recibido" | "rojo" }> = {
  abierta: { label: "Abierta", variant: "gris" },
  por_cobrar: { label: "Por cobrar", variant: "pendiente" },
  parcial: { label: "Pagada parcialmente", variant: "pendiente" },
  pagada: { label: "Pagada", variant: "recibido" },
  pagada_diferencia: { label: "Pagada con diferencia", variant: "rojo" },
};

function LiquidacionPage() {
  const { viajes, liquidaciones } = useCosecha();
  const semanas = [...new Set([...semanasDePago(viajes), ...liquidaciones.map((l) => l.id)])].sort((a, b) => b.localeCompare(a));

  return (
    <AppShell
      path="/liquidacion"
      eyebrow="Cosecha · jueves a miércoles"
      title="Liquidación semanal"
    >
      <div className="space-y-4">
        {semanas.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No hay liquidaciones registradas.</p>}
        {semanas.map((j) => (
          <Semana key={j} r={resumenSemanaPago(viajes, j)} liq={liquidaciones.find((l) => l.id === j)} />
        ))}
      </div>
    </AppShell>
  );
}

function Semana({ r, liq }: { r: ResumenPago; liq: Liquidacion | undefined }) {
  const { hoy, tablas, lotes, choferes } = useCampo();
  const { guardarPago } = useCosecha();
  const { roles } = useSesion();
  const puedePagar = roles.includes("admin");
  const nombreLote = useNombreLote();
  const [abierta, setAbierta] = useState(false);
  const [montos, setMontos] = useState<Record<string, string>>({});
  const [desglosarAnterior, setDesglosarAnterior] = useState(false);
  const [fecha, setFecha] = useState(hoy);
  const [comprobante, setComprobante] = useState<string | undefined>();
  const est = estatusLiquidacion(r, liq, hoy);
  const cobros = cobrosLiquidacion(r, liq);
  const seleccionados = Object.entries(montos).map(([viajeId, monto]) => ({ viajeId, monto: Number(monto) }));
  const totalSeleccionado = seleccionados.reduce((s, v) => s + (Number.isFinite(v.monto) ? v.monto : 0), 0);
  const nombres = { tablas, lotes, choferes };

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            Jueves {fechaCorta(r.jueves)} – miércoles {fechaCorta(r.fin)}
          </h2>
          <p className="num text-sm text-muted-foreground">
            {r.viajes.length} viajes{r.sinEvaluar > 0 && ` (${r.sinEvaluar} sin evaluar)`} · {formatoNum(r.kgBrutos)} kg brutos ·{" "}
            {formatoNum(r.kgPagables)} kg pagables
          </p>
          {(() => {
            const c = enviadoVsLlegado(r.viajes);
            return c.bins > 0 ? (
              <p className="num text-sm">
                El rancho dijo que mandó {formatoNum(c.kgDicho)} kg ({formatoNum(c.bins)} bins) y llegaron {formatoNum(c.kgLlegado)} kg ·{" "}
                <span className={c.diferencia < 0 ? "text-destructive" : ""}>
                  {c.diferencia >= 0 ? "+" : ""}
                  {formatoNum(c.diferencia)} kg ({c.pct}%)
                </span>
              </p>
            ) : null;
          })()}
        </div>
        <Badge variant={ESTATUS[est].variant}>{ESTATUS[est].label}</Badge>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
        <div>
          <dt className="text-xs text-muted-foreground">Importe bruto</dt>
          <dd className="num">{formatoMXN(r.importeBruto)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Descuentos de planta</dt>
          <dd className="num">−{formatoMXN(r.descuentos)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Neto esperado</dt>
          <dd className="num font-medium">{formatoMXN(r.importeNeto)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Pagado</dt>
          <dd className="num">{liq ? formatoMXN(liq.pagado) : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Pendiente de cobro</dt>
          <dd className={`num ${cobros.pendiente > 0 ? "font-medium text-destructive" : ""}`}>
            {formatoMXN(cobros.pendiente)}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setAbierta((v) => !v)}>
          {abierta ? "Ocultar desglose" : "Ver desglose y registrar pago"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => exportarExcel(r, nombres, liq)}>
          <FileSpreadsheet /> Excel
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void exportarPdf(r, nombres, liq).catch(() => toast.error("No se pudo crear el PDF."))}
        >
          <FileDown /> PDF
        </Button>
        {liq && (
          <VerEvidencia foto={liq.comprobante} title="Ver comprobante">
            <span className="inline-flex items-center gap-1 px-2 text-sm text-primary">
              <ImageIcon className="size-4" /> Comprobante
            </span>
          </VerEvidencia>
        )}
      </div>

      {abierta && (
        <div className="mt-4 space-y-5">
          {cobros.sinAsignar > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-l-2 border-border pl-3 text-sm">
              <p>Pago anterior sin asignar a viajes: <span className="num">{formatoMXN(cobros.sinAsignar)}</span></p>
              {puedePagar && <Button size="sm" variant="outline" onClick={() => { setDesglosarAnterior(!desglosarAnterior); setMontos({}); }}>{desglosarAnterior ? "Cancelar desglose anterior" : "Desglosar pago anterior"}</Button>}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  {puedePagar && <th className="py-1 pr-3 font-medium"><Checkbox aria-label={`Seleccionar todos los viajes de ${r.jueves}`} checked={r.viajes.some((v) => cobros.porViaje.find((c) => c.viajeId === v.id)?.pendiente) && r.viajes.filter((v) => v.evaluacion && (cobros.porViaje.find((c) => c.viajeId === v.id)?.pendiente ?? 0) > 0).every((v) => v.id in montos)} onCheckedChange={(checked) => setMontos(checked ? Object.fromEntries(cobros.porViaje.filter((c) => c.pendiente > 0).map((c) => [c.viajeId, String(c.pendiente)])) : {})} /></th>}
                  <th className="py-1 pr-3 font-medium">Viaje</th>
                  <th className="py-1 pr-3 font-medium">Tablas</th>
                  <th className="py-1 pr-3 text-right font-medium">Brutos</th>
                  <th className="py-1 pr-3 text-right font-medium">Pagables</th>
                  <th className="py-1 pr-3 text-right font-medium">Bruto</th>
                  <th className="py-1 pr-3 text-right font-medium">Descuento</th>
                  <th className="py-1 text-right font-medium">Neto</th>
                  <th className="py-1 pl-3 text-right font-medium">Pagado</th>
                  <th className="py-1 pl-3 text-right font-medium">Pendiente</th>
                  {puedePagar && <th className="py-1 pl-3 text-right font-medium">Este pago</th>}
                </tr>
              </thead>
              <tbody>
                {r.viajes.map((v) => {
                  const cobro = cobros.porViaje.find((c) => c.viajeId === v.id);
                  const saldo = cobro?.pendiente ?? 0;
                  return (
                  <tr key={v.id} className="border-t border-border/60">
                    {puedePagar && <td className="py-1.5 pr-3"><Checkbox aria-label={`Seleccionar viaje ${v.folio}`} disabled={!v.evaluacion || saldo <= 0} checked={v.id in montos} onCheckedChange={(checked) => setMontos((prev) => { const next = { ...prev }; if (checked) next[v.id] = String(saldo); else delete next[v.id]; return next; })} /></td>}
                    <td className="py-1.5 pr-3">
                      {v.folio} · {fechaCorta(v.fecha)}
                    </td>
                    <td className="py-1.5 pr-3 text-xs">{v.loteIds.map((id) => nombreLote(lotes.find((l) => l.id === id))).join(" + ")}</td>
                    {v.evaluacion ? (
                      <>
                        <td className="num py-1.5 pr-3 text-right">{formatoNum(v.evaluacion.kgBrutos)}</td>
                        <td className="num py-1.5 pr-3 text-right">{formatoNum(v.evaluacion.kgPagables)}</td>
                        <td className="num py-1.5 pr-3 text-right">{formatoMXN(v.evaluacion.importeBruto)}</td>
                        <td className="num py-1.5 pr-3 text-right">−{formatoMXN(v.evaluacion.descuento)}</td>
                        <td className="num py-1.5 text-right">{formatoMXN(v.evaluacion.importeNeto)}</td>
                      </>
                    ) : (
                      <td colSpan={5} className="py-1.5 text-right text-xs text-muted-foreground">
                        En tránsito, sin evaluación
                      </td>
                    )}
                    <td className="num py-1.5 pl-3 text-right">{v.evaluacion ? formatoMXN(cobro?.pagado ?? 0) : "—"}</td>
                    <td className="num py-1.5 pl-3 text-right">{v.evaluacion ? formatoMXN(saldo) : "—"}</td>
                    {puedePagar && <td className="py-1.5 pl-3">{v.id in montos && <Input aria-label={`Monto para viaje ${v.folio}`} type="number" inputMode="decimal" min="0.01" max={saldo} step="0.01" className="num w-32" value={montos[v.id]} onChange={(e) => setMontos((prev) => ({ ...prev, [v.id]: e.target.value }))} />}</td>}
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="mb-1 font-medium">Por tabla</h3>
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              {porTablaViajes(r.viajes).map((f) => (
                <li key={f.tablaId} className="num flex justify-between rounded-md bg-muted/50 px-3 py-1.5">
                  <span className="font-sans">{tablas.find((t) => t.id === f.tablaId)?.nombre}</span>
                  <span>
                    {formatoNum(f.kgPagables)} kg · {formatoMXN(f.importe)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {puedePagar && <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2 sm:items-end">
            <div className="space-y-2">
              <p className="text-sm">{desglosarAnterior ? "Desglose del pago anterior" : "Nuevo abono"} · {seleccionados.length} viajes</p>
              <p className="num font-semibold">{formatoMXN(totalSeleccionado)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`pf-${r.jueves}`}>Fecha del pago</Label>
              <Input id={`pf-${r.jueves}`} type="date" disabled={desglosarAnterior} value={desglosarAnterior ? liq?.fecha ?? fecha : fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            {!desglosarAnterior && <FotoInput foto={comprobante} setFoto={setComprobante} galeria pdf texto="Comprobante (foto o PDF)" />}
            <Button
              disabled={!seleccionados.length}
              onClick={() => {
                const e = guardarPago(r.jueves, { viajes: seleccionados, fecha, comprobante, desglosarAnterior });
                if (e) return void toast.error(e);
                setMontos({}); setComprobante(undefined); setDesglosarAnterior(false);
                toast.success("Pago registrado.");
              }}
            >
              {desglosarAnterior ? "Guardar desglose anterior" : "Registrar abono"}
            </Button>
          </div>}
          {!!liq?.pagos?.length && <div className="space-y-2 border-t border-border pt-3">
            <h3 className="font-medium">Pagos registrados</h3>
            {liq.pagos.map((p) => <div key={p.id} className="flex flex-wrap justify-between gap-2 text-sm">
              <span>{fechaCorta(p.fecha)} · {p.viajes.length ? p.viajes.map((f) => `${r.viajes.find((v) => v.id === f.viajeId)?.folio ?? f.viajeId}: ${formatoMXN(f.monto)}`).join(" · ") : "Sin asignar a viajes"}</span>
              <span className="num">{formatoMXN(p.pagado)} · <VerEvidencia foto={p.comprobante} title="Ver comprobante del abono"><span className="text-primary">Comprobante</span></VerEvidencia></span>
            </div>)}
          </div>}
        </div>
      )}
    </article>
  );
}
