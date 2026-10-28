import { createFileRoute } from "@tanstack/react-router";
import { Camera, Check, ImageIcon, RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, Stat } from "@/components/campo/AppShell";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  consolidar,
  estatusLinea,
  fechaLimite,
  formatoMXN,
  formatoNum,
  lineasSemanas,
  type Consolidado,
} from "@/lib/campo/calc";
import { RANCHOS } from "@/lib/campo/seed";
import { useCampo } from "@/lib/campo/store";

export const Route = createFileRoute("/compras")({
  head: () => ({
    meta: [
      { title: "Consolidado de compras · Brócoli" },
      {
        name: "description",
        content: "Insumos a surtir por rancho para las próximas dos semanas, calculados con la receta maestra.",
      },
      { property: "og:title", content: "Consolidado de compras · Brócoli" },
      {
        property: "og:description",
        content: "Lo que hay que comprar, cuánto y para cuándo, por rancho.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Compras,
});

const STATUS_LABEL = {
  pendiente: "Pendiente",
  recibido: "Recibido",
  cancelado: "Cancelado",
  parcial: "Parcial",
} as const;

function Compras() {
  const { tablas, receta, productos, recepciones, semanaActual, marcar } = useCampo();
  const semanas = [semanaActual, semanaActual + 1, semanaActual + 2];
  const [semana, setSemana] = useState(String(semanaActual + 1));
  const [recibiendo, setRecibiendo] = useState<Consolidado | null>(null);

  const productoById = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const lineas = useMemo(
    () => lineasSemanas(tablas, receta, [Number(semana)], semanaActual),
    [tablas, receta, semana, semanaActual],
  );
  const filas = useMemo(
    () => consolidar(lineas, recepciones, semanaActual),
    [lineas, recepciones, semanaActual],
  );

  const costoSemana = filas.reduce(
    (s, f) => s + f.cantidad * (productoById.get(f.productoId)?.precio ?? 0),
    0,
  );
  const pendientes = filas.filter((f) => f.status === "pendiente" || f.status === "parcial").length;
  const recibidas = lineas.filter((l) => estatusLinea(l, recepciones, semanaActual) === "recibido");

  return (
    <AppShell
      path="/compras"
      eyebrow="Compras · surtido por receta"
      title="Consolidado de compras"
      description="Cantidades calculadas con las hectáreas de cada etapa por la receta maestra. Se ven con 2 semanas de margen para cotizar mejor."
    >
      <Tabs value={semana} onValueChange={setSemana} className="mb-6">
        <TabsList>
          {semanas.map((w) => (
            <TabsTrigger key={w} value={String(w)}>
              {w === semanaActual ? `Esta semana · ${w}` : `Semana ${w}`}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat
          label={`Costo estimado sem ${semana}`}
          value={formatoMXN(costoSemana)}
          hint={`Entrega límite ${fechaLimite(Number(semana))}`}
          tone="primary"
        />
        <Stat label="Productos por surtir" value={pendientes} tone="soil" />
        <Stat label="Entradas registradas" value={recibidas.length} hint="Líneas por tabla" />
      </div>

      <div className="space-y-8">
        {RANCHOS.map((r) => {
          const deRancho = filas
            .filter((f) => f.ranchoId === r.id)
            .sort((a, b) => {
              const pa = productoById.get(a.productoId)!;
              const pb = productoById.get(b.productoId)!;
              return pa.familia.localeCompare(pb.familia) || pa.nombre.localeCompare(pb.nombre);
            });
          if (deRancho.length === 0) return null;
          const costo = deRancho.reduce(
            (s, f) => s + f.cantidad * (productoById.get(f.productoId)?.precio ?? 0),
            0,
          );
          return (
            <section
              key={r.id}
              className="overflow-hidden rounded-xl border border-border bg-card shadow-card"
            >
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-secondary/60 px-5 py-4">
                <div>
                  <h2 className="text-2xl font-semibold">{r.nombre}</h2>
                  <p className="text-xs text-muted-foreground">{r.ubicacion}</p>
                </div>
                <span className="num text-sm text-muted-foreground">{formatoMXN(costo)}</span>
              </header>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Producto</TableHead>
                    <TableHead>Familia</TableHead>
                    <TableHead className="text-right">Cantidad total</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead>Fecha límite</TableHead>
                    <TableHead>Estatus</TableHead>
                    <TableHead className="pr-5 text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deRancho.map((f) => {
                    const p = productoById.get(f.productoId)!;
                    const foto = f.keys.map((k) => recepciones[k]?.foto).find(Boolean);
                    return (
                      <TableRow key={`${f.ranchoId}-${f.productoId}`}>
                        <TableCell className="pl-5 font-medium">
                          <span className="inline-flex items-center gap-2">
                            {p.nombre}
                            {foto && (
                              <a href={foto} target="_blank" rel="noreferrer" title="Ver evidencia">
                                <ImageIcon className="size-3.5 text-primary" />
                              </a>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{p.familia}</TableCell>
                        <TableCell className="num text-right">{formatoNum(f.cantidad)}</TableCell>
                        <TableCell className="text-muted-foreground">{p.unidad}</TableCell>
                        <TableCell className="num text-muted-foreground">
                          {fechaLimite(f.semana)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={f.status}>{STATUS_LABEL[f.status]}</Badge>
                        </TableCell>
                        <TableCell className="pr-5 text-right">
                          {f.status === "pendiente" || f.status === "parcial" ? (
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="soft" onClick={() => setRecibiendo(f)}>
                                <Check /> Recibir
                              </Button>
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
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => marcar(f.keys, "pendiente")}
                            >
                              <RotateCcw /> Reabrir
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </section>
          );
        })}
        {filas.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            No hay insumos programados para esta semana.
          </p>
        )}
      </div>

      <RecibirDialog fila={recibiendo} onClose={() => setRecibiendo(null)} lineas={lineas} />
    </AppShell>
  );
}

function RecibirDialog({
  fila,
  onClose,
  lineas,
}: {
  fila: Consolidado | null;
  onClose: () => void;
  lineas: ReturnType<typeof lineasSemanas>;
}) {
  const { productos, recibir, tablas } = useCampo();
  const [cantidad, setCantidad] = useState<string | null>(null);
  const [foto, setFoto] = useState<string | undefined>();
  const p = fila ? productos.find((x) => x.id === fila.productoId) : undefined;
  const rancho = fila ? RANCHOS.find((r) => r.id === fila.ranchoId) : undefined;
  const valor = cantidad ?? (fila ? String(fila.cantidad) : "");

  const subLineas = fila ? lineas.filter((l) => fila.keys.includes(l.key)) : [];

  const cerrar = () => {
    setCantidad(null);
    setFoto(undefined);
    onClose();
  };

  const confirmar = () => {
    if (!fila || !p) return;
    const n = Number(valor);
    if (!(n >= 0)) return toast.error("Cantidad inválida");
    if (!foto) return toast.error("Agrega la foto de evidencia de la entrada");
    recibir(
      subLineas.map((l) => ({ key: l.key, cantidad: l.cantidad })),
      { cantidadTotal: n, foto },
    );
    toast.success(`${p.nombre} recibido en ${rancho?.nombre}`);
    cerrar();
  };

  return (
    <Dialog open={!!fila} onOpenChange={(o) => !o && cerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Registrar entrada</DialogTitle>
          <DialogDescription>
            {p?.nombre} · {rancho?.nombre}. El costo se asigna a cada tabla según su consumo.
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
            {fila && Number(valor) !== fila.cantidad && (
              <p className="text-xs text-soil-foreground">
                La receta indica {formatoNum(fila.cantidad)} {p?.unidad}. Diferencia:{" "}
                {formatoNum(Number(valor) - fila.cantidad)}.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Foto de evidencia</Label>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-muted/50 p-4 text-sm text-muted-foreground transition-colors hover:border-primary">
              {foto ? (
                <img src={foto} alt="Evidencia de entrada" className="max-h-40 rounded-md" />
              ) : (
                <>
                  <Camera className="size-5" />
                  Tomar o subir foto
                </>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setFoto(URL.createObjectURL(file));
                }}
              />
            </label>
          </div>

          <div className="rounded-lg bg-secondary p-3 text-xs">
            <span className="eyebrow">Se asigna a</span>
            <ul className="mt-2 space-y-1">
              {subLineas.map((l) => (
                <li key={l.key} className="flex justify-between">
                  <span>{tablas.find((t) => t.id === l.tablaId)?.nombre}</span>
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
