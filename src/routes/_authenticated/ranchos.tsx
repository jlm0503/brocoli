import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { AppShell, Stat } from "@/components/campo/AppShell";
import { CorregirFechasDialog } from "@/components/campo/CorregirFechasDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ESTATUS_TABLA_LABEL,
  cantidadRecibida,
  costoPlaneacionLote,
  esArrastrado,
  estatusLinea,
  estatusTabla,
  etapa,
  fechaCorta,
  fechaCosechaLote,
  fechaPlantacionLote,
  formatoMXN,
  formatoNum,
  hectareasActivas,
  insumosEntregados,
  lineasSemana,
  lotesDeTabla,
  pendientesLote,
  plantadasLote,
  semanaCosechaLote,
  semanaCultivoTabla,
  semanaRealLote,
  semanaRecetaLote,
} from "@/lib/campo/calc";
import { puedeCorregirFechas } from "@/lib/campo/roles";
import { VARIEDADES } from "@/lib/campo/seed";
import { useCampo } from "@/lib/campo/store";
import type { EstatusTabla, LineaDemanda, Lote, Tabla } from "@/lib/campo/types";

export const Route = createFileRoute("/_authenticated/ranchos")({
  head: () => ({
    meta: [
      { title: "Estatus de ranchos y costos · Brócoli" },
      {
        name: "description",
        content:
          "Cada tabla con sus lotes, semana de cultivo, hectáreas activas y costo acumulado en insumos.",
      },
      { property: "og:title", content: "Estatus de ranchos y costos · Brócoli" },
      {
        property: "og:description",
        content: "Inversión acumulada en insumos por rancho, tabla y lote.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Ranchos,
});


const TILE: Record<EstatusTabla, string> = {
  libre: "bg-status-libre text-status-libre-foreground",
  "parcial-planeada":
    "bg-status-planeada/60 text-status-planeada-foreground ring-1 ring-status-planeada-foreground/30",
  planeada: "bg-status-planeada text-status-planeada-foreground",
  "plantada-parcial":
    "bg-status-plantada/60 text-status-plantada-foreground ring-1 ring-status-plantada-foreground/30",
  plantada: "bg-status-plantada text-status-plantada-foreground",
  "en-cosecha": "bg-soil text-soil-foreground",
};

function useCostos() {
  const { lotes, recetas, adicionales, productos, recepciones, pedidos, semanaActual } = useCampo();
  return useMemo(() => {
    // Desde la primera plantación registrada hasta hoy.
    const desde = Math.min(semanaActual, ...lotes.flatMap((l) => l.avances.map((a) => a.semana)));
    const semanas = Array.from({ length: semanaActual - desde + 1 }, (_, i) => desde + i);
    const recibidas = lineasSemana(lotes, recetas, adicionales, semanas).filter(
      (l) => estatusLinea(l, recepciones, semanaActual) === "recibido",
    );
    const porLote = new Map<string, LineaDemanda[]>();
    for (const l of recibidas) porLote.set(l.loteId, [...(porLote.get(l.loteId) ?? []), l]);
    const costoLote = (loteId: string) => {
      const lote = lotes.find((x) => x.id === loteId);
      const semanal = costoLineas(porLote.get(loteId) ?? [], productos, recepciones);
      return semanal + (lote ? costoPlaneacionLote(lote, pedidos, productos) : 0);
    };
    const costoTabla = (tablaId: string) =>
      lotes.filter((l) => l.tablaId === tablaId).reduce((s, l) => s + costoLote(l.id), 0);
    return { porLote, costoLote, costoTabla };
  }, [lotes, recetas, adicionales, productos, recepciones, pedidos, semanaActual]);
}

function Ranchos() {
  const { ranchos, tablas, lotes, semanaActual } = useCampo();
  const [abierta, setAbierta] = useState<Tabla | null>(null);
  const { costoTabla } = useCostos();

  const total = tablas.reduce((s, t) => s + costoTabla(t.id), 0);
  const haActivas = tablas.reduce((s, t) => s + hectareasActivas(lotes, t.id, semanaActual), 0);
  const ocupadas = tablas.filter((t) => estatusTabla(t, lotes) !== "libre").length;

  return (
    <AppShell
      path="/ranchos"
      eyebrow={`Administrador · semana ${semanaActual}`}
      title="Estatus de ranchos y costos"
      description="Cada tabla con sus lotes, semana de cultivo y el dinero en insumos entregados a la fecha (planeación + semanal)."
    >
      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        <Stat label="Inversión acumulada" value={formatoMXN(total)} tone="primary" />
        <Stat label="Hectáreas activas" value={`${formatoNum(haActivas)} ha`} hint="Plantadas, de la siembra a la cosecha" />
        <Stat label="Tablas ocupadas" value={`${ocupadas}/${tablas.length}`} hint="Planeadas o plantadas" tone="soil" />
      </div>

      <div className="mb-6 flex flex-wrap gap-2 text-xs">
        {(Object.keys(ESTATUS_TABLA_LABEL) as EstatusTabla[]).map((e) => (
          <Badge key={e} variant={e}>
            {ESTATUS_TABLA_LABEL[e]}
          </Badge>
        ))}
      </div>

      {ranchos.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
          Aún no hay ranchos. Agrégalos con sus tablas en Catálogos y registra en Planeación lo que ya
          está plantado; aquí verás su estatus y costos.
        </div>
      )}
      <div className="space-y-10">
        {ranchos.map((r) => {
          const ts = tablas.filter((t) => t.ranchoId === r.id);
          const costo = ts.reduce((s, t) => s + costoTabla(t.id), 0);
          const ha = ts.reduce((s, t) => s + t.hectareas, 0);
          return (
            <section key={r.id}>
              <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="text-3xl font-semibold">{r.nombre}</h2>
                  <p className="text-sm text-muted-foreground">
                    {r.zona} · <span className="num">{formatoNum(ha)}</span> ha en {ts.length} tablas
                  </p>
                </div>
                <span className="num text-lg">{formatoMXN(costo)}</span>
              </header>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {ts.map((t) => {
                  const est = estatusTabla(t, lotes);
                  const sc = semanaCultivoTabla(lotes, t.id, semanaActual);
                  const ls = lotesDeTabla(lotes, t.id);
                  const primero = ls.find((l) => l.avances.length > 0);
                  const variedadesTabla = [...new Set(ls.map((l) => nombreVariedad(l.variedadId)))].join(" · ");
                  return (
                    <button
                      key={t.id}
                      onClick={() => setAbierta(t)}
                      className={`flex aspect-[4/5] flex-col justify-between rounded-xl p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift ${TILE[est]}`}
                    >
                      <div>
                        <div className="text-sm font-medium">{t.nombre}</div>
                        <div className="num text-xs opacity-70">{formatoNum(t.hectareas)} ha</div>
                        <div className="mt-1 text-[0.7rem] leading-tight opacity-80">
                          {ESTATUS_TABLA_LABEL[est]}
                        </div>
                      </div>
                      <div>
                        {sc !== null ? (
                          <div className="font-display text-3xl leading-none">
                            S{sc}
                            <span className="text-base opacity-60">
                              /{primero ? semanaCosechaLote(primero) : 12}
                            </span>
                          </div>
                        ) : (
                          <div className="text-xs opacity-80">
                            {ls.length > 0 ? `Siembra sem ${ls.map((x) => x.semanaPlaneada).join(", ")}` : "Disponible"}
                          </div>
                        )}
                        {ls.length > 0 && (
                          <div className="mt-1 text-[0.7rem] leading-tight opacity-70">
                            {variedadesTabla}
                            <div className="num">{ls.map((l) => l.codigo).join(" · ")}</div>
                          </div>
                        )}
                        <div className="num mt-2 text-sm font-medium">{formatoMXN(costoTabla(t.id))}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <Sheet open={!!abierta} onOpenChange={(o) => !o && setAbierta(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {abierta && <ResumenTabla tabla={abierta} />}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

function ResumenTabla({ tabla }: { tabla: Tabla }) {
  const { ranchos, productos, lotes, pedidos, recepciones, semanaActual, role } = useCampo();
  const { porLote, costoLote, costoTabla } = useCostos();
  const [corrigiendo, setCorrigiendo] = useState<Lote | null>(null);
  const editar = puedeCorregirFechas(role);
  const botonFechas = (l: Lote) =>
    editar && l.avances.length > 0 ? (
      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setCorrigiendo(l)}>
        Corregir fechas
      </Button>
    ) : null;
  const rancho = ranchos.find((r) => r.id === tabla.ranchoId);
  const est = estatusTabla(tabla, lotes);
  const ls = lotesDeTabla(lotes, tabla.id);
  const cosechados = lotes.filter((l) => l.tablaId === tabla.id && l.finalizado);

  // Productos entregados a la fecha (todos los ciclos): planeación + semanal
  const entregados = new Map<string, number>();
  for (const l of [...ls, ...cosechados]) {
    for (const i of insumosEntregados(l, pedidos))
      entregados.set(i.productoId, (entregados.get(i.productoId) ?? 0) + i.cantidad);
    for (const x of porLote.get(l.id) ?? [])
      entregados.set(x.productoId, (entregados.get(x.productoId) ?? 0) + cantidadRecibida(x, recepciones));
  }
  const lista = productos
    .filter((p) => (entregados.get(p.id) ?? 0) > 0)
    .map((p) => ({ p, cantidad: entregados.get(p.id)! }));

  return (
    <>
      <SheetHeader>
        <span className="eyebrow">{rancho?.nombre}</span>
        <SheetTitle className="font-display text-3xl">{tabla.nombre}</SheetTitle>
        <SheetDescription asChild>
          <div>
            <Badge variant={est}>{ESTATUS_TABLA_LABEL[est]}</Badge>
          </div>
        </SheetDescription>
      </SheetHeader>

      <dl className="mt-6 grid grid-cols-3 gap-3 px-4 text-sm">
        <div className="rounded-lg bg-secondary p-3">
          <dt className="eyebrow">Total</dt>
          <dd className="num mt-1 text-lg">{formatoNum(tabla.hectareas)} ha</dd>
        </div>
        <div className="rounded-lg bg-secondary p-3">
          <dt className="eyebrow">Ha activas</dt>
          <dd className="num mt-1 text-lg">{formatoNum(hectareasActivas(lotes, tabla.id, semanaActual))}</dd>
        </div>
        <div className="rounded-lg bg-primary p-3 text-primary-foreground">
          <dt className="eyebrow !text-primary-foreground/70">Invertido</dt>
          <dd className="num mt-1 text-lg">{formatoMXN(costoTabla(tabla.id))}</dd>
        </div>
      </dl>

      <div className="mt-6 px-4">
        <h3 className="mb-2 text-lg font-semibold">Lotes</h3>
        {ls.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tabla libre.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {ls.map((l) => {
              const real = semanaRealLote(l);
              const sr = semanaRecetaLote(l, semanaActual);
              return (
                <li key={l.id} className="rounded-lg border border-border p-3">
                  <div className="flex justify-between">
                    <span className="font-medium">
                      Lote {l.codigo} · <span className="num">{formatoNum(l.ha)} ha</span>
                    </span>
                    <span className="num">{formatoMXN(costoLote(l.id))}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {nombreVariedad(l.variedadId)} ·{" "}
                    {real !== null
                      ? `Plantado ${fechaCorta(fechaPlantacionLote(l))} (sem ${real}) · ${formatoNum(plantadasLote(l))} ha · semana de receta ${sr} (${etapa(sr!, semanaCosechaLote(l)).toLowerCase()})`
                      : esArrastrado(l, semanaActual)
                        ? `Pendiente arrastrado · ${formatoNum(pendientesLote(l))} ha`
                        : `Planeado para sem ${l.semanaPlaneada}`}
                  </p>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      Cosecha {l.fechaCosecha ? "" : "estimada "}
                      {fechaCorta(fechaCosechaLote(l))}
                    </span>
                    {botonFechas(l)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {cosechados.length > 0 && (
        <div className="mt-6 px-4">
          <h3 className="mb-2 text-lg font-semibold">Ciclos ya cosechados</h3>
          <ul className="space-y-2 text-sm">
            {cosechados.map((l) => (
              <li key={l.id} className="flex justify-between rounded-lg bg-secondary/60 p-3">
                <span>
                  Lote {l.codigo} · {nombreVariedad(l.variedadId)} ·{" "}
                  <span className="num">{formatoNum(l.ha)} ha</span>
                  <span className="block text-xs text-muted-foreground">
                    {fechaCorta(fechaPlantacionLote(l))} → {fechaCorta(fechaCosechaLote(l))}
                  </span>
                  {botonFechas(l) && <span className="-ml-2 block">{botonFechas(l)}</span>}
                </span>
                <span className="num">{formatoMXN(costoLote(l.id))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 px-4 pb-6">
        <h3 className="mb-2 text-lg font-semibold">Productos entregados a la fecha</h3>
        {lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no se han entregado insumos.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {lista.map(({ p, cantidad }) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium">{p.nombre}</div>
                  <div className="num text-xs text-muted-foreground">{p.codigo}</div>
                </div>
                <div className="text-right">
                  <div className="num">
                    {formatoNum(cantidad)} {p.unidad}
                  </div>
                  <div className="num text-xs text-muted-foreground">{formatoMXN(cantidad * p.precio)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <CorregirFechasDialog lote={corrigiendo} onClose={() => setCorrigiendo(null)} />
    </>
  );
}
