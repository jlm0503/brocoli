import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, FlaskConical, Package, Sprout } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell, Stat } from "@/components/campo/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  consolidar,
  ESTATUS_SOLICITUD_LABEL,
  fechaCorta,
  fechaEnSemana,
  folioSolicitud,
  formatoNum,
  lineasSemana,
  pedidosQueLleganEnSemana,
  plantaQueLlegaEnSemana,
} from "@/lib/campo/calc";
import { useCampo } from "@/lib/campo/store";
import { useFiltro } from "@/lib/campo/filtro";

export const Route = createFileRoute("/_authenticated/llegadas")({
  head: () => ({
    meta: [
      { title: "Lo que llega al rancho · Brócoli" },
      {
        name: "description",
        content:
          "Insumos, pedidos de planeación y planta que llegan a cada rancho, semana por semana.",
      },
      { property: "og:title", content: "Lo que llega al rancho · Brócoli" },
      { property: "og:description", content: "Qué recibe cada rancho cada semana." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Llegadas,
});

const ESTATUS_INSUMO = {
  pendiente: "Pendiente",
  comprado: "Comprado",
  recibido: "Recibido",
  cancelado: "Cancelado",
  parcial: "Recibido parcialmente",
} as const;

function Llegadas() {
  const {
    semanaActual,
    lotes: todosLotes,
    tablas,
    recetas,
    adicionales,
    productos,
    recepciones,
    pedidos,
    solicitudes,
  } = useCampo();
  const { ranchos, pasaLote, pasaLoteId } = useFiltro();
  const lotes = useMemo(() => todosLotes.filter((l) => pasaLote(l)), [todosLotes, pasaLote]);
  const [semana, setSemana] = useState(semanaActual);
  const productoById = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const tablaById = useMemo(() => new Map(tablas.map((t) => [t.id, t])), [tablas]);
  const loteById = useMemo(() => new Map(lotes.map((l) => [l.id, l])), [lotes]);

  const insumos = useMemo(
    () =>
      consolidar(
        lineasSemana(lotes, recetas, adicionales, [semana]),
        productos,
        recepciones,
        semanaActual,
      ),
    [lotes, recetas, adicionales, semana, productos, recepciones, semanaActual],
  );
  const planeacion = pedidosQueLleganEnSemana(pedidos, semana).filter((p) => pasaLoteId(p.loteId));
  const planta = plantaQueLlegaEnSemana(solicitudes, semana).filter((l) => pasaLoteId(l.loteId));

  const conAlgo = ranchos.filter(
    (r) =>
      insumos.some((f) => f.ranchoId === r.id) ||
      planeacion.some((p) => p.ranchoId === r.id) ||
      planta.some((l) => l.ranchoId === r.id),
  );

  return (
    <AppShell
      path="/llegadas"
      eyebrow={`Semana ${semana} · inicia ${fechaCorta(fechaEnSemana(semana))}`}
      title="Lo que llega al rancho"
      description="Lo que va a recibir cada rancho en la semana: insumos de la receta, cinta y productos de preparación, y planta del vivero."
      filtros
      actions={
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="outline"
            onClick={() => setSemana((w) => w - 1)}
            aria-label="Semana anterior"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant={semana === semanaActual ? "default" : "outline"}
            onClick={() => setSemana(semanaActual)}
          >
            Esta semana
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => setSemana((w) => w + 1)}
            aria-label="Semana siguiente"
          >
            <ChevronRight />
          </Button>
        </div>
      }
    >
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Insumos de la receta"
          value={insumos.length}
          hint="Productos por rancho"
          tone="primary"
        />
        <Stat label="Pedidos de planeación" value={planeacion.length} hint="Cinta y preparación" />
        <Stat
          label="Planta del vivero"
          value={`${formatoNum(planta.reduce((s, l) => s + l.plantas, 0))}`}
          hint={`${planta.length} lotes`}
          tone="soil"
        />
      </div>

      {semana > semanaActual && (
        <p className="mb-6 rounded-lg bg-secondary px-4 py-3 text-sm text-muted-foreground">
          Los insumos de la receta solo cuentan lo que ya está plantado; si se planta más, esta
          semana puede crecer.
        </p>
      )}

      {conAlgo.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
          No llega nada a ningún rancho en la semana {semana}.
        </div>
      ) : (
        <div className="space-y-8">
          {conAlgo.map((r) => {
            const ins = insumos
              .filter((f) => f.ranchoId === r.id)
              .sort((a, b) =>
                (productoById.get(a.productoId)?.nombre ?? "").localeCompare(
                  productoById.get(b.productoId)?.nombre ?? "",
                ),
              );
            const peds = planeacion.filter((p) => p.ranchoId === r.id);
            const plts = planta.filter((l) => l.ranchoId === r.id);
            return (
              <section
                key={r.id}
                className="overflow-hidden rounded-xl border border-border bg-card shadow-card"
              >
                <header className="border-b border-border bg-secondary/60 px-5 py-4">
                  <h2 className="text-2xl font-semibold">{r.nombre}</h2>
                  {r.zona && <p className="text-xs text-muted-foreground">{r.zona}</p>}
                </header>
                <div className="divide-y divide-border">
                  {plts.length > 0 && (
                    <Bloque icono={<Sprout className="size-4" />} titulo="Planta del vivero">
                      {plts.map((l) => (
                        <Fila
                          key={`${l.folio}-${l.loteId}`}
                          izquierda={`${l.tabla} · lote ${l.lote}`}
                          detalle={`${l.variedad} · ${l.vivero} · ${folioSolicitud(l.folio)} · entrega ${fechaCorta(l.fechaEntrega)}`}
                          cantidad={`${formatoNum(l.plantas)} plantas`}
                          estatus={
                            <Badge
                              variant={
                                l.status === "recibida"
                                  ? "recibido"
                                  : l.status === "generada"
                                    ? "pendiente"
                                    : "comprado"
                              }
                            >
                              {ESTATUS_SOLICITUD_LABEL[l.status]}
                            </Badge>
                          }
                        />
                      ))}
                    </Bloque>
                  )}
                  {peds.length > 0 && (
                    <Bloque
                      icono={<Package className="size-4" />}
                      titulo="Cinta y preparación (para plantar en 2 semanas)"
                    >
                      {peds.flatMap((p) =>
                        p.lineas.map((x) => {
                          const prod = productoById.get(x.productoId);
                          return (
                            <Fila
                              key={`${p.id}-${x.productoId}`}
                              izquierda={prod?.nombre ?? "Producto"}
                              detalle={`${tablaById.get(p.tablaId)?.nombre ?? ""} · lote ${loteById.get(p.loteId)?.codigo ?? ""} · planta sem ${p.semanaPlantacion}`}
                              cantidad={`${formatoNum(x.cantidad)} ${prod?.unidad ?? ""}${p.cantidadesRecibidas ? ` · recibido ${formatoNum(p.cantidadesRecibidas[x.productoId] ?? 0)}` : ""}`}
                              estatus={
                                <Badge
                                  variant={p.status === "entregado" ? "recibido" : p.cantidadesRecibidas ? "parcial" : "pendiente"}
                                >
                                  {p.status === "entregado" ? "Entregado" : p.cantidadesRecibidas ? "Recibido parcialmente" : "Pendiente"}
                                </Badge>
                              }
                            />
                          );
                        }),
                      )}
                    </Bloque>
                  )}
                  {ins.length > 0 && (
                    <Bloque
                      icono={<FlaskConical className="size-4" />}
                      titulo="Insumos de la receta"
                    >
                      {ins.map((f) => {
                        const prod = productoById.get(f.productoId);
                        const tablasTxt = [
                          ...new Set(f.lineas.map((l) => tablaById.get(l.tablaId)?.nombre ?? "")),
                        ].join(", ");
                        return (
                          <Fila
                            key={f.productoId}
                            izquierda={prod?.nombre ?? "Producto"}
                            detalle={tablasTxt}
                            cantidad={`${formatoNum(f.cantidadPedido)} ${prod?.unidad ?? ""}${f.keys.some(k => recepciones[k]?.cantidadRecibida !== undefined) ? ` · recibido ${formatoNum(f.keys.reduce((s, k) => s + (recepciones[k]?.cantidadRecibida ?? 0), 0))}` : ""}`}
                            estatus={<Badge variant={f.status}>{ESTATUS_INSUMO[f.status]}</Badge>}
                          />
                        );
                      })}
                    </Bloque>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function Bloque({
  icono,
  titulo,
  children,
}: {
  icono: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        {icono} {titulo}
      </h3>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

function Fila({
  izquierda,
  detalle,
  cantidad,
  estatus,
}: {
  izquierda: string;
  detalle: string;
  cantidad: string;
  estatus: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md bg-secondary/50 px-3 py-2 text-sm">
      <span className="min-w-0 flex-1">
        <span className="font-medium">{izquierda}</span>
        {detalle && <span className="block text-xs text-muted-foreground">{detalle}</span>}
      </span>
      <span className="num whitespace-nowrap">{cantidad}</span>
      {estatus}
    </li>
  );
}
