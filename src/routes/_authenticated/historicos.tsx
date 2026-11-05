import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { AppShell } from "@/components/campo/AppShell";
import { useNombreLote } from "@/components/campo/Cosecha";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  PLANTILLA_VIAJES_CSV,
  checklistCierre,
  cosechaVencida,
  cicloHistorico,
  formatoMXN,
  formatoNum,
  gastosComunesLote,
  leerViajesCsv,
  plantaHistorica,
  prorrateoRango,
  rendimientoLote,
  snapshotCiclo,
  totalesCiclos,
  variacionPct,
  type DatosHistorico,
} from "@/lib/campo/calc";
import { useCosecha } from "@/lib/campo/cosecha";
import { useCostos } from "@/lib/campo/costos";
import { useFase3 } from "@/lib/campo/fase3";
import { useFiltro } from "@/lib/campo/filtro";
import { useGastos } from "@/lib/campo/gastos";
import { useSesion } from "@/lib/campo/sesion";
import { useCampo } from "@/lib/campo/store";
import type { CicloCerrado, Lote, ViajeHistorico } from "@/lib/campo/types";

export const Route = createFileRoute("/_authenticated/historicos")({
  head: () => ({
    meta: [
      { title: "Cierre de ciclo e históricos · Brócoli" },
      { name: "description", content: "Cierra lotes con su foto fija de resultados, consulta y compara ciclos y captura ciclos históricos." },
      { property: "og:title", content: "Cierre de ciclo e históricos · Brócoli" },
      { property: "og:description", content: "Históricos por rancho, tabla, ingeniero, mes y año con promedios ponderados por hectárea." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Historicos,
});

function Historicos() {
  return (
    <AppShell
      path="/historicos"
      eyebrow="Fase 5"
      title="Cierre de ciclo e históricos"
      description="Al cerrar, el lote guarda una foto fija de sus resultados que ya no cambia."
      filtros
    >
      <Tabs defaultValue="cerrar">
        <TabsList className="mb-6">
          <TabsTrigger value="cerrar">Por cerrar</TabsTrigger>
          <TabsTrigger value="historicos">Históricos</TabsTrigger>
        </TabsList>
        <TabsContent value="cerrar">
          <PorCerrar />
        </TabsContent>
        <TabsContent value="historicos">
          <Consulta />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// ───────────────────────────── Por cerrar ─────────────────────────────

function PorCerrar() {
  const { lotes, parametros, hoy, semanaActual, marcarCerrado } = useCampo();
  const { viajes, liquidaciones, ciclos, guardarCiclo } = useCosecha();
  const { extraordinarios, alertasDireccion } = useFase3();
  const { pasaLote } = useFiltro();
  const { costoLote, plantaLote } = useCostos();
  const { gastos, repartos } = useGastos();
  const { nombre } = useSesion();
  const nombreLote = useNombreLote();
  const [forzar, setForzar] = useState<Lote | null>(null);
  const [motivo, setMotivo] = useState("");

  // Gastos comunes prorrateados a cada lote desde que se planeó hasta su cierre.
  const prorrateo = useMemo(() => {
    const desde = lotes.length > 0 ? Math.min(semanaActual, ...lotes.map((l) => l.semanaPlaneada)) : semanaActual;
    return prorrateoRango({ desde, hasta: semanaActual, lotes, gastos, repartos });
  }, [lotes, semanaActual, gastos, repartos]);
  const gastosDelLote = (loteId: string) => gastosComunesLote(loteId, prorrateo);

  const ls = lotes.filter((l) => pasaLote(l) && !l.cancelado && !l.cerrado && l.avances.length > 0 && l.cosechaTerminada);
  const vencidos = lotes.filter((l) => pasaLote(l) && cosechaVencida(l, viajes, hoy));
  const avisoVencidos = vencidos.length > 0 && (
    <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <p className="font-medium text-destructive">Llevan 2 semanas o más cosechando: marca "Cosecha terminada" en Cosecha para cerrarlos.</p>
      <p className="text-muted-foreground">{vencidos.map((l) => nombreLote(l)).join(" · ")}</p>
    </div>
  );

  const cerrar = (l: Lote, conPendientes: boolean, mot?: string) => {
    const r = rendimientoLote(l, viajes, parametros, costoLote(l.id));
    const previo = ciclos.find((c) => c.id === l.id);
    guardarCiclo({
      ...snapshotCiclo(l, r, { planta: plantaLote(l.id), fin: l.cosechaTerminada ?? hoy, gastosComunes: gastosDelLote(l.id).total }),
      conPendientes,
      bitacora: [
        ...(previo?.bitacora ?? []),
        { fecha: hoy, por: nombre, accion: conPendientes ? "cerrado_con_pendientes" : "cerrado", motivo: mot },
      ],
    });
    marcarCerrado(l.id, true);
    toast.success(conPendientes ? "Lote cerrado con pendientes." : "Lote cerrado.");
  };

  if (ls.length === 0)
    return (
      <>
        {avisoVencidos}
        <p className="text-sm text-muted-foreground">No hay lotes con la cosecha terminada pendientes de cerrar.</p>
      </>
    );

  return (
    <>
    {avisoVencidos}
    <div className="grid gap-4 md:grid-cols-2">
      {ls.map((l) => {
        const lista = checklistCierre(l, { viajes, liquidaciones, extraordinarios, alertasDireccion, hoy });
        const listo = lista.every((p) => p.ok);
        return (
          <Card key={l.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span>{nombreLote(l)}</span>
                {listo ? <Badge>Listo para cerrar</Badge> : <Badge variant="outline">Con pendientes</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-1 text-sm">
                {lista.map((p) => (
                  <li key={p.clave} className="flex gap-2">
                    <span className={p.ok ? "text-primary" : "text-destructive"}>{p.ok ? "●" : "○"}</span>
                    <span>
                      {p.texto}
                      {p.detalle && <span className="text-muted-foreground"> · {p.detalle}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={!listo} onClick={() => cerrar(l, false)}>
                  Cerrar ciclo
                </Button>
                {!listo && (
                  <Button size="sm" variant="outline" onClick={() => { setForzar(l); setMotivo(""); }}>
                    Forzar cierre
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
      <Dialog open={!!forzar} onOpenChange={(o) => !o && setForzar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar con pendientes</DialogTitle>
          </DialogHeader>
          <Label>Motivo</Label>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <DialogFooter>
            <Button
              disabled={!motivo.trim()}
              onClick={() => {
                if (forzar) cerrar(forzar, true, motivo.trim());
                setForzar(null);
              }}
            >
              Cerrar con pendientes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}

// ───────────────────────────── Históricos ─────────────────────────────

type Grupo = "ciclo" | "rancho" | "tabla" | "ingeniero" | "mes" | "anio";

function Consulta() {
  const { tablas, ranchos, hoy, marcarCerrado } = useCampo();
  const { ciclos, guardarCiclo } = useCosecha();
  const { pasaRancho, pasaCultivo } = useFiltro();
  const { nombre } = useSesion();
  const [base, setBase] = useState<"plantacion" | "fin">("fin");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tablaId, setTablaId] = useState("todas");
  const [ingeniero, setIngeniero] = useState("todos");
  const [tipo, setTipo] = useState<"todos" | "sistema" | "historico">("todos");
  const [grupo, setGrupo] = useState<Grupo>("ciclo");
  const [sel, setSel] = useState<string[]>([]);
  const [captura, setCaptura] = useState(false);
  const [reabrir, setReabrir] = useState<CicloCerrado | null>(null);
  const [motivo, setMotivo] = useState("");

  const nTabla = (id: string) => tablas.find((t) => t.id === id)?.nombre ?? "?";
  const nRancho = (id: string) => ranchos.find((r) => r.id === id)?.nombre ?? "?";
  const fecha = (c: CicloCerrado) => (base === "fin" ? c.fechaFinCosecha : c.fechaPlantacion);

  const cs = ciclos
    .filter((c) => !c.reabierto)
    .filter((c) => pasaRancho(c.ranchoId) && pasaCultivo(c.cultivo as never))
    .filter((c) => (!desde || fecha(c) >= desde) && (!hasta || fecha(c) <= hasta))
    .filter((c) => tablaId === "todas" || c.tablaId === tablaId)
    .filter((c) => ingeniero === "todos" || c.ingeniero === ingeniero)
    .filter((c) => tipo === "todos" || c.tipo === tipo)
    .sort((a, b) => fecha(b).localeCompare(fecha(a)));
  const total = totalesCiclos(cs);
  const ingenieros = [...new Set(ciclos.map((c) => c.ingeniero).filter(Boolean))].sort();

  const atajo = (t: "semana" | "mes" | "anio") => {
    const d = new Date(`${hoy}T12:00:00`);
    if (t === "semana") d.setDate(d.getDate() - 7);
    if (t === "mes") d.setMonth(d.getMonth() - 1);
    if (t === "anio") d.setFullYear(d.getFullYear() - 1);
    setDesde(d.toISOString().slice(0, 10));
    setHasta(hoy);
  };

  const filas = useMemo(() => {
    if (grupo === "ciclo")
      return cs.map((c) => ({ key: c.id, nombre: `${nRancho(c.ranchoId)} · ${nTabla(c.tablaId)} · ${c.codigo}`, cs: [c] }));
    const llave = (c: CicloCerrado) => {
      const f = fecha(c);
      if (grupo === "rancho") return nRancho(c.ranchoId);
      if (grupo === "tabla") return `${nRancho(c.ranchoId)} · ${nTabla(c.tablaId)}`;
      if (grupo === "ingeniero") return c.ingeniero || "Sin ingeniero";
      if (grupo === "mes") return `${f.slice(0, 4)} ${MESES[Number(f.slice(5, 7)) - 1]}`;
      return f.slice(0, 4);
    };
    const m = new Map<string, CicloCerrado[]>();
    for (const c of cs) m.set(llave(c), [...(m.get(llave(c)) ?? []), c]);
    return [...m.entries()].map(([k, xs]) => ({ key: k, nombre: k, cs: xs }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cs, grupo, base]);

  const comparar = sel.map((id) => ciclos.find((c) => c.id === id)).filter((c): c is CicloCerrado => !!c);
  const tablaGrafica = tablaId !== "todas" ? tablaId : comparar[0]?.tablaId;
  const grafica = ciclos
    .filter((c) => !c.reabierto && c.tablaId === tablaGrafica)
    .sort((a, b) => a.fechaFinCosecha.localeCompare(b.fechaFinCosecha))
    .map((c) => ({ ciclo: c.fechaFinCosecha.slice(0, 7), kgHa: c.pagablesHa, meta: c.meta }));

  const encabezado = ["Grupo", "Ciclos", "Ha", "Kg brutos", "Kg pagables", "Kg pag./ha", "% meta", "Ingreso", "Gastos", "Utilidad", "Utilidad/ha"];
  const datosExport = () =>
    filas.map((f) => {
      const t = totalesCiclos(f.cs);
      return [f.nombre, t.ciclos, t.ha, t.kgBrutos, t.kgPagables, t.pagablesHa, t.pctMeta, t.ingreso, t.gastos, t.utilidad, t.utilidadHa].map(String);
    });
  const excel = () => {
    const filasCsv = [encabezado, ...datosExport()].map((r) => r.map((x) => `"${x.replace(/"/g, '""')}"`).join(","));
    descargar(new Blob(["\uFEFF" + filasCsv.join("\n")], { type: "text/csv" }), `historicos-${hoy}.csv`);
  };
  const pdf = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Históricos de ciclos · Ultra Farms", 14, 14);
    doc.setFontSize(8);
    const xs = [14, 90, 105, 120, 145, 170, 190, 205, 230, 255, 275];
    let y = 24;
    const fila = (r: string[]) => {
      r.forEach((v, i) => doc.text(v.slice(0, i === 0 ? 40 : 14), xs[i] ?? 14, y));
      y += 6;
      if (y > 195) { doc.addPage(); y = 14; }
    };
    fila(encabezado);
    datosExport().forEach(fila);
    fila(["Total", String(total.ciclos), String(total.ha), String(total.kgBrutos), String(total.kgPagables), String(total.pagablesHa), String(total.pctMeta), String(total.ingreso), String(total.gastos), String(total.utilidad), String(total.utilidadHa)]);
    descargar(doc.output("blob"), `historicos-${hoy}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>Fecha por</Label>
          <Select value={base} onValueChange={(v) => setBase(v as typeof base)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fin">Fin de cosecha</SelectItem>
              <SelectItem value="plantacion">Plantación</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Desde</Label><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
        <div className="space-y-1"><Label>Hasta</Label><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => atajo("semana")}>Semana</Button>
          <Button size="sm" variant="outline" onClick={() => atajo("mes")}>Mes</Button>
          <Button size="sm" variant="outline" onClick={() => atajo("anio")}>Año</Button>
          <Button size="sm" variant="ghost" onClick={() => { setDesde(""); setHasta(""); }}>Todo</Button>
        </div>
        <div className="space-y-1">
          <Label>Tabla</Label>
          <Select value={tablaId} onValueChange={setTablaId}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {tablas.filter((t) => pasaRancho(t.ranchoId)).map((t) => (
                <SelectItem key={t.id} value={t.id}>{nRancho(t.ranchoId)} · {t.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Ingeniero</Label>
          <Select value={ingeniero} onValueChange={setIngeniero}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {ingenieros.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="sistema">Del sistema</SelectItem>
              <SelectItem value="historico">Históricos capturados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Agrupar por</Label>
          <Select value={grupo} onValueChange={(v) => setGrupo(v as Grupo)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ciclo">Ciclo</SelectItem>
              <SelectItem value="rancho">Rancho</SelectItem>
              <SelectItem value="tabla">Tabla</SelectItem>
              <SelectItem value="ingeniero">Ingeniero</SelectItem>
              <SelectItem value="mes">Mes</SelectItem>
              <SelectItem value="anio">Año</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setCaptura(true)}>Registrar ciclo histórico</Button>
        <Button variant="outline" onClick={excel} disabled={cs.length === 0}>Excel</Button>
        <Button variant="outline" onClick={() => void pdf()} disabled={cs.length === 0}>PDF</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Dato t="Hectáreas" v={formatoNum(total.ha)} />
        <Dato t="Kg pagables" v={formatoNum(total.kgPagables)} />
        <Dato t="Kg pagables / ha" v={formatoNum(total.pagablesHa)} />
        <Dato t="% de meta" v={`${total.pctMeta}%`} />
        <Dato t="Utilidad / ha" v={formatoMXN(total.utilidadHa)} />
      </div>
      <p className="text-xs text-muted-foreground">Los promedios por hectárea son ponderados: total de kg ÷ total de ha.</p>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              {grupo === "ciclo" && <th className="p-2" />}
              <th className="p-2">{grupo === "ciclo" ? "Ciclo" : "Grupo"}</th>
              <th className="p-2 text-right">Ha</th>
              <th className="p-2 text-right">Kg pag.</th>
              <th className="p-2 text-right">Kg pag./ha</th>
              <th className="p-2 text-right">% meta</th>
              <th className="p-2 text-right">Ingreso</th>
              <th className="p-2 text-right">Gastos</th>
              <th className="p-2 text-right">Utilidad</th>
              {grupo === "ciclo" && <th className="p-2" />}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const t = totalesCiclos(f.cs);
              const c = f.cs[0]!;
              return (
                <tr key={f.key} className="border-t">
                  {grupo === "ciclo" && (
                    <td className="p-2">
                      <Checkbox
                        checked={sel.includes(c.id)}
                        disabled={!sel.includes(c.id) && sel.length >= 4}
                        onCheckedChange={(v) => setSel((s) => (v ? [...s, c.id] : s.filter((x) => x !== c.id)))}
                        aria-label="Comparar"
                      />
                    </td>
                  )}
                  <td className="p-2">
                    {f.nombre}
                    {grupo === "ciclo" && (
                      <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                        {c.fechaPlantacion} → {c.fechaFinCosecha}
                        {c.tipo === "historico" && <Badge variant="secondary">Histórico</Badge>}
                        {c.conPendientes && <Badge variant="outline">Cerrado con pendientes</Badge>}
                      </div>
                    )}
                  </td>
                  <td className="p-2 text-right">{formatoNum(t.ha)}</td>
                  <td className="p-2 text-right">{formatoNum(t.kgPagables)}</td>
                  <td className="p-2 text-right">{formatoNum(t.pagablesHa)}</td>
                  <td className="p-2 text-right">{t.pctMeta}%</td>
                  <td className="p-2 text-right">{formatoMXN(t.ingreso)}</td>
                  <td className="p-2 text-right">{formatoMXN(t.gastos)}</td>
                  <td className="p-2 text-right">{formatoMXN(t.utilidad)}</td>
                  {grupo === "ciclo" && (
                    <td className="p-2">
                      {c.tipo === "sistema" && (
                        <Button size="sm" variant="ghost" onClick={() => { setReabrir(c); setMotivo(""); }}>Reabrir</Button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {filas.length === 0 && (
              <tr><td className="p-4 text-muted-foreground" colSpan={10}>No hay ciclos cerrados con estos filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {comparar.length >= 2 && <Comparacion cs={comparar} nombre={(c) => `${nTabla(c.tablaId)} ${c.codigo} · ${c.fechaFinCosecha.slice(0, 7)}`} />}
      {grupo === "ciclo" && comparar.length < 2 && <p className="text-xs text-muted-foreground">Marca de 2 a 4 ciclos para compararlos lado a lado.</p>}

      {tablaGrafica && grafica.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Ciclos de {nTabla(tablaGrafica)} contra la meta (kg pagables/ha)</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer>
              <LineChart data={grafica}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="ciclo" />
                <YAxis />
                <Tooltip />
                <ReferenceLine y={grafica[grafica.length - 1]!.meta} stroke="var(--color-destructive)" strokeDasharray="4 4" />
                <Line dataKey="kgHa" stroke="var(--color-primary)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <CapturaHistorica abierto={captura} cerrar={() => setCaptura(false)} />

      <Dialog open={!!reabrir} onOpenChange={(o) => !o && setReabrir(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reabrir ciclo</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">El lote vuelve a admitir cambios y sale de los históricos hasta cerrarse otra vez.</p>
          <Label>Motivo</Label>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          {reabrir && reabrir.bitacora.length > 0 && (
            <ul className="text-xs text-muted-foreground">
              {reabrir.bitacora.map((b, i) => (
                <li key={i}>{b.fecha} · {b.por} · {b.accion.replace(/_/g, " ")}{b.motivo ? ` · ${b.motivo}` : ""}</li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button
              disabled={!motivo.trim()}
              onClick={() => {
                if (!reabrir) return;
                guardarCiclo({ ...reabrir, reabierto: true, bitacora: [...reabrir.bitacora, { fecha: hoy, por: nombre, accion: "reabierto", motivo: motivo.trim() }] });
                if (reabrir.loteId) marcarCerrado(reabrir.loteId, false);
                setSel((s) => s.filter((x) => x !== reabrir.id));
                setReabrir(null);
                toast.success("Ciclo reabierto.");
              }}
            >
              Reabrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Dato({ t, v }: { t: string; v: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{t}</div>
      <div className="font-mono text-lg">{v}</div>
    </div>
  );
}

function Comparacion({ cs, nombre }: { cs: CicloCerrado[]; nombre: (c: CicloCerrado) => string }) {
  const filas: { t: string; f: (c: CicloCerrado) => number; dinero?: boolean }[] = [
    { t: "Hectáreas", f: (c) => c.ha },
    { t: "Kg pagables", f: (c) => c.kgPagables },
    { t: "Kg pagables / ha", f: (c) => c.pagablesHa },
    { t: "% de meta", f: (c) => c.pctMeta },
    { t: "Merma %", f: (c) => c.merma },
    { t: "Ingreso", f: (c) => c.ingreso, dinero: true },
    { t: "Insumos", f: (c) => c.insumos, dinero: true },
    { t: "Planta", f: (c) => c.planta, dinero: true },
    { t: "Utilidad", f: (c) => c.utilidadReal, dinero: true },
    { t: "Utilidad / ha", f: (c) => c.utilidadHa, dinero: true },
  ];
  const base = cs[0]!;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Comparación (variación contra el primero)</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr><th className="p-2 text-left" />{cs.map((c) => <th key={c.id} className="p-2 text-right">{nombre(c)}</th>)}</tr>
          </thead>
          <tbody>
            {filas.map((r) => (
              <tr key={r.t} className="border-t">
                <td className="p-2">{r.t}</td>
                {cs.map((c, i) => {
                  const v = variacionPct(r.f(base), r.f(c));
                  return (
                    <td key={c.id} className="p-2 text-right">
                      {r.dinero ? formatoMXN(r.f(c)) : formatoNum(r.f(c))}
                      {i > 0 && v !== null && (
                        <span className={`ml-1 text-xs ${v >= 0 ? "text-primary" : "text-destructive"}`}>{v >= 0 ? "+" : ""}{v}%</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ───────────────────────────── Captura histórica ─────────────────────────────

const viajeVacio = (): ViajeHistorico => ({ fecha: "", folio: "", kgBrutos: 0, kgPagables: 0 });

function CapturaHistorica({ abierto, cerrar }: { abierto: boolean; cerrar: () => void }) {
  const { ranchos, tablas, variedades, lotes, parametros, hoy } = useCampo();
  const { ciclos, guardarCiclo } = useCosecha();
  const { nombre } = useSesion();
  const [d, setD] = useState({ ranchoId: "", tablaId: "", variedadId: "", ingeniero: "", ha: "", plantas: "", fechaPlantacion: "", fechaFinCosecha: "", insumos: "", planta: "" });
  const [viajes, setViajes] = useState<ViajeHistorico[]>([viajeVacio()]);
  const [error, setError] = useState("");
  const set = (k: keyof typeof d, v: string) => setD((x) => ({ ...x, [k]: v }));
  const variedad = variedades.find((v) => v.id === d.variedadId);
  const sugerida = d.ha && d.fechaPlantacion ? plantaHistorica(parametros, Number(d.ha), d.fechaPlantacion, d.variedadId || undefined) : 0;
  const ponViaje = (i: number, p: Partial<ViajeHistorico>) => setViajes((vs) => vs.map((v, j) => (j === i ? { ...v, ...p } : v)));

  const importar = async (f: File | undefined) => {
    if (!f) return;
    const r = leerViajesCsv(await f.text());
    if ("error" in r) return setError(r.error);
    setError("");
    setViajes(r.viajes);
    toast.success(`${r.viajes.length} viajes importados.`);
  };

  const guardar = () => {
    const datos: DatosHistorico = {
      ranchoId: d.ranchoId,
      tablaId: d.tablaId,
      cultivo: variedad?.cultivo ?? "brocoli",
      ingeniero: d.ingeniero,
      ha: Number(d.ha),
      plantas: Number(d.plantas) || 0,
      fechaPlantacion: d.fechaPlantacion,
      fechaFinCosecha: d.fechaFinCosecha,
      insumos: Number(d.insumos) || 0,
      viajes: viajes.filter((v) => v.fecha || v.kgBrutos),
      ...(d.variedadId ? { variedadId: d.variedadId } : {}),
      ...(d.planta ? { planta: Number(d.planta) } : {}),
    };
    const r = cicloHistorico(datos, { parametros, ciclos, lotes, id: `hist-${Date.now()}` });
    if ("error" in r) return setError(r.error);
    guardarCiclo({ ...r.ciclo, bitacora: [{ fecha: hoy, por: nombre, accion: "capturado" }] });
    toast.success("Ciclo histórico registrado.");
    setViajes([viajeVacio()]);
    setError("");
    cerrar();
  };

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && cerrar()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Registrar ciclo histórico</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">No genera pedidos ni choca con la planeación actual. Usa los parámetros vigentes en cada fecha.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Rancho</Label>
            <Select value={d.ranchoId} onValueChange={(v) => setD((x) => ({ ...x, ranchoId: v, tablaId: "" }))}>
              <SelectTrigger><SelectValue placeholder="Elige" /></SelectTrigger>
              <SelectContent>{ranchos.map((r) => <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Tabla</Label>
            <Select value={d.tablaId} onValueChange={(v) => { set("tablaId", v); const t = tablas.find((x) => x.id === v); if (t && !d.ha) set("ha", String(t.hectareas)); }}>
              <SelectTrigger><SelectValue placeholder="Elige" /></SelectTrigger>
              <SelectContent>{tablas.filter((t) => t.ranchoId === d.ranchoId).map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Variedad</Label>
            <Select value={d.variedadId} onValueChange={(v) => set("variedadId", v)}>
              <SelectTrigger><SelectValue placeholder="Elige" /></SelectTrigger>
              <SelectContent>{variedades.map((v) => <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Ingeniero</Label><Input value={d.ingeniero} onChange={(e) => set("ingeniero", e.target.value)} /></div>
          <div className="space-y-1"><Label>Hectáreas</Label><Input type="number" value={d.ha} onChange={(e) => set("ha", e.target.value)} /></div>
          <div className="space-y-1"><Label>Plantas</Label><Input type="number" value={d.plantas} onChange={(e) => set("plantas", e.target.value)} /></div>
          <div className="space-y-1"><Label>Fecha de plantación</Label><Input type="date" value={d.fechaPlantacion} onChange={(e) => set("fechaPlantacion", e.target.value)} /></div>
          <div className="space-y-1"><Label>Fin de cosecha</Label><Input type="date" value={d.fechaFinCosecha} onChange={(e) => set("fechaFinCosecha", e.target.value)} /></div>
          <div className="space-y-1"><Label>Insumos (total MXN)</Label><Input type="number" value={d.insumos} onChange={(e) => set("insumos", e.target.value)} /></div>
          <div className="space-y-1">
            <Label>Costo de planta (MXN)</Label>
            <Input type="number" value={d.planta} placeholder={sugerida ? `Calculado: ${sugerida}` : ""} onChange={(e) => set("planta", e.target.value)} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium">Viajes</h3>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => descargar(new Blob([PLANTILLA_VIAJES_CSV], { type: "text/csv" }), "plantilla-viajes.csv")}>Plantilla</Button>
            <Label className="inline-flex cursor-pointer items-center rounded-md border px-3 text-sm">
              Importar Excel/CSV
              <input type="file" accept=".csv,.txt" className="hidden" onChange={(e) => void importar(e.target.files?.[0])} />
            </Label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left"><th>Fecha</th><th>Folio</th><th>Chofer</th><th>Kg brutos</th><th>Kg pagables</th><th>Calidad</th><th /></tr></thead>
            <tbody>
              {viajes.map((v, i) => (
                <tr key={i}>
                  <td><Input type="date" value={v.fecha} onChange={(e) => ponViaje(i, { fecha: e.target.value })} /></td>
                  <td><Input value={v.folio} onChange={(e) => ponViaje(i, { folio: e.target.value })} /></td>
                  <td><Input value={v.chofer ?? ""} onChange={(e) => ponViaje(i, { chofer: e.target.value || undefined })} /></td>
                  <td><Input type="number" value={v.kgBrutos || ""} onChange={(e) => ponViaje(i, { kgBrutos: Number(e.target.value) })} /></td>
                  <td><Input type="number" value={v.kgPagables || ""} onChange={(e) => ponViaje(i, { kgPagables: Number(e.target.value) })} /></td>
                  <td><Input type="number" min={1} max={10} value={v.calidad ?? ""} onChange={(e) => ponViaje(i, { calidad: e.target.value ? Number(e.target.value) : undefined })} /></td>
                  <td><Button size="sm" variant="ghost" onClick={() => setViajes((vs) => vs.filter((_, j) => j !== i))}>Quitar</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button size="sm" variant="outline" onClick={() => setViajes((vs) => [...vs, viajeVacio()])}>Agregar viaje</Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button onClick={guardar}>Guardar ciclo histórico</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
