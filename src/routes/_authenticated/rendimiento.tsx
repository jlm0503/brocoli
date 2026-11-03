import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/campo/AppShell";
import { useNombreLote } from "@/components/campo/Cosecha";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  curvaAcumulada,
  formatoMXN,
  formatoNum,
  parametroVigente,
  plantadasLote,
  rendimientoLote,
  reporteCalidad,
  semaforoMeta,
  sumarRendimientos,
  type RendimientoLote,
} from "@/lib/campo/calc";
import { useCosecha } from "@/lib/campo/cosecha";
import { useCostos } from "@/lib/campo/costos";
import { useFiltro } from "@/lib/campo/filtro";
import { useSesion } from "@/lib/campo/sesion";
import { useCampo } from "@/lib/campo/store";

export const Route = createFileRoute("/_authenticated/rendimiento")({
  head: () => ({
    meta: [
      { title: "Rendimiento y calidad · Brócoli" },
      { name: "description", content: "Kg pagables por hectárea, % de meta, retorno por lote y reporte de calidad de la congeladora." },
      { property: "og:title", content: "Rendimiento y calidad · Brócoli" },
      { property: "og:description", content: "Rendimiento por lote, tabla, rancho e ingeniero, y problemas de calidad." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Rendimiento,
});

type Grupo = "lote" | "tabla" | "rancho" | "ingeniero";

function Rendimiento() {
  return (
    <AppShell
      path="/rendimiento"
      eyebrow="Cosecha · resultados"
      title="Rendimiento y calidad"
      description="Solo cuentan los viajes evaluados. El gasto directo es receta + extraordinarios − devoluciones + planta real."
      filtros
    >
      <Tabs defaultValue="rendimiento">
        <TabsList className="mb-6">
          <TabsTrigger value="rendimiento">Rendimiento</TabsTrigger>
          <TabsTrigger value="calidad">Calidad</TabsTrigger>
        </TabsList>
        <TabsContent value="rendimiento">
          <Resultados />
        </TabsContent>
        <TabsContent value="calidad">
          <Calidad />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Resultados() {
  const { lotes, tablas, ranchos, parametros, hoy } = useCampo();
  const { roles } = useSesion();
  const { viajes } = useCosecha();
  const { pasaLote } = useFiltro();
  const { costoLote } = useCostos();
  const nombreLote = useNombreLote();
  const dinero = roles.includes("admin");
  const [grupo, setGrupo] = useState<Grupo>("lote");
  const [grafica, setGrafica] = useState<string>("");

  const conViajes = useMemo(() => new Set(viajes.flatMap((v) => (v.evaluacion?.reparto ?? []).map((r) => r.loteId))), [viajes]);
  const ls = lotes.filter((l) => pasaLote(l) && !l.cancelado && conViajes.has(l.id));
  const rs = ls.map((l) => rendimientoLote(l, viajes, parametros, costoLote(l.id)));

  const filas = useMemo(() => {
    if (grupo === "lote") return rs.map((r) => ({ key: r.loteId, nombre: nombreLote(lotes.find((l) => l.id === r.loteId)), r, ids: [r.loteId] }));
    const llave = (id: string) => {
      const l = lotes.find((x) => x.id === id)!;
      return grupo === "tabla" ? l.tablaId : grupo === "rancho" ? l.ranchoId : l.ingeniero || "Sin ingeniero";
    };
    const nombre = (k: string) =>
      grupo === "tabla" ? (tablas.find((t) => t.id === k)?.nombre ?? k) : grupo === "rancho" ? (ranchos.find((r) => r.id === k)?.nombre ?? k) : k;
    const m = new Map<string, RendimientoLote[]>();
    for (const r of rs) m.set(llave(r.loteId), [...(m.get(llave(r.loteId)) ?? []), r]);
    return [...m.entries()].map(([k, xs]) => ({ key: k, nombre: nombre(k), r: { loteId: k, ...sumarRendimientos(xs) }, ids: xs.map((x) => x.loteId) }));
  }, [grupo, rs, lotes, tablas, ranchos, nombreLote]);

  const ordenadas = [...filas].sort((a, b) => b.r.pagablesHa - a.r.pagablesHa);
  const ranking = grupo === "ingeniero" ? ordenadas : null;
  const sel = filas.find((f) => f.key === grafica) ?? filas[0];
  const curva = sel ? curvaAcumulada(sel.ids, viajes, sel.r.ha) : [];
  const meta = sel?.r.meta || parametroVigente(parametros, "metaKgHa", hoy);
  const total = sumarRendimientos(rs);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label>Ver por</Label>
          <Select value={grupo} onValueChange={(v) => setGrupo(v as Grupo)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lote">Lote</SelectItem>
              <SelectItem value="tabla">Tabla</SelectItem>
              <SelectItem value="rancho">Rancho</SelectItem>
              <SelectItem value="ingeniero">Ingeniero (ranking)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="num text-sm text-muted-foreground">
          Total: {formatoNum(total.ha)} ha · {formatoNum(total.pagablesHa)} kg pag./ha · {total.pctMeta}% de meta
          {dinero && ` · utilidad ${formatoMXN(total.utilidad)}`}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left">
            <tr>
              {ranking && <th className="px-3 py-2 font-medium">#</th>}
              <th className="px-3 py-2 font-medium">{grupo === "lote" ? "Lote" : grupo[0]!.toUpperCase() + grupo.slice(1)}</th>
              <th className="px-3 py-2 text-right font-medium">Ha</th>
              <th className="px-3 py-2 text-right font-medium">Kg brutos</th>
              <th className="px-3 py-2 text-right font-medium">Brutos/ha</th>
              <th className="px-3 py-2 text-right font-medium">Kg pagables</th>
              <th className="px-3 py-2 text-right font-medium">Pagables/ha</th>
              <th className="px-3 py-2 text-right font-medium">% meta</th>
              <th className="px-3 py-2 text-right font-medium">Merma</th>
              <th className="px-3 py-2 text-right font-medium">Calidad</th>
              {dinero && (
                <>
                  <th className="px-3 py-2 text-right font-medium">Ingreso</th>
                  <th className="px-3 py-2 text-right font-medium">Gasto directo</th>
                  <th className="px-3 py-2 text-right font-medium">Utilidad</th>
                  <th className="px-3 py-2 text-right font-medium">Retorno</th>
                  <th className="px-3 py-2 text-right font-medium">Utilidad/ha</th>
                  <th className="px-3 py-2 text-right font-medium">Equilibrio kg/ha</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {(ranking ?? filas).map((f, i) => (
              <tr key={f.key} className="border-t border-border/60">
                {ranking && <td className="num px-3 py-2">{i + 1}</td>}
                <td className="px-3 py-2">{f.nombre}</td>
                <td className="num px-3 py-2 text-right">{formatoNum(f.r.ha)}</td>
                <td className="num px-3 py-2 text-right">{formatoNum(f.r.kgBrutos)}</td>
                <td className="num px-3 py-2 text-right">{formatoNum(f.r.brutosHa)}</td>
                <td className="num px-3 py-2 text-right">{formatoNum(f.r.kgPagables)}</td>
                <td className="num px-3 py-2 text-right font-medium">{formatoNum(f.r.pagablesHa)}</td>
                <td className="px-3 py-2 text-right">
                  <Badge variant={semaforoMeta(f.r.pctMeta)}>
                    <span className="num">{f.r.pctMeta}%</span>
                  </Badge>
                </td>
                <td className="num px-3 py-2 text-right">{f.r.merma}%</td>
                <td className="num px-3 py-2 text-right">{f.r.calidad ?? "—"}</td>
                {dinero && (
                  <>
                    <td className="num px-3 py-2 text-right">{formatoMXN(f.r.ingreso)}</td>
                    <td className="num px-3 py-2 text-right">{formatoMXN(f.r.gasto)}</td>
                    <td className={`num px-3 py-2 text-right ${f.r.utilidad < 0 ? "text-destructive" : ""}`}>{formatoMXN(f.r.utilidad)}</td>
                    <td className="num px-3 py-2 text-right">{f.r.retorno === null ? "—" : `${f.r.retorno}x`}</td>
                    <td className="num px-3 py-2 text-right">{formatoMXN(f.r.utilidadHa)}</td>
                    <td className="num px-3 py-2 text-right">{formatoNum(f.r.equilibrioKgHa)}</td>
                  </>
                )}
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={dinero ? 16 : 10} className="px-4 py-6 text-center text-muted-foreground">
                  Todavía no hay viajes evaluados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {sel && (
        <section className="mt-8 rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">Kg pagables/ha acumulados contra la meta</h2>
            <Select value={sel.key} onValueChange={setGrafica}>
              <SelectTrigger className="w-72" aria-label="Elegir para la gráfica">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filas.map((f) => (
                  <SelectItem key={f.key} value={f.key}>
                    {f.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curva}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="semana" tickFormatter={(w) => `S${w}`} stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" domain={[0, (max: number) => Math.max(max, meta) * 1.1]} />
                <Tooltip formatter={(v: number) => `${formatoNum(v)} kg/ha`} labelFormatter={(w) => `Semana ${w}`} />
                <ReferenceLine y={meta} stroke="var(--destructive)" strokeDasharray="6 4" label={{ value: `Meta ${formatoNum(meta)}`, position: "insideTopLeft" }} />
                <Line type="monotone" dataKey="kgHa" name="Kg pagables/ha" stroke="var(--primary)" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </>
  );
}

function Calidad() {
  const { lotes, tablas, problemas } = useCampo();
  const { viajes } = useCosecha();
  const { pasaLote } = useFiltro();
  const nombreLote = useNombreLote();
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tablaId, setTablaId] = useState("todas");
  const [loteId, setLoteId] = useState("todos");
  const [ingeniero, setIngeniero] = useState("todos");

  const visibles = lotes.filter((l) => pasaLote(l) && plantadasLote(l) > 0);
  const ingenieros = [...new Set(visibles.map((l) => l.ingeniero).filter(Boolean))].sort();
  const rep = reporteCalidad(viajes, lotes, (r, v) => {
    const l = lotes.find((x) => x.id === r.loteId);
    return (
      pasaLote(l) &&
      (!desde || v.fecha >= desde) &&
      (!hasta || v.fecha <= hasta) &&
      (tablaId === "todas" || r.tablaId === tablaId) &&
      (loteId === "todos" || r.loteId === loteId) &&
      (ingeniero === "todos" || l?.ingeniero === ingeniero)
    );
  });
  const nombreProblema = (id: string) => problemas.find((p) => p.id === id)?.nombre ?? id;
  const tablasVis = tablas.filter((t) => visibles.some((l) => l.tablaId === t.id));

  return (
    <>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-2">
          <Label htmlFor="cq-d">Desde</Label>
          <Input id="cq-d" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cq-h">Hasta</Label>
          <Input id="cq-h" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <Filtro label="Tabla" value={tablaId} set={setTablaId} todos="todas" opciones={tablasVis.map((t) => [t.id, t.nombre])} />
        <Filtro label="Lote" value={loteId} set={setLoteId} todos="todos" opciones={visibles.map((l) => [l.id, nombreLote(l)])} />
        <Filtro label="Ingeniero" value={ingeniero} set={setIngeniero} todos="todos" opciones={ingenieros.map((i) => [i, i])} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Tabla
          titulo="Problemas más frecuentes"
          cols={["Problema", "Veces", "Kg castigados"]}
          filas={rep.problemas.map((p) => [nombreProblema(p.problemaId), String(p.veces), formatoNum(p.kg)])}
        />
        <Tabla
          titulo="Evolución semanal de la merma"
          cols={["Semana", "Kg brutos", "Merma"]}
          filas={rep.semanal.map((s) => [`Semana ${s.semana}`, formatoNum(s.kgBrutos), `${s.merma}%`])}
        />
        <Tabla
          titulo="Merma por tabla"
          cols={["Tabla", "Kg brutos", "Merma"]}
          filas={rep.porTabla.map((t) => [tablas.find((x) => x.id === t.tablaId)?.nombre ?? t.tablaId, formatoNum(t.kgBrutos), `${t.merma}%`])}
        />
        <Tabla
          titulo="Merma por ingeniero"
          cols={["Ingeniero", "Kg brutos", "Merma"]}
          filas={rep.porIngeniero.map((t) => [t.ingeniero, formatoNum(t.kgBrutos), `${t.merma}%`])}
        />
      </div>
    </>
  );
}

function Filtro({
  label,
  value,
  set,
  todos,
  opciones,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  todos: string;
  opciones: [string, string][];
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={set}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={todos}>Todos</SelectItem>
          {opciones.map(([v, n]) => (
            <SelectItem key={v} value={v}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Tabla({ titulo, cols, filas }: { titulo: string; cols: string[]; filas: string[][] }) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-card">
      <h2 className="px-4 pt-4 text-lg font-semibold">{titulo}</h2>
      <table className="mt-2 w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr>
            {cols.map((c, i) => (
              <th key={c} className={`px-4 py-1 font-medium ${i > 0 ? "text-right" : ""}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f[0]} className="border-t border-border/60">
              {f.map((x, i) => (
                <td key={i} className={`px-4 py-1.5 ${i > 0 ? "num text-right" : ""}`}>
                  {x}
                </td>
              ))}
            </tr>
          ))}
          {filas.length === 0 && (
            <tr>
              <td colSpan={cols.length} className="px-4 py-4 text-center text-muted-foreground">
                Sin datos.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
