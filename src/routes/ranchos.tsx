import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { AppShell, Stat } from "@/components/campo/AppShell";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  cantidadRecibida,
  estatusLinea,
  estatusTabla,
  formatoMXN,
  formatoNum,
  hectareasActivas,
  lineasSemanas,
  planesOrdenados,
  semanaCultivoTabla,
} from "@/lib/campo/calc";
import { RANCHOS } from "@/lib/campo/seed";
import { useCampo } from "@/lib/campo/store";
import type { LineaDemanda, Tabla } from "@/lib/campo/types";

export const Route = createFileRoute("/ranchos")({
  head: () => ({
    meta: [
      { title: "Estatus de ranchos y costos · Brócoli" },
      {
        name: "description",
        content: "Qué tablas están ocupadas, en qué semana de cultivo van y cuánto se ha invertido en insumos en cada una.",
      },
      { property: "og:title", content: "Estatus de ranchos y costos · Brócoli" },
      {
        property: "og:description",
        content: "Inversión acumulada en insumos por rancho y por tabla, en tiempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Ranchos,
});

const TILE: Record<string, string> = {
  libre: "bg-status-libre text-status-libre-foreground",
  planeada: "bg-status-planeada text-status-planeada-foreground",
  plantada: "bg-status-plantada text-status-plantada-foreground",
};

function Ranchos() {
  const { tablas, receta, productos, recepciones, semanaActual } = useCampo();
  const [abierta, setAbierta] = useState<Tabla | null>(null);
  const precio = useMemo(() => new Map(productos.map((p) => [p.id, p.precio])), [productos]);

  // Lo recibido hasta hoy, por tabla
  const recibidas = useMemo(() => {
    const semanas = Array.from({ length: 16 }, (_, i) => semanaActual - 14 + i);
    return lineasSemanas(tablas, receta, semanas, semanaActual).filter(
      (l) => estatusLinea(l, recepciones, semanaActual) === "recibido",
    );
  }, [tablas, receta, recepciones, semanaActual]);

  const porTabla = useMemo(() => {
    const m = new Map<string, LineaDemanda[]>();
    for (const l of recibidas) m.set(l.tablaId, [...(m.get(l.tablaId) ?? []), l]);
    return m;
  }, [recibidas]);

  const costoDe = (id: string) =>
    (porTabla.get(id) ?? []).reduce(
      (s, l) => s + cantidadRecibida(l, recepciones) * (precio.get(l.productoId) ?? 0),
      0,
    );

  const total = tablas.reduce((s, t) => s + costoDe(t.id), 0);
  const haActivas = tablas.reduce((s, t) => s + hectareasActivas(t, receta, semanaActual), 0);
  const ocupadas = tablas.filter((t) => estatusTabla(t) !== "libre").length;

  return (
    <AppShell
      path="/ranchos"
      eyebrow={`Administrador · semana ${semanaActual}`}
      title="Estatus de ranchos y costos"
      description="Cada tabla con su semana de cultivo y el dinero en insumos recibidos a la fecha."
    >
      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        <Stat label="Inversión acumulada" value={formatoMXN(total)} tone="primary" />
        <Stat label="Hectáreas activas" value={`${formatoNum(haActivas)} ha`} />
        <Stat
          label="Tablas ocupadas"
          value={`${ocupadas}/${tablas.length}`}
          hint="Planeadas o plantadas"
          tone="soil"
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2 text-xs">
        <Badge variant="libre">Libre</Badge>
        <Badge variant="planeada">Planeada</Badge>
        <Badge variant="plantada">Plantada</Badge>
      </div>

      <div className="space-y-10">
        {RANCHOS.map((r) => {
          const ts = tablas.filter((t) => t.ranchoId === r.id);
          const costo = ts.reduce((s, t) => s + costoDe(t.id), 0);
          const ha = ts.reduce((s, t) => s + t.hectareas, 0);
          return (
            <section key={r.id}>
              <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="text-3xl font-semibold">{r.nombre}</h2>
                  <p className="text-sm text-muted-foreground">
                    {r.ubicacion} · <span className="num">{formatoNum(ha)}</span> ha en{" "}
                    {ts.length} tablas
                  </p>
                </div>
                <span className="num text-lg">{formatoMXN(costo)}</span>
              </header>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {ts.map((t) => {
                  const est = estatusTabla(t);
                  const sc = semanaCultivoTabla(t, semanaActual);
                  return (
                    <button
                      key={t.id}
                      onClick={() => setAbierta(t)}
                      className={`flex aspect-[4/5] flex-col justify-between rounded-xl p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift ${TILE[est]}`}
                    >
                      <div>
                        <div className="text-sm font-medium">{t.nombre}</div>
                        <div className="num text-xs opacity-70">{formatoNum(t.hectareas)} ha</div>
                      </div>
                      <div>
                        {sc !== null ? (
                          <>
                            <div className="font-display text-3xl leading-none">
                              S{sc}
                              <span className="text-base opacity-60">/{receta.semanas}</span>
                            </div>
                            <div className="mt-2 h-1 overflow-hidden rounded-full bg-foreground/10">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${Math.min(100, (sc / receta.semanas) * 100)}%` }}
                              />
                            </div>
                          </>
                        ) : (
                          <div className="text-xs capitalize opacity-80">
                            {est === "planeada" ? `Siembra sem ${planesOrdenados(t).map((x) => x.semana).join(" y ")}` : "Disponible"}
                          </div>
                        )}
                        <div className="num mt-2 text-sm font-medium">{formatoMXN(costoDe(t.id))}</div>
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
          {abierta && (
            <ResumenTabla
              tabla={abierta}
              lineas={porTabla.get(abierta.id) ?? []}
              costo={costoDe(abierta.id)}
            />
          )}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

function ResumenTabla({
  tabla,
  lineas,
  costo,
}: {
  tabla: Tabla;
  lineas: LineaDemanda[];
  costo: number;
}) {
  const { productos, receta, recepciones, semanaActual } = useCampo();
  const rancho = RANCHOS.find((r) => r.id === tabla.ranchoId);
  const sc = semanaCultivoTabla(tabla, semanaActual);
  const est = estatusTabla(tabla);

  const aplicados = productos
    .map((p) => {
      const ls = lineas.filter((l) => l.productoId === p.id);
      const receta = ls.reduce((s, l) => s + l.cantidad, 0);
      const recibido = ls.reduce((s, l) => s + cantidadRecibida(l, recepciones), 0);
      return { p, receta, recibido };
    })
    .filter((x) => x.recibido > 0 || x.receta > 0);

  const totalReceta = aplicados.reduce((s, a) => s + a.receta * a.p.precio, 0);
  const desviacion = totalReceta > 0 ? ((costo - totalReceta) / totalReceta) * 100 : 0;

  return (
    <>
      <SheetHeader>
        <span className="eyebrow">{rancho?.nombre}</span>
        <SheetTitle className="font-display text-3xl">{tabla.nombre}</SheetTitle>
        <SheetDescription asChild>
          <div>
            <Badge variant={est} className="capitalize">
              {est}
            </Badge>
          </div>
        </SheetDescription>
      </SheetHeader>

      <dl className="mt-6 grid grid-cols-3 gap-3 px-4 text-sm">
        <div className="rounded-lg bg-secondary p-3">
          <dt className="eyebrow">Semana</dt>
          <dd className="num mt-1 text-lg">{sc !== null ? `${sc}/${receta.semanas}` : "—"}</dd>
        </div>
        <div className="rounded-lg bg-secondary p-3">
          <dt className="eyebrow">Ha activas</dt>
          <dd className="num mt-1 text-lg">
            {formatoNum(hectareasActivas(tabla, receta, semanaActual))}
          </dd>
        </div>
        <div className="rounded-lg bg-primary p-3 text-primary-foreground">
          <dt className="eyebrow !text-primary-foreground/70">Invertido</dt>
          <dd className="num mt-1 text-lg">{formatoMXN(costo)}</dd>
        </div>
      </dl>

      {aplicados.length > 0 ? (
        <div className="mt-6 px-4 pb-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-lg font-semibold">Productos aplicados a la fecha</h3>
            <span
              className={`num text-xs ${Math.abs(desviacion) < 0.5 ? "text-primary" : "text-destructive"}`}
            >
              {Math.abs(desviacion) < 0.5
                ? "Igual a receta"
                : `${desviacion > 0 ? "+" : ""}${formatoNum(desviacion)}% vs receta`}
            </span>
          </div>
          <ul className="divide-y divide-border text-sm">
            {aplicados.map(({ p, recibido, receta }) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium">{p.nombre}</div>
                  <div className="text-xs text-muted-foreground">{p.familia}</div>
                </div>
                <div className="text-right">
                  <div className="num">
                    {formatoNum(recibido)} {p.unidad}
                  </div>
                  <div className="num text-xs text-muted-foreground">
                    {Math.abs(recibido - receta) > 0.01
                      ? `receta ${formatoNum(receta)}`
                      : formatoMXN(recibido * p.precio)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-8 px-4 text-sm text-muted-foreground">
          Aún no se han recibido insumos para esta tabla.
        </p>
      )}
    </>
  );
}
