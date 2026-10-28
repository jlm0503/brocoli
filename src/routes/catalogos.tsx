import { createFileRoute } from "@tanstack/react-router";
import { MapPinOff, MapPin, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/campo/AppShell";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ESTATUS_TABLA_LABEL,
  estatusTabla,
  fechaCorta,
  fechaEnSemana,
  formatoNum,
  radioValidacion,
} from "@/lib/campo/calc";
import { RANCHOS } from "@/lib/campo/seed";
import { useCampo } from "@/lib/campo/store";
import type { Familia, Unidad } from "@/lib/campo/types";

export const Route = createFileRoute("/catalogos")({
  head: () => ({
    meta: [
      { title: "Catálogos · Brócoli" },
      {
        name: "description",
        content: "Ranchos, tablas con ubicación y radio de validación, y productos con código único y precio.",
      },
      { property: "og:title", content: "Catálogos · Brócoli" },
      {
        property: "og:description",
        content: "Catálogos base del control de insumos: ranchos, tablas y productos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Catalogos,
});

const FAMILIAS: Familia[] = [
  "Suelo",
  "Agroquímico",
  "Riego",
  "Fertilizante",
  "Bioestimulante",
  "Micronutriente",
  "Fungicida",
  "Insecticida",
  "Herbicida",
];
const UNIDADES: Unidad[] = ["kg", "L", "rollo"];

function Catalogos() {
  const { tablas, lotes, productos, semanaActual, setPrecio } = useCampo();
  const [nuevo, setNuevo] = useState(false);

  return (
    <AppShell
      path="/catalogos"
      eyebrow="Administrador · catálogos base"
      title="Catálogos"
      description={`Semanas ISO del 1 al 52, iniciando en lunes. Hoy es la semana ${semanaActual}: del ${fechaCorta(fechaEnSemana(semanaActual, 0))} al ${fechaCorta(fechaEnSemana(semanaActual, 6))}.`}
    >
      <Tabs defaultValue="productos">
        <TabsList className="mb-6">
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="tablas">Tablas</TabsTrigger>
          <TabsTrigger value="ranchos">Ranchos</TabsTrigger>
        </TabsList>

        <TabsContent value="productos">
          <div className="mb-4 flex justify-end">
            <Button onClick={() => setNuevo(true)}>
              <Plus /> Nuevo producto
            </Button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Código</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Familia</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead className="pr-5 text-right">Precio unitario (MXN)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="num pl-5">{p.codigo}</TableCell>
                    <TableCell className="font-medium">{p.nombre}</TableCell>
                    <TableCell className="text-muted-foreground">{p.familia}</TableCell>
                    <TableCell className="text-muted-foreground">{p.unidad}</TableCell>
                    <TableCell className="pr-5 text-right">
                      <input
                        type="number"
                        min="0"
                        value={p.precio}
                        onChange={(e) => setPrecio(p.id, Number(e.target.value))}
                        className="num w-24 rounded border border-transparent bg-transparent px-1.5 py-1 text-right hover:border-input focus:border-ring focus:outline-none"
                        aria-label={`Precio de ${p.nombre}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="tablas">
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Rancho</TableHead>
                  <TableHead>Tabla</TableHead>
                  <TableHead className="text-right">Hectáreas</TableHead>
                  <TableHead>Punto GPS central</TableHead>
                  <TableHead className="text-right">Radio de validación</TableHead>
                  <TableHead className="pr-5">Estatus</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tablas.map((t) => {
                  const est = estatusTabla(t, lotes);
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="pl-5 text-muted-foreground">
                        {RANCHOS.find((r) => r.id === t.ranchoId)?.nombre}
                      </TableCell>
                      <TableCell className="font-medium">{t.nombre}</TableCell>
                      <TableCell className="num text-right">{formatoNum(t.hectareas)}</TableCell>
                      <TableCell>
                        {t.gps ? (
                          <span className="num inline-flex items-center gap-1 text-xs">
                            <MapPin className="size-3.5 text-primary" />
                            {t.gps.lat.toFixed(4)}, {t.gps.lng.toFixed(4)}
                          </span>
                        ) : (
                          <Badge variant="gris">
                            <MapPinOff className="mr-1 size-3" /> Sin ubicación
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="num text-right">
                        {formatoNum(radioValidacion(t))} m
                        <div className="text-xs text-muted-foreground">{t.radio ? "manual" : "automático"}</div>
                      </TableCell>
                      <TableCell className="pr-5">
                        <Badge variant={est}>{ESTATUS_TABLA_LABEL[est]}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Radio automático = √(ha × 10,000 ÷ 3.1416) × 1.5, mínimo 100 m. Guardar ubicación con
            el GPS del teléfono llega en la fase 3.
          </p>
        </TabsContent>

        <TabsContent value="ranchos">
          <div className="grid gap-4 md:grid-cols-3">
            {RANCHOS.map((r) => {
              const ts = tablas.filter((t) => t.ranchoId === r.id);
              return (
                <article key={r.id} className="rounded-xl border border-border bg-card p-5 shadow-card">
                  <h3 className="text-2xl font-semibold">{r.nombre}</h3>
                  <p className="text-sm text-muted-foreground">Zona: {r.zona}</p>
                  <p className="num mt-3 text-sm">
                    {ts.length} tablas · {formatoNum(ts.reduce((s, t) => s + t.hectareas, 0))} ha
                  </p>
                </article>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <NuevoProducto open={nuevo} onClose={() => setNuevo(false)} />
    </AppShell>
  );
}

function NuevoProducto({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { agregarProducto } = useCampo();
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [familia, setFamilia] = useState<Familia>("Fertilizante");
  const [unidad, setUnidad] = useState<Unidad>("kg");
  const [precio, setPrecioV] = useState("");

  const guardar = () => {
    const err = agregarProducto({ codigo, nombre, familia, unidad, precio: Number(precio) || 0 });
    if (err) return void toast.error(err);
    toast.success(`${nombre} agregado al catálogo`);
    setCodigo("");
    setNombre("");
    setPrecioV("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Nuevo producto</DialogTitle>
          <DialogDescription>El código debe ser único; sirve para cruzar con otras apps.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="np-codigo">Código</Label>
            <Input id="np-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} className="num uppercase" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="np-nombre">Nombre</Label>
            <Input id="np-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Familia</Label>
            <Select value={familia} onValueChange={(v) => setFamilia(v as Familia)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FAMILIAS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Unidad</Label>
            <Select value={unidad} onValueChange={(v) => setUnidad(v as Unidad)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIDADES.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="np-precio">Precio unitario estimado (MXN)</Label>
            <Input
              id="np-precio"
              type="number"
              inputMode="decimal"
              value={precio}
              onChange={(e) => setPrecioV(e.target.value)}
              className="num"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar}>Agregar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
