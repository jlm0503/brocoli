import { createFileRoute } from "@tanstack/react-router";
import { FileDown, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/campo/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CONCEPTOS_GASTO,
  formatoMXN,
  formatoNum,
  nombreCultivo,
  estadoResultados,
  variacionPct,
  type FilaResultados,
} from "@/lib/campo/calc";
import { exportarResultadosExcel, exportarResultadosPdf } from "@/lib/campo/exportar-resultados";
import { useCosecha } from "@/lib/campo/cosecha";
import { useCostos } from "@/lib/campo/costos";
import { useGastos } from "@/lib/campo/gastos";
import { useCampo } from "@/lib/campo/store";

export const Route = createFileRoute("/_authenticated/resultados")({
  head: () => ({
    meta: [
      { title: "Estado de resultados · Brócoli" },
      { name: "description", content: "Ingreso menos insumos, planta, gastos comunes y gasto no asignado: utilidad real por rancho y cultivo." },
      { property: "og:title", content: "Estado de resultados · Brócoli" },
      { property: "og:description", content: "Utilidad real por rancho y cultivo, con comparativo y exportación a Excel o PDF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Resultados,
});

type Agrupar = "rancho-cultivo" | "rancho" | "cultivo";

const AGRUPACIONES: { id: Agrupar; nombre: string }[] = [
  { id: "rancho-cultivo", nombre: "Rancho y cultivo" },
  { id: "rancho", nombre: "Rancho" },
  { id: "cultivo", nombre: "Cultivo" },
];

/** Junta las filas por rancho, por cultivo o por ambas, sumando y recalculando ratios. */
function agrupar(filas: FilaResultados[], modo: Agrupar): FilaResultados[] {
  const clave = (f: FilaResultados) => (modo === "rancho" ? f.ranchoId : modo === "cultivo" ? f.cultivo : `${f.ranchoId}|${f.cultivo}`);
  const grupos = new Map<string, FilaResultados>();
  for (const f of filas) {
    const k = clave(f);
    const a = grupos.get(k);
    if (!a) {
      grupos.set(k, { ...f, clave: k, porConcepto: { ...f.porConcepto } });
      continue;
    }
    a.lotes += f.lotes;
    a.ha = Math.round((a.ha + f.ha) * 100) / 100;
    for (const c of ["ingreso", "insumos", "planta", "gastosComunes", "noAsignado", "utilidadDirecta", "utilidadReal"] as const)
      a[c] = Math.round((a[c] + f[c]) * 100) / 100;
    for (const c of CONCEPTOS_GASTO) a.porConcepto[c.id] = Math.round(((a.porConcepto[c.id] ?? 0) + (f.porConcepto[c.id] ?? 0)) * 100) / 100;
  }
  return [...grupos.values()].map((f) => {
    const gastoTotal = f.insumos + f.planta + f.gastosComunes + f.noAsignado;
    return {
      ...f,
      utilidadReal: Math.round((f.utilidadDirecta - f.gastosComunes - f.noAsignado) * 100) / 100,
      utilidadRealHa: f.ha > 0 ? Math.round(((f.utilidadDirecta - f.gastosComunes - f.noAsignado) / f.ha) * 100) / 100 : 0,
      retornoReal: gastoTotal > 0 ? Math.round((f.ingreso / gastoTotal) * 100) / 100 : null,
    };
  });
}

function Resultados() {
  const { ranchos, cultivos, lotes, parametros, semanaActual } = useCampo();
  const { viajes } = useCosecha();
  const { gastos, repartos } = useGastos();
  const { costoLote, plantaLote } = useCostos();
  const [desde, setDesde] = useState(semanaActual - 11);
  const [hasta, setHasta] = useState(semanaActual);
  const [ranchoId, setRanchoId] = useState("todos");
  const [cultivoId, setCultivoId] = useState("todos");
  const [agrupacion, setAgrupacion] = useState<Agrupar>("rancho-cultivo");
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  const semanas = Array.from({ length: 40 }, (_, i) => semanaActual - 25 + i);

  const t = useMemo(
    () =>
      estadoResultados({
        desde,
        hasta,
        lotes,
        viajes,
        parametros,
        gastos,
        repartos,
        costoLote,
        plantaLote,
        pasa: (l) => (ranchoId === "todos" || l.ranchoId === ranchoId) && (cultivoId === "todos" || l.cultivo === cultivoId),
      }),
    [desde, hasta, lotes, viajes, parametros, gastos, repartos, costoLote, plantaLote, ranchoId, cultivoId],
  );

  const filas = useMemo(() => agrupar(t.filas, agrupacion), [t.filas, agrupacion]);
  const nombreF = (f: FilaResultados) =>
    agrupacion === "rancho"
      ? ranchos.find((r) => r.id === f.ranchoId)?.nombre ?? f.ranchoId
      : agrupacion === "cultivo"
        ? nombreCultivo(cultivos, f.cultivo)
        : `${ranchos.find((r) => r.id === f.ranchoId)?.nombre ?? f.ranchoId} · ${nombreCultivo(cultivos, f.cultivo)}`;

  const ia = filas.find((f) => f.clave === a);
  const ib = filas.find((f) => f.clave === b);
  const variacion = (x: number, y: number) => {
    const v = variacionPct(x, y);
    return v === null ? "—" : `${v > 0 ? "+" : ""}${formatoNum(v)}%`;
  };

  return (
    <AppShell
      path="/resultados"
      eyebrow={`Semanas ${desde} a ${hasta}`}
      title="Estado de resultados"
      description="Ingreso menos insumos, planta, gastos comunes y gasto no asignado. La utilidad real y su retorno solo los ve el Super Admin."
      actions={
        <>
          <Button variant="outline" onClick={() => exportarResultadosExcel(t, { ranchos, cultivos })}>
            <FileDown /> Excel
          </Button>
          <Button variant="outline" onClick={() => void exportarResultadosPdf(t, { ranchos, cultivos })}>
            <FileText /> PDF
          </Button>
        </>
      }
    >
      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-2">
          <Label>Semana desde</Label>
          <Select value={String(desde)} onValueChange={(v) => setDesde(Number(v))}>
            <SelectTrigger aria-label="Semana desde">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {semanas.map((w) => (
                <SelectItem key={w} value={String(w)}>
                  Semana {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Semana hasta</Label>
          <Select value={String(hasta)} onValueChange={(v) => setHasta(Number(v))}>
            <SelectTrigger aria-label="Semana hasta">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {semanas.map((w) => (
                <SelectItem key={w} value={String(w)}>
                  Semana {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Rancho</Label>
          <Select value={ranchoId} onValueChange={setRanchoId}>
            <SelectTrigger aria-label="Rancho">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {ranchos.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Cultivo</Label>
          <Select value={cultivoId} onValueChange={setCultivoId}>
            <SelectTrigger aria-label="Cultivo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {cultivos.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Agrupar por</Label>
          <Select value={agrupacion} onValueChange={(v) => setAgrupacion(v as Agrupar)}>
            <SelectTrigger aria-label="Agrupar por">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGRUPACIONES.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="mb-8 overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">{AGRUPACIONES.find((g) => g.id === agrupacion)?.nombre}</th>
              <th className="px-3 py-2 text-right font-medium">ha</th>
              <th className="px-3 py-2 text-right font-medium">Ingreso</th>
              <th className="px-3 py-2 text-right font-medium">Insumos</th>
              <th className="px-3 py-2 text-right font-medium">Planta</th>
              {CONCEPTOS_GASTO.map((c) => (
                <th key={c.id} className="px-3 py-2 text-right font-medium">
                  {c.nombre}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">No asignado</th>
              <th className="px-3 py-2 text-right font-medium">Utilidad directa</th>
              <th className="px-3 py-2 text-right font-medium">Utilidad real</th>
              <th className="px-3 py-2 text-right font-medium">Utilidad real / ha</th>
              <th className="px-3 py-2 text-right font-medium">Retorno</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.clave} className="border-t border-border/60">
                <th scope="row" className="px-3 py-2 text-left font-medium">
                  {nombreF(f)}
                </th>
                <td className="num px-3 py-2 text-right">{formatoNum(f.ha)}</td>
                <td className="num px-3 py-2 text-right">{formatoMXN(f.ingreso)}</td>
                <td className="num px-3 py-2 text-right">{formatoMXN(f.insumos)}</td>
                <td className="num px-3 py-2 text-right">{formatoMXN(f.planta)}</td>
                {CONCEPTOS_GASTO.map((c) => (
                  <td key={c.id} className="num px-3 py-2 text-right">
                    {formatoMXN(f.porConcepto[c.id] ?? 0)}
                  </td>
                ))}
                <td className="num px-3 py-2 text-right">{formatoMXN(f.noAsignado)}</td>
                <td className="num px-3 py-2 text-right">{formatoMXN(f.utilidadDirecta)}</td>
                <td className={`num px-3 py-2 text-right font-medium ${f.utilidadReal < 0 ? "text-destructive" : "text-primary"}`}>
                  {formatoMXN(f.utilidadReal)}
                </td>
                <td className="num px-3 py-2 text-right">{formatoMXN(f.utilidadRealHa)}</td>
                <td className="num px-3 py-2 text-right">{f.retornoReal === null ? "—" : `${formatoNum(f.retornoReal)}×`}</td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={CONCEPTOS_GASTO.length + 8} className="px-3 py-6 text-center text-muted-foreground">
                  No hay lotes activos ni gastos capturados en ese rango.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-secondary/60 font-medium">
            <tr className="border-t border-border">
              <th scope="row" className="px-3 py-2 text-left">
                Totales
              </th>
              <td className="num px-3 py-2 text-right">{formatoNum(t.totales.ha)}</td>
              <td className="num px-3 py-2 text-right">{formatoMXN(t.totales.ingreso)}</td>
              <td className="num px-3 py-2 text-right">{formatoMXN(t.totales.insumos)}</td>
              <td className="num px-3 py-2 text-right">{formatoMXN(t.totales.planta)}</td>
              {CONCEPTOS_GASTO.map((c) => (
                <td key={c.id} className="num px-3 py-2 text-right">
                  {formatoMXN(t.totales.porConcepto[c.id] ?? 0)}
                </td>
              ))}
              <td className="num px-3 py-2 text-right">{formatoMXN(t.totales.noAsignado)}</td>
              <td className="num px-3 py-2 text-right">{formatoMXN(t.totales.utilidadDirecta)}</td>
              <td className="num px-3 py-2 text-right">{formatoMXN(t.totales.utilidadReal)}</td>
              <td className="num px-3 py-2 text-right">{formatoMXN(t.totales.utilidadRealHa)}</td>
              <td className="px-3 py-2 text-right">—</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="mb-1 text-2xl font-semibold">Comparar dos</h2>
        <p className="mb-4 text-sm text-muted-foreground">Elige dos filas de la tabla para ver su variación de utilidad real.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Primero</Label>
            <Select value={a} onValueChange={setA}>
              <SelectTrigger aria-label="Comparar primero">
                <SelectValue placeholder="Elige" />
              </SelectTrigger>
              <SelectContent>
                {filas.map((f) => (
                  <SelectItem key={f.clave} value={f.clave}>
                    {nombreF(f)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Después</Label>
            <Select value={b} onValueChange={setB}>
              <SelectTrigger aria-label="Comparar después">
                <SelectValue placeholder="Elige" />
              </SelectTrigger>
              <SelectContent>
                {filas.map((f) => (
                  <SelectItem key={f.clave} value={f.clave}>
                    {nombreF(f)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {ia && ib ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Concepto</th>
                  <th className="px-3 py-2 text-right font-medium">{nombreF(ia)}</th>
                  <th className="px-3 py-2 text-right font-medium">{nombreF(ib)}</th>
                  <th className="px-3 py-2 text-right font-medium">Variación</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["ha", (f: FilaResultados) => f.ha, false],
                    ["Ingreso", (f: FilaResultados) => f.ingreso, true],
                    ["Insumos", (f: FilaResultados) => f.insumos, true],
                    ["Planta", (f: FilaResultados) => f.planta, true],
                    ["Gastos comunes", (f: FilaResultados) => f.gastosComunes, true],
                    ["No asignado", (f: FilaResultados) => f.noAsignado, true],
                    ["Utilidad directa", (f: FilaResultados) => f.utilidadDirecta, true],
                    ["Utilidad real", (f: FilaResultados) => f.utilidadReal, true],
                    ["Utilidad real / ha", (f: FilaResultados) => f.utilidadRealHa, true],
                  ] as [string, (f: FilaResultados) => number, boolean][]
                ).map(([etiqueta, toma, dinero]) => (
                  <tr key={etiqueta} className="border-t border-border/60">
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      {etiqueta}
                    </th>
                    <td className="num px-3 py-2 text-right">{dinero ? formatoMXN(toma(ia)) : formatoNum(toma(ia))}</td>
                    <td className="num px-3 py-2 text-right">{dinero ? formatoMXN(toma(ib)) : formatoNum(toma(ib))}</td>
                    <td className="num px-3 py-2 text-right">{variacion(toma(ia), toma(ib))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Elige las dos filas a comparar.</p>
        )}
      </section>
    </AppShell>
  );
}
