import { createFileRoute } from "@tanstack/react-router";
import { Check, ImageIcon, RotateCcw, ShoppingCart, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, Stat } from "@/components/campo/AppShell";
import { FotoInput, VerEvidencia } from "@/components/campo/Evidencia";
import { ExtrasCompras } from "@/components/campo/Extraordinarios";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  consolidar,
  fechaEnSemana,
  precioVigente,
  consolidarPlaneacion,
  fechaLimite,
  formatoMXN,
  formatoNum,
  lineasSemana,
  semaforoPedido,
  semanaEntregaIdeal,
  semanaEntregaLimite,
  type Consolidado,
} from "@/lib/campo/calc";
import { useCampo } from "@/lib/campo/store";
import { useFiltro } from "@/lib/campo/filtro";
import type { PedidoPlaneacion, Semaforo } from "@/lib/campo/types";

export const Route = createFileRoute("/_authenticated/compras")({
  head: () => ({
    meta: [
      { title: "Compras y entregas · Brócoli" },
      {
        name: "description",
        content:
          "Pedidos de planeación con semáforo, insumos a entregar esta semana y compras para dentro de dos semanas, por rancho.",
      },
      { property: "og:title", content: "Compras y entregas · Brócoli" },
      {
        property: "og:description",
        content: "Lo que hay que entregar y comprar por rancho, calculado con la receta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Compras,
});

const STATUS_LABEL = {
  pendiente: "Pendiente",
  comprado: "Comprado",
  recibido: "Recibido en rancho",
  cancelado: "Cancelado",
  parcial: "Mixto",
} as const;

const SEMAFORO_LABEL: Record<Semaforo, string> = {
  verde: "Entregado",
  amarillo: "En tiempo",
  rojo: "Atrasado",
  gris: "Cancelado",
};

function Compras() {
  const { semanaActual, pedidos } = useCampo();
  const { pasaLoteId } = useFiltro();
  const rojos = pedidos.filter((p) => pasaLoteId(p.loteId) && semaforoPedido(p, semanaActual) === "rojo").length;
  return (
    <AppShell
      path="/compras"
      eyebrow={`Compras · semana ${semanaActual}`}
      title="Compras y entregas"
      description="Todo sale de la receta: el pedido de planeación nace al planear un lote; lo semanal se calcula con las hectáreas realmente plantadas."
      filtros
    >
      <Tabs defaultValue="planeacion">
        <TabsList className="mb-6 h-auto flex-wrap">
          <TabsTrigger value="planeacion">
            Pedidos de planeación
            {rojos > 0 && (
              <span className="num ml-1.5 rounded-full bg-destructive px-1.5 text-[0.65rem] text-destructive-foreground">
                {rojos}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="entregar">Entregar esta semana · {semanaActual}</TabsTrigger>
          <TabsTrigger value="comprar">Comprar para semana {semanaActual + 2}</TabsTrigger>
          <TabsTrigger value="extra">Extraordinarios autorizados</TabsTrigger>
        </TabsList>
        <TabsContent value="planeacion">
          <PedidosPlaneacion />
        </TabsContent>
        <TabsContent value="entregar">
          <ListaSemana semana={semanaActual} modo="entregar" />
        </TabsContent>
        <TabsContent value="comprar">
          <ListaSemana semana={semanaActual + 2} modo="comprar" />
        </TabsContent>
        <TabsContent value="extra">
          <ExtrasCompras />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

/* ───────────── Pedidos de planeación ───────────── */

function PedidosPlaneacion() {
  const { ranchos, pedidos, productos, tablas, lotes, semanaActual, reabrirPedido } = useCampo();
  const [todos, setTodos] = useState(false);
  const [entregando, setEntregando] = useState<PedidoPlaneacion | null>(null);
  const productoById = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);

  const { pasaLoteId } = useFiltro();
  const visibles = pedidos.filter(
    (p) => pasaLoteId(p.loteId) && (todos || p.status === "pendiente" || semanaEntregaLimite(p) >= semanaActual),
  );
  const grupos = useMemo(() => {
    const m = new Map<string, PedidoPlaneacion[]>();
    for (const p of visibles) {
      const k = `${semanaEntregaLimite(p)}|${p.ranchoId}`;
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return [...m.entries()].sort((a, b) => {
      const [wa, ra] = a[0].split("|");
      const [wb, rb] = b[0].split("|");
      return Number(wa) - Number(wb) || ra!.localeCompare(rb!);
    });
  }, [visibles]);

  const conteo = (s: Semaforo) => visibles.filter((p) => semaforoPedido(p, semanaActual) === s).length;

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Atrasados" value={conteo("rojo")} hint="No entregados y ya es semana P-1" tone="soil" />
        <Stat label="En tiempo" value={conteo("amarillo")} />
        <Stat label="Entregados" value={conteo("verde")} tone="primary" />
      </div>
      <label className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Switch checked={todos} onCheckedChange={setTodos} /> Mostrar también entregados anteriores
      </label>

      <div className="space-y-6">
        {grupos.map(([k, ps]) => {
          const limite = Number(k.split("|")[0]);
          const rancho = ranchos.find((r) => r.id === ps[0]!.ranchoId);
          const consolidado = consolidarPlaneacion(ps, productos);
          return (
            <section key={k} className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-secondary/60 px-5 py-4">
                <div>
                  <h2 className="text-2xl font-semibold">{rancho?.nombre}</h2>
                  <p className="text-xs text-muted-foreground">
                    Entrega ideal semana {limite - 1} · fecha límite semana {limite} ({fechaLimite(limite)})
                  </p>
                </div>
              </header>
              <div className="grid gap-0 lg:grid-cols-[1fr_1.2fr]">
                <div className="border-b border-border p-5 lg:border-r lg:border-b-0">
                  <span className="eyebrow">Consolidado del rancho</span>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {consolidado.map((c) => {
                      const p = productoById.get(c.productoId);
                      return (
                        <li key={c.productoId} className="flex justify-between gap-3">
                          <span>
                            <span className="num mr-2 text-xs text-muted-foreground">{p?.codigo}</span>
                            {p?.nombre}
                          </span>
                          <span className="num whitespace-nowrap">
                            {formatoNum(c.cantidadPedido)} {p?.unidad}
                            {c.cantidadPedido !== c.cantidad && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({formatoNum(c.cantidad)})
                              </span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <ul className="divide-y divide-border">
                  {ps.map((p) => {
                    const sem = semaforoPedido(p, semanaActual);
                    const t = tablas.find((x) => x.id === p.tablaId);
                    const l = lotes.find((x) => x.id === p.loteId);
                    return (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 font-medium">
                            {t?.nombre} · Lote {l?.codigo}
                            <Badge variant={sem}>{SEMAFORO_LABEL[sem]}</Badge>
                            {p.urgente && <Badge variant="urgente">Urgente</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            <span className="num">{formatoNum(p.ha)} ha</span> · siembra semana{" "}
                            {p.semanaPlantacion} · ideal sem {semanaEntregaIdeal(p)}
                            {p.motivo && ` · ${p.motivo}`}
                          </p>
                        </div>
                        {p.status === "pendiente" ? (
                          <Button size="sm" variant="soft" onClick={() => setEntregando(p)}>
                            <Check /> Entregado
                          </Button>
                        ) : p.status === "entregado" ? (
                          <div className="flex items-center gap-1">
                            {p.foto && (
                              <VerEvidencia foto={p.foto} title="Ver evidencia">
                                <ImageIcon className="size-4 text-primary" />
                              </VerEvidencia>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => reabrirPedido(p.id)}>
                              <RotateCcw /> Reabrir
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          );
        })}
        {grupos.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            No hay pedidos de planeación pendientes.
          </p>
        )}
      </div>

      <EntregarPedidoDialog pedido={entregando} onClose={() => setEntregando(null)} />
    </>
  );
}

function EntregarPedidoDialog({ pedido, onClose }: { pedido: PedidoPlaneacion | null; onClose: () => void }) {
  const { tablas, lotes, entregarPedido } = useCampo();
  const [foto, setFoto] = useState<string | undefined>();
  const t = pedido ? tablas.find((x) => x.id === pedido.tablaId) : undefined;
  const l = pedido ? lotes.find((x) => x.id === pedido.loteId) : undefined;
  const cerrar = () => {
    setFoto(undefined);
    onClose();
  };
  return (
    <Dialog open={!!pedido} onOpenChange={(o) => !o && cerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Entregar pedido de planeación</DialogTitle>
          <DialogDescription>
            {t?.nombre} · Lote {l?.codigo}. El costo se carga al lote al confirmar.
          </DialogDescription>
        </DialogHeader>
        <FotoInput foto={foto} setFoto={setFoto} />
        <DialogFooter>
          <Button variant="ghost" onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!pedido) return;
              if (!foto) {
                toast.error("Agrega la foto de evidencia de la entrega");
                return;
              }
              entregarPedido(pedido.id, foto);
              toast.success(`Pedido del lote ${l?.codigo} entregado`);
              cerrar();
            }}
          >
            Confirmar entrega
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────── Entregar / comprar ───────────── */

function ListaSemana({ semana, modo }: { semana: number; modo: "entregar" | "comprar" }) {
  const { ranchos, lotes: todosLotes, tablas, recetas, adicionales, productos, recepciones, semanaActual, marcar } = useCampo();
  const { pasaLote } = useFiltro();
  const lotes = useMemo(() => todosLotes.filter((l) => pasaLote(l)), [todosLotes, pasaLote]);
  const [recibiendo, setRecibiendo] = useState<Consolidado | null>(null);
  const productoById = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const lineas = useMemo(
    () => lineasSemana(lotes, recetas, adicionales, [semana]),
    [lotes, recetas, adicionales, semana],
  );
  const filas = useMemo(
    () => consolidar(lineas, productos, recepciones, semanaActual),
    [lineas, productos, recepciones, semanaActual],
  );
  const loteById = useMemo(() => new Map(lotes.map((l) => [l.id, l])), [lotes]);
  const tablaById = useMemo(() => new Map(tablas.map((t) => [t.id, t])), [tablas]);

  const costo = (fs: Consolidado[]) =>
    fs.reduce((s, f) => {
      const p = productoById.get(f.productoId);
      return s + f.cantidadPedido * (p ? precioVigente(p, fechaEnSemana(f.semana)) : 0);
    }, 0);
  const porAtender = filas.filter((f) =>
    modo === "comprar" ? f.status === "pendiente" : f.status === "pendiente" || f.status === "comprado" || f.status === "parcial",
  ).length;

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat
          label={modo === "entregar" ? `Costo a entregar sem ${semana}` : `Costo a comprar sem ${semana}`}
          value={formatoMXN(costo(filas))}
          hint={`Semana ${semana} inicia ${fechaLimite(semana)}`}
          tone="primary"
        />
        <Stat
          label={modo === "entregar" ? "Por recibir en rancho" : "Por comprar"}
          value={porAtender}
          tone="soil"
        />
        <Stat
          label="Lotes plantados incluidos"
          value={new Set(lineas.map((l) => l.loteId)).size}
          hint="Solo hectáreas realmente plantadas"
        />
      </div>

      <div className="space-y-8">
        {ranchos.map((r) => {
          const deRancho = filas
            .filter((f) => f.ranchoId === r.id)
            .sort((a, b) => {
              const pa = productoById.get(a.productoId)!;
              const pb = productoById.get(b.productoId)!;
              return pa.familia.localeCompare(pb.familia) || pa.nombre.localeCompare(pb.nombre);
            });
          if (deRancho.length === 0) return null;
          return (
            <section key={r.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-secondary/60 px-5 py-4">
                <div>
                  <h2 className="text-2xl font-semibold">{r.nombre}</h2>
                  <p className="text-xs text-muted-foreground">{r.zona}</p>
                </div>
                <span className="num text-sm text-muted-foreground">{formatoMXN(costo(deRancho))}</span>
              </header>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">Producto · desglose por lote</TableHead>
                      <TableHead className="text-right">Total rancho</TableHead>
                      <TableHead>Estatus</TableHead>
                      <TableHead className="pr-5 text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deRancho.map((f) => {
                      const p = productoById.get(f.productoId)!;
                      const foto = f.keys.map((k) => recepciones[k]?.foto).find(Boolean);
                      const abierto = f.status !== "recibido" && f.status !== "cancelado";
                      return (
                        <TableRow key={`${f.ranchoId}-${f.productoId}`} className="align-top">
                          <TableCell className="pl-5">
                            <div className="flex items-center gap-2 font-medium">
                              <span className="num text-xs text-muted-foreground">{p.codigo}</span>
                              {p.nombre}
                              {foto && (
                                <VerEvidencia foto={foto} title="Ver evidencia">
                                  <ImageIcon className="size-3.5 text-primary" />
                                </VerEvidencia>
                              )}
                            </div>
                            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                              {f.lineas.map((l) => {
                                const lote = loteById.get(l.loteId);
                                return (
                                  <li key={l.key}>
                                    {tablaById.get(l.tablaId)?.nombre} · {lote?.codigo} · sem {l.semanaReceta}{" "}
                                    × {formatoNum(l.semanaReceta < 0 ? lote?.ha ?? 0 : (lote?.avances.reduce((s, a) => s + a.ha, 0) ?? 0))} ha ={" "}
                                    <span className="num text-foreground">
                                      {formatoNum(l.cantidad)} {p.unidad}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          </TableCell>
                          <TableCell className="num text-right whitespace-nowrap">
                            {formatoNum(f.cantidadPedido)} {p.unidad}
                            {f.cantidadPedido !== f.cantidad && (
                              <div className="text-xs text-muted-foreground">
                                exacto {formatoNum(f.cantidad)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={f.status}>{STATUS_LABEL[f.status]}</Badge>
                          </TableCell>
                          <TableCell className="pr-5 text-right">
                            {abierto ? (
                              <div className="flex justify-end gap-1">
                                {modo === "comprar" && f.status === "pendiente" && (
                                  <Button size="sm" variant="soft" onClick={() => marcar(f.keys, "comprado")}>
                                    <ShoppingCart /> Comprado
                                  </Button>
                                )}
                                {(modo === "entregar" || f.status !== "pendiente") && (
                                  <Button size="sm" variant="soft" onClick={() => setRecibiendo(f)}>
                                    <Check /> Recibido
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  aria-label="Cancelar"
                                  onClick={() => {
                                    marcar(f.keys, "cancelado");
                                    toast(`${p.nombre} cancelado en ${r.nombre}`);
                                  }}
                                >
                                  <X />
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => marcar(f.keys, "pendiente")}>
                                <RotateCcw /> Reabrir
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </section>
          );
        })}
        {filas.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            No hay insumos programados para esta semana.
          </p>
        )}
      </div>

      <RecibirDialog fila={recibiendo} onClose={() => setRecibiendo(null)} />
    </>
  );
}

function RecibirDialog({ fila, onClose }: { fila: Consolidado | null; onClose: () => void }) {
  const { ranchos, productos, recibir, tablas, lotes } = useCampo();
  const [cantidad, setCantidad] = useState<string | null>(null);
  const [foto, setFoto] = useState<string | undefined>();
  const p = fila ? productos.find((x) => x.id === fila.productoId) : undefined;
  const rancho = fila ? ranchos.find((r) => r.id === fila.ranchoId) : undefined;
  const valor = cantidad ?? (fila ? String(fila.cantidadPedido) : "");

  const cerrar = () => {
    setCantidad(null);
    setFoto(undefined);
    onClose();
  };

  const confirmar = () => {
    if (!fila || !p) return;
    const n = Number(valor);
    if (!(n >= 0)) {
      toast.error("Cantidad inválida");
      return;
    }
    if (!foto) {
      toast.error("Agrega la foto de evidencia de la entrada");
      return;
    }
    recibir(
      fila.lineas.map((l) => ({ key: l.key, cantidad: l.cantidad })),
      { cantidadTotal: n, foto },
    );
    toast.success(`${p.nombre} recibido en ${rancho?.nombre}`);
    cerrar();
  };

  return (
    <Dialog open={!!fila} onOpenChange={(o) => !o && cerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Recibido en rancho</DialogTitle>
          <DialogDescription>
            {p?.nombre} · {rancho?.nombre}. El costo se asigna a cada lote según su parte.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cant-recibida">Cantidad recibida ({p?.unidad})</Label>
            <Input
              id="cant-recibida"
              type="number"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setCantidad(e.target.value)}
              className="num"
            />
            {fila && Number(valor) !== fila.cantidadPedido && (
              <p className="text-xs text-soil-foreground">
                La receta indica {formatoNum(fila.cantidadPedido)} {p?.unidad}. Diferencia:{" "}
                {formatoNum(Number(valor) - fila.cantidadPedido)}.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Foto de evidencia</Label>
            <FotoInput foto={foto} setFoto={setFoto} />
          </div>

          <div className="rounded-lg bg-secondary p-3 text-xs">
            <span className="eyebrow">Se asigna a</span>
            <ul className="mt-2 space-y-1">
              {fila?.lineas.map((l) => (
                <li key={l.key} className="flex justify-between">
                  <span>
                    {tablas.find((t) => t.id === l.tablaId)?.nombre} · lote{" "}
                    {lotes.find((x) => x.id === l.loteId)?.codigo}
                  </span>
                  <span className="num">
                    {formatoNum(l.cantidad)} {p?.unidad}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={cerrar}>
            Cancelar
          </Button>
          <Button onClick={confirmar}>Confirmar entrada</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
