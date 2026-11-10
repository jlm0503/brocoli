import { createFileRoute } from "@tanstack/react-router";
import { Archive, RotateCcw, History, MapPinOff, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/campo/AppShell";
import { CatalogosExtra } from "@/components/campo/CatalogosExtra";
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
  FAMILIAS,
  estatusTabla,
  fechaCorta,
  fechaEnSemana,
  formatoNum,
  precioVigente,
  radioValidacion,
} from "@/lib/campo/calc";
import { useCampo } from "@/lib/campo/store";
import type { Familia, Producto, Tabla, Unidad } from "@/lib/campo/types";

export const Route = createFileRoute("/_authenticated/catalogos")({
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

const UNIDADES: Unidad[] = ["kg", "L", "rollo"];

const mxn2 = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });
const formatoMXN2 = (n: number) => mxn2.format(n);

function CambiarPrecio({ producto, onClose }: { producto: Producto | null; onClose: () => void }) {
  const { setPrecio, hoy } = useCampo();
  const [precio, setP] = useState("");
  const [desde, setDesde] = useState("");
  const fecha = desde || hoy;

  const guardar = () => {
    if (!producto) return;
    const err = setPrecio(producto.id, Number(precio), fecha);
    if (err) return void toast.error(err);
    toast.success(`${producto.nombre}: ${formatoMXN2(Number(precio))} desde el ${fechaCorta(fecha)}`);
    setP("");
    setDesde("");
    onClose();
  };

  return (
    <Dialog open={!!producto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Precio · {producto?.nombre}</DialogTitle>
          <DialogDescription>
            El nuevo precio aplica desde la fecha que elijas. Lo recibido antes conserva el precio que tenía.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cp-precio">Nuevo precio por {producto?.unidad} (MXN)</Label>
            <Input
              id="cp-precio"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={precio}
              onChange={(e) => setP(e.target.value)}
              className="num"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-desde">Aplica desde</Label>
            <Input id="cp-desde" type="date" value={fecha} onChange={(e) => setDesde(e.target.value)} className="num" />
          </div>
        </div>
        {producto && (
          <div className="rounded-lg bg-secondary p-3 text-xs">
            <p className="eyebrow mb-1">Historial</p>
            <ul className="num space-y-0.5">
              <li>Precio inicial: {formatoMXN2(producto.precio)}</li>
              {(producto.precios ?? []).map((c) => (
                <li key={c.desde}>
                  Desde el {fechaCorta(c.desde)} {c.desde.slice(0, 4)}: {formatoMXN2(c.precio)}
                </li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={precio === ""}>
            Guardar precio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Catalogos() {
  const { ranchos, tablas, lotes, productos, semanaActual, hoy } = useCampo();
  const [cambiandoPrecio, setCambiandoPrecio] = useState<Producto | null>(null);
  const [editandoProducto, setEditandoProducto] = useState<Producto | null>(null);
  const { eliminarRancho, eliminarTabla, reactivarTabla } = useCampo();
  const [retirando, setRetirando] = useState<Tabla | null>(null);
  const [verRetiradas, setVerRetiradas] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const [nuevoRancho, setNuevoRancho] = useState(false);
  const [nuevaTabla, setNuevaTabla] = useState(false);
  const quitar = (err: string | null, ok: string) => (err ? toast.error(err) : toast(ok));

  return (
    <AppShell
      path="/catalogos"
      eyebrow="Administrador · catálogos base"
      title="Catálogos"
      description={`Semanas ISO del 1 al 52, iniciando en lunes. Hoy es la semana ${semanaActual}: del ${fechaCorta(fechaEnSemana(semanaActual, 0))} al ${fechaCorta(fechaEnSemana(semanaActual, 6))}.`}
    >
      <Tabs defaultValue={ranchos.length === 0 ? "ranchos" : "productos"}>
        <TabsList className="mb-6">
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="tablas">Tablas</TabsTrigger>
          <TabsTrigger value="ranchos">Ranchos</TabsTrigger>
          <TabsTrigger value="cultivos">Cultivos y variedades</TabsTrigger>
          <TabsTrigger value="viveros">Viveros</TabsTrigger>
          <TabsTrigger value="choferes">Choferes</TabsTrigger>
          <TabsTrigger value="problemas">Problemas de calidad</TabsTrigger>
          <TabsTrigger value="congeladora">Congeladora</TabsTrigger>
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
                  <TableHead><span className="sr-only">Editar producto</span></TableHead>
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
                      <Button variant="ghost" size="sm"
                        onClick={() => setCambiandoPrecio(p)}
                        className={`num inline-flex items-center gap-1.5 rounded px-1.5 py-1 ${precioVigente(p, hoy) <= 0 ? "text-destructive" : ""}`}
                        aria-label={`Cambiar precio de ${p.nombre}`}
                      >
                        {precioVigente(p, hoy) <= 0 ? "Precio pendiente" : formatoMXN2(precioVigente(p, hoy))}
                        {(p.precios?.length ?? 0) > 0 && <History className="size-3 text-muted-foreground" />}
                        <Pencil className="size-3 text-muted-foreground" />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" aria-label={`Editar unidad y familia de ${p.nombre}`} title="Editar unidad y familia" onClick={() => setEditandoProducto(p)}>
                        <Pencil className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="tablas">
          <div className="mb-4 flex flex-wrap justify-between gap-2">
            <Button variant="outline" onClick={() => setVerRetiradas((v) => !v)} aria-pressed={verRetiradas}>
               <Archive /> {verRetiradas ? "Ver activas" : "Ver desactivadas"}
            </Button>
            <Button onClick={() => setNuevaTabla(true)} disabled={ranchos.length === 0}>
              <Plus /> Nueva tabla
            </Button>
          </div>
          {tablas.length === 0 && (
            <p className="mb-4 rounded-xl border border-dashed border-border bg-card/60 p-5 text-sm text-muted-foreground">
              {ranchos.length === 0
                ? "Primero agrega un rancho en la pestaña Ranchos."
                : "Aún no hay tablas. Agrega la primera con su rancho y hectáreas."}
            </p>
          )}
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Rancho</TableHead>
                  <TableHead>Tabla</TableHead>
                  <TableHead className="text-right">Hectáreas</TableHead>
                  <TableHead>Punto GPS central</TableHead>
                  <TableHead className="text-right">Radio de validación</TableHead>
                  <TableHead>Estatus</TableHead>
                  <TableHead className="pr-5" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tablas.filter((t) => !!t.archivada === verRetiradas).map((t) => {
                  const est = estatusTabla(t, lotes, semanaActual);
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="pl-5 text-muted-foreground">
                        {ranchos.find((r) => r.id === t.ranchoId)?.nombre}
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
                      <TableCell>
                        <Badge variant={t.archivada ? "gris" : est}>{t.archivada ? "Desactivada" : ESTATUS_TABLA_LABEL[est]}</Badge>
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={`${t.archivada ? "Activar" : "Desactivar"} ${t.nombre}`}
                          title={t.archivada ? "Activar tabla" : "Desactivar sin borrar históricos"}
                          onClick={() => t.archivada ? reactivarTabla(t.id) : setRetirando(t)}
                        >
                          {t.archivada ? <RotateCcw /> : <Archive />}
                          {t.archivada ? "Activar" : "Desactivar"}
                        </Button>
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
          <div className="mb-4 flex justify-end">
            <Button onClick={() => setNuevoRancho(true)}>
              <Plus /> Nuevo rancho
            </Button>
          </div>
          {ranchos.length === 0 && (
            <p className="mb-4 rounded-xl border border-dashed border-border bg-card/60 p-5 text-sm text-muted-foreground">
              Aún no hay ranchos. Agrega el primero y después sus tablas.
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            {ranchos.map((r) => {
              const ts = tablas.filter((t) => t.ranchoId === r.id && !t.archivada);
              return (
                <article key={r.id} className="rounded-xl border border-border bg-card p-5 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-2xl font-semibold">{r.nombre}</h3>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      aria-label={`Eliminar ${r.nombre}`}
                      onClick={() => quitar(eliminarRancho(r.id), `${r.nombre} eliminado`)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">Zona: {r.zona}</p>
                  <p className="num mt-3 text-sm">
                    {ts.length} tablas · {formatoNum(ts.reduce((s, t) => s + t.hectareas, 0))} ha
                  </p>
                </article>
              );
            })}
          </div>
        </TabsContent>

        <CatalogosExtra />
      </Tabs>

      <CambiarPrecio producto={cambiandoPrecio} onClose={() => setCambiandoPrecio(null)} />
      {editandoProducto && <EditarProducto key={editandoProducto.id} producto={editandoProducto} onClose={() => setEditandoProducto(null)} />}
      <Dialog open={!!retirando} onOpenChange={(o) => !o && setRetirando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desactivar tabla {retirando?.nombre}</DialogTitle>
            <DialogDescription>Dejará de estar disponible para nuevas plantaciones. Sus históricos, consumos, gastos y viajes se conservan.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRetirando(null)}>Cancelar</Button>
            <Button onClick={() => {
              if (!retirando) return;
              const error = eliminarTabla(retirando.id);
              if (error) return void toast.error(error);
              toast.success("Tabla desactivada; históricos conservados.");
              setRetirando(null);
            }}><Archive /> Desactivar tabla</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <NuevoProducto open={nuevo} onClose={() => setNuevo(false)} />
      <NuevoRancho open={nuevoRancho} onClose={() => setNuevoRancho(false)} />
      <NuevaTabla open={nuevaTabla} onClose={() => setNuevaTabla(false)} />
    </AppShell>
  );
}

function NuevoRancho({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { agregarRancho } = useCampo();
  const [nombre, setNombre] = useState("");
  const [zona, setZona] = useState("");

  const guardar = () => {
    const err = agregarRancho(nombre, zona);
    if (err) return void toast.error(err);
    toast.success(`Rancho ${nombre.trim()} agregado`);
    setNombre("");
    setZona("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Nuevo rancho</DialogTitle>
          <DialogDescription>Después agrega sus tablas en la pestaña Tablas.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nr-nombre">Nombre</Label>
            <Input id="nr-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nr-zona">Zona (opcional)</Label>
            <Input id="nr-zona" value={zona} onChange={(e) => setZona(e.target.value)} />
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

function NuevaTabla({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ranchos, agregarTabla } = useCampo();
  const [ranchoElegido, setRanchoId] = useState("");
  const ranchoId = ranchos.some((r) => r.id === ranchoElegido) ? ranchoElegido : (ranchos[0]?.id ?? "");
  const [nombre, setNombre] = useState("");
  const [ha, setHa] = useState("");

  const guardar = () => {
    const err = agregarTabla({ ranchoId, nombre, hectareas: Number(ha) });
    if (err) return void toast.error(err);
    toast.success(`${nombre.trim()} agregada`);
    // Se queda abierto el mismo rancho para capturar varias tablas seguidas.
    setNombre("");
    setHa("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Nueva tabla</DialogTitle>
          <DialogDescription>Puedes agregar varias seguidas; la ventana se queda abierta.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Rancho</Label>
            <Select value={ranchoId} onValueChange={setRanchoId}>
              <SelectTrigger aria-label="Rancho">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ranchos.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nt-nombre">Nombre</Label>
            <Input id="nt-nombre" placeholder="Tabla 1" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nt-ha">Hectáreas</Label>
            <Input
              id="nt-ha"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={ha}
              onChange={(e) => setHa(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && guardar()}
              className="num"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Listo
          </Button>
          <Button onClick={guardar}>Agregar tabla</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditarProducto({ producto, onClose }: { producto: Producto; onClose: () => void }) {
  const { editarProducto } = useCampo();
  const [familia, setFamilia] = useState<Familia>(producto.familia);
  const [unidad, setUnidad] = useState<Unidad>(producto.unidad);
  const guardar = () => {
    const error = editarProducto(producto.id, { familia, unidad });
    if (error) return void toast.error(error);
    toast.success(`${producto.nombre} actualizado`);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar · {producto.nombre}</DialogTitle>
          <DialogDescription>Código {producto.codigo}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ep-familia">Familia</Label>
            <Select value={familia} onValueChange={(v) => setFamilia(v as Familia)}>
              <SelectTrigger id="ep-familia"><SelectValue /></SelectTrigger>
              <SelectContent>{FAMILIAS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ep-unidad">Unidad de medida</Label>
            <Select value={unidad} onValueChange={(v) => setUnidad(v as Unidad)}>
              <SelectTrigger id="ep-unidad"><SelectValue /></SelectTrigger>
              <SelectContent>{UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar}>Guardar cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
