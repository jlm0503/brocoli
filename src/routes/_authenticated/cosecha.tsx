import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, FileText, ImageIcon, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, Stat } from "@/components/campo/AppShell";
import { EvaluarDialog, SalidaForm, useNombreLote } from "@/components/campo/Cosecha";
import { ViajesHistoricos } from "@/components/campo/ViajesHistoricos";
import { VerEvidencia } from "@/components/campo/Evidencia";
import { PdfSalida } from "@/components/campo/PdfSalida";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  cerradosBajoMeta,
  diasEntre,
  fechaCorta,
  fechaEnSemana,
  formatoMXN,
  formatoNum,
  haEnCosecha,
  loteEnCosecha,
  rendimientoLote,
  resumenSemanaPago,
  semaforoMeta,
  semanaPago,
  semanaRecetaLote,
  estimadoViaje,
} from "@/lib/campo/calc";
import { useCosecha, useViajesAtrasados } from "@/lib/campo/cosecha";
import { useFiltro } from "@/lib/campo/filtro";
import { useSesion } from "@/lib/campo/sesion";
import { useCampo } from "@/lib/campo/store";
import type { Lote, Viaje } from "@/lib/campo/types";

export const Route = createFileRoute("/_authenticated/cosecha")({
  head: () => ({
    meta: [
      { title: "Cosecha · Brócoli" },
      { name: "description", content: "Salidas de embarque, evaluación de la congeladora y panel de lotes en cosecha con su rendimiento." },
      { property: "og:title", content: "Cosecha · Brócoli" },
      { property: "og:description", content: "Viajes, kilos pagables por hectárea y avance contra la meta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Cosecha,
});

const SEMAFORO_LABEL = { verde: "≥ 100%", amarillo: "80–99%", rojo: "< 80%", gris: "—" } as const;

function Cosecha() {
  const { semanaActual } = useCampo();
  const { puedeViajes, puedeEvaluar, viajes } = useCosecha();
  const pendientes = viajes.filter((v) => v.status === "transito").length;
  return (
    <AppShell
      path="/cosecha"
      eyebrow={`Cosecha · semana ${semanaActual}`}
      title="Cosecha"
      filtros
    >
        <Tabs defaultValue="panel">
          <TabsList className="mb-6 h-auto flex-wrap">
            <TabsTrigger value="panel">Panel</TabsTrigger>
            <TabsTrigger value="historicos">Viajes e históricos</TabsTrigger>
            {puedeViajes && <TabsTrigger value="salidas">Salidas</TabsTrigger>}
            {puedeEvaluar && (
              <TabsTrigger value="evaluar">
                Evaluaciones pendientes{pendientes > 0 && <span className="num ml-1">({pendientes})</span>}
              </TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="panel">
            <Panel />
          </TabsContent>
          <TabsContent value="historicos"><ViajesHistoricos /></TabsContent>
          <TabsContent value="salidas">
            <SalidaForm />
            <ListaViajes soloTransito={false} />
          </TabsContent>
          <TabsContent value="evaluar">
            <ListaViajes soloTransito />
          </TabsContent>
        </Tabs>
    </AppShell>
  );
}

function Panel() {
  const { lotes, semanaActual, hoy, parametros } = useCampo();
  const { roles, user } = useSesion();
  const { viajes } = useCosecha();
  const { pasaLote } = useFiltro();
  const atrasados = useViajesAtrasados();
  const nombreLote = useNombreLote();
  const conImportes = roles.includes("admin");
  const [semana, setSemana] = useState(semanaActual);
  const [terminar, setTerminar] = useState<Lote | null>(null);
  const { terminarCosecha } = useCampo();
  const claveAvisos = user ? `campo-cosecha-avisos-${user.id}` : "";
  const [avisosOcultos, setAvisosOcultos] = useState<{ clave: string; ids: string[] }>({ clave: "", ids: [] });
  useEffect(() => {
    if (!claveAvisos) return;
    let ids: string[] = [];
    try {
      const guardados: unknown = JSON.parse(localStorage.getItem(claveAvisos) ?? "[]");
      if (Array.isArray(guardados)) ids = guardados.filter((id): id is string => typeof id === "string");
    } catch { /* Un almacenamiento dañado no oculta advertencias. */ }
    setAvisosOcultos({ clave: claveAvisos, ids });
  }, [claveAvisos]);
  const ocultos = avisosOcultos.clave === claveAvisos ? avisosOcultos.ids : [];
  const quitarAviso = (id: string) => {
    if (!claveAvisos) return;
    const ids = [...new Set([...ocultos, id])];
    setAvisosOcultos({ clave: claveAvisos, ids });
    try { localStorage.setItem(claveAvisos, JSON.stringify(ids)); } catch { /* Se conserva oculto durante esta sesión. */ }
  };

  const visibles = useMemo(() => lotes.filter((l) => pasaLote(l)), [lotes, pasaLote]);
  const idsVisibles = useMemo(() => new Set(visibles.map((l) => l.id)), [visibles]);
  const viajesVisibles = viajes.filter((v) => v.loteIds.some((id) => idsVisibles.has(id)));
  const jueves = semanaPago(semana === semanaActual ? hoy : fechaEnSemana(semana, 3));
  const pago = resumenSemanaPago(viajesVisibles, jueves);
  const enTransito = viajesVisibles.filter((v) => v.status === "transito").length;

  const enCosecha = visibles.filter(
    (l) =>
      !l.cancelado &&
      !l.finalizado &&
      (loteEnCosecha(l, semana) || viajes.some((v) => v.status === "evaluado" && v.loteIds.includes(l.id))),
  );
  const bajoMeta = cerradosBajoMeta(visibles, viajes, parametros);

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <Button size="icon" variant="outline" aria-label="Semana anterior" onClick={() => setSemana((s) => s - 1)}>
          <ChevronLeft />
        </Button>
        <span className="num min-w-28 text-center font-medium">Semana {semana}</span>
        <Button size="icon" variant="outline" aria-label="Semana siguiente" onClick={() => setSemana((s) => s + 1)}>
          <ChevronRight />
        </Button>
        {semana !== semanaActual && (
          <Button variant="ghost" onClick={() => setSemana(semanaActual)}>
            Volver a la actual
          </Button>
        )}
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Ha en cosecha" value={formatoNum(haEnCosecha(visibles, semana))} hint={`Semana ${semana}`} tone="primary" />
        <Stat label="Ha esperadas la próxima" value={formatoNum(haEnCosecha(visibles, semana + 1))} hint={`Semana ${semana + 1}`} />
        <Stat
          label="Viajes de la semana de pago"
          value={pago.viajes.length}
          hint={`${fechaCorta(pago.jueves)}–${fechaCorta(pago.fin)} · ${formatoNum(pago.kgBrutos)} kg brutos · ${formatoNum(pago.kgPagables)} pagables`}
        />
        {conImportes ? (
          <Stat label="Ingreso neto estimado" value={formatoMXN(pago.importeNeto)} hint={`${enTransito} viajes en tránsito sin evaluar`} tone="soil" />
        ) : (
          <Stat label="En tránsito" value={enTransito} hint="viajes sin evaluar" tone="soil" />
        )}
      </div>

      {(atrasados.length > 0 || bajoMeta.length > 0) && (
        <section className="mb-8 space-y-2">
          {atrasados
            .filter((v) => v.loteIds.some((id) => idsVisibles.has(id)) && !ocultos.includes(`viaje:${v.id}:${v.fecha}`))
            .map((v) => (
              <div key={v.id} className="flex items-start justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive-soft p-3 text-sm text-destructive">
                <p>El viaje <b>{v.folio}</b> salió el {fechaCorta(v.fecha)} y lleva {diasEntre(v.fecha, hoy)} días sin evaluación.</p>
                <Button size="icon" variant="ghost" className="size-7 shrink-0" aria-label={`Eliminar advertencia del viaje ${v.folio}`} title="Eliminar advertencia" onClick={() => quitarAviso(`viaje:${v.id}:${v.fecha}`)}><X /></Button>
              </div>
            ))}
          {bajoMeta.filter((r) => !ocultos.includes(`meta:${r.loteId}:${r.pagablesHa}:${r.meta}`)).map((r) => (
            <div key={r.loteId} className="flex items-start justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive-soft p-3 text-sm text-destructive">
              <p>{nombreLote(lotes.find((l) => l.id === r.loteId))} cerró con <b className="num">{formatoNum(r.pagablesHa)} kg/ha</b>, abajo de
              la meta de {formatoNum(r.meta)}.
              </p>
              <Button size="icon" variant="ghost" className="size-7 shrink-0" aria-label={`Eliminar advertencia de ${nombreLote(lotes.find((l) => l.id === r.loteId))}`} title="Eliminar advertencia" onClick={() => quitarAviso(`meta:${r.loteId}:${r.pagablesHa}:${r.meta}`)}><X /></Button>
            </div>
          ))}
        </section>
      )}

      <h2 className="mb-3 text-2xl font-semibold">Lotes en cosecha</h2>
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Lote</th>
              <th className="px-3 py-2 text-right font-medium">Ha</th>
              <th className="px-3 py-2 text-right font-medium">Sem. cultivo</th>
              <th className="px-3 py-2 text-right font-medium">Viajes</th>
              <th className="px-3 py-2 text-right font-medium">Kg brutos</th>
              <th className="px-3 py-2 text-right font-medium">Kg pagables</th>
              <th className="px-3 py-2 text-right font-medium">Kg pag./ha</th>
              <th className="px-3 py-2 text-right font-medium">% meta</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {enCosecha.map((l) => {
              const r = rendimientoLote(l, viajes, parametros, 0);
              const s = semaforoMeta(r.pctMeta);
              return (
                <tr key={l.id} className="border-t border-border/60">
                  <td className="px-3 py-2">{nombreLote(l)}</td>
                  <td className="num px-3 py-2 text-right">{formatoNum(r.ha)}</td>
                  <td className="num px-3 py-2 text-right">{semanaRecetaLote(l, semana) ?? "—"}</td>
                  <td className="num px-3 py-2 text-right">{r.viajes}</td>
                  <td className="num px-3 py-2 text-right">{formatoNum(r.kgBrutos)}</td>
                  <td className="num px-3 py-2 text-right">{formatoNum(r.kgPagables)}</td>
                  <td className="num px-3 py-2 text-right">{formatoNum(r.pagablesHa)}</td>
                  <td className="px-3 py-2 text-right">
                    <Badge variant={s} title={SEMAFORO_LABEL[s]}>
                      <span className="num">{r.pctMeta}%</span>
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {roles.includes("admin") && <Button size="sm" variant="outline" onClick={() => setTerminar(l)}>
                      Cosecha terminada
                    </Button>}
                  </td>
                </tr>
              );
            })}
            {enCosecha.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">
                  No hay lotes en cosecha en la semana {semana}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!terminar} onOpenChange={(o) => !o && setTerminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cosecha terminada en {terminar && nombreLote(terminar)}?</AlertDialogTitle>
            <AlertDialogDescription>
              El lote se cierra y la tabla queda libre para el siguiente ciclo. Ya no se le podrán cargar viajes (solo el Super Admin, con
              motivo). Sus costos y kilos se conservan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!terminar) return;
                const e = terminarCosecha(terminar.id);
                if (e) toast.error(e);
                else toast.success("Cosecha terminada.");
                setTerminar(null);
              }}
            >
              Sí, terminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ListaViajes({ soloTransito }: { soloTransito: boolean }) {
  const { lotes, choferes, hoy } = useCampo();
  const { roles } = useSesion();
  const { viajes, eliminarViaje, puedeEvaluar } = useCosecha();
  const { pasaLote } = useFiltro();
  const nombreLote = useNombreLote();
  const [buscar, setBuscar] = useState("");
  const [evaluando, setEvaluando] = useState<Viaje | null>(null);
  const [salidaPdf, setSalidaPdf] = useState<Viaje | null>(null);
  const conImportes = roles.includes("admin");

  const texto = (v: Viaje) =>
    [v.folio, v.fecha, fechaCorta(v.fecha), v.salida?.choferNombre ?? choferes.find((c) => c.id === v.choferId)?.nombre ?? "", v.salida?.placas ?? "", v.salida?.destino ?? "", ...v.loteIds.map((id) => nombreLote(lotes.find((l) => l.id === id)))]
      .join(" ")
      .toLowerCase();
  const lista = viajes
    .filter((v) => (!soloTransito || v.status === "transito") && v.loteIds.some((id) => pasaLote(lotes.find((l) => l.id === id))))
    .filter((v) => !buscar.trim() || texto(v).includes(buscar.trim().toLowerCase()))
    .sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-semibold">{soloTransito ? "Por evaluar" : "Viajes registrados"}</h2>
        <Input
          className="max-w-xs"
          placeholder="Buscar por folio, fecha, chofer o tabla"
          aria-label="Buscar viaje"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
      </div>
      {lista.length === 0 ? (
        <p className="text-sm text-muted-foreground">{soloTransito ? "No hay viajes en tránsito." : "Todavía no hay viajes."}</p>
      ) : (
        <ul className="space-y-2">
          {lista.map((v) => {
            const dias = diasEntre(v.fecha, hoy);
            return (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm">
                <div>
                  <div className="font-medium">
                    {v.folio} · {fechaCorta(v.fecha)} {v.hora} · {v.salida?.choferNombre ?? choferes.find((c) => c.id === v.choferId)?.nombre ?? "Chofer"}
                  </div>
                  <div className="text-xs text-muted-foreground">{v.loteIds.map((id) => nombreLote(lotes.find((l) => l.id === id))).join(" + ")}</div>
                  {v.salida && <div className="text-xs text-muted-foreground">{v.salida.placas} · {v.salida.destino} · {v.salida.cumpleRequisitos ? "Sí cumple" : "No cumple"}</div>}
                  {estimadoViaje(v).kg > 0 && (
                    <div className="num text-xs text-muted-foreground">
                      {v.kgSalida ? "Salida: " : `${estimadoViaje(v).bins} bins · el rancho dijo ≈ `}{formatoNum(estimadoViaje(v).kg)} kg
                      {v.evaluacion && ` · llegaron ${formatoNum(v.evaluacion.kgBrutos)} kg (${v.evaluacion.kgBrutos - estimadoViaje(v).kg >= 0 ? "+" : ""}${formatoNum(v.evaluacion.kgBrutos - estimadoViaje(v).kg)})`}
                    </div>
                  )}
                  {v.motivoCerrado && <div className="text-xs text-muted-foreground">Lote cerrado: {v.motivoCerrado}</div>}
                  {v.evaluacion && (
                    <div className="num text-xs text-muted-foreground">
                      {formatoNum(v.evaluacion.kgBrutos)} kg brutos · {formatoNum(v.evaluacion.kgPagables)} pagables · merma {v.evaluacion.merma}% ·
                      calif. {v.evaluacion.calificacion}
                      {conImportes && ` · neto ${formatoMXN(v.evaluacion.importeNeto)}`}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" aria-label={`PDF de salida ${v.folio}`} title="PDF de salida" onClick={() => setSalidaPdf(v)}><FileText /></Button>
                  {v.salida?.fotoCamion && <VerEvidencia foto={v.salida.fotoCamion} title="Ver foto del camión"><ImageIcon className="size-4" /></VerEvidencia>}
                  {v.status === "evaluado" ? (
                    <Badge variant="recibido">Evaluado</Badge>
                  ) : (
                    <Badge variant={dias > 3 ? "urgente" : "pendiente"}>En tránsito · sin evaluación</Badge>
                  )}
                  <VerEvidencia foto={v.foto} title="Ver foto de la hoja">
                    <ImageIcon className="size-4" />
                  </VerEvidencia>
                  {v.status === "transito" && puedeEvaluar && (
                    <Button size="sm" onClick={() => setEvaluando(v)}>
                      Evaluar
                    </Button>
                  )}
                  {v.status === "transito" && !soloTransito && conImportes && (
                    <Button size="icon" variant="ghost" aria-label="Eliminar viaje" onClick={() => eliminarViaje(v.id)}>
                      <Trash2 />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <EvaluarDialog viaje={evaluando} onClose={() => setEvaluando(null)} />
      <PdfSalida viaje={salidaPdf} onClose={() => setSalidaPdf(null)} />
    </section>
  );
}
