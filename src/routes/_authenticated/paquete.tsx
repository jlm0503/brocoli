import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, Stat } from "@/components/campo/AppShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FAMILIAS,
  SEMANA_PLANEACION,
  cintaPlaneacion,
  nombreCultivo,
  precioVigente,
  recetaDe,
  SEMANAS_RECETA,
  etapa,
  formatoMXN,
  formatoNum,
  semanasReceta,
} from "@/lib/campo/calc";
import { puedeCapturar } from "@/lib/campo/roles";
import { useSesion } from "@/lib/campo/sesion";
import { useCampo } from "@/lib/campo/store";
import type { Adicional, Cultivo } from "@/lib/campo/types";

export const Route = createFileRoute("/_authenticated/paquete")({
  head: () => ({
    meta: [
      { title: "Paquete tecnológico · Brócoli" },
      {
        name: "description",
        content:
          "Receta base por semana de cultivo, de la planeación (-2) al cierre (12), y productos adicionales por tabla.",
      },
      { property: "og:title", content: "Paquete tecnológico · Brócoli" },
      {
        property: "og:description",
        content: "Dosis por hectárea en cada semana de receta y adicionales por tabla.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Paquete,
});


const ETAPA_CORTA: Record<string, string> = {
  Planeación: "Plan.",
  Preparación: "Prep.",
  Plantación: "Plant.",
  Desarrollo: "Desarr.",
  Cosecha: "Cosecha",
  "Máxima cosecha y cierre": "Cierre",
};

function Paquete() {
  const { roles } = useSesion();
  const captura = puedeCapturar(roles, "/paquete");
  const { productos, recetas, variedades, cultivos, setDosis, parametro, hoy } = useCampo();
  const [programa, setPrograma] = useState("trejo-coliflor");
  const cultivo: Cultivo = programa === "otros-brocoli" ? "brocoli" : "coliflor";
  const paqueteId = programa;
  const base = recetaDe(recetas, cultivo);
  const paquete = base.variantes?.find((p) => p.id === paqueteId);
  const receta = paquete ? { dosis: paquete.dosis } : { dosis: {} };
  const variedad = variedades.find((v) => v.cultivo === cultivo);
  const cinta = cintaPlaneacion(productos, parametro("rollosCintaHa", hoy, variedad?.id));
  const precioHoy = (p: (typeof productos)[number]) => precioVigente(p, hoy);
  /** Dosis por ha de la celda; la cinta de la semana -2 sale del parámetro de rollos por ha. */
  const dosis = (w: number, pid: string) =>
    w === SEMANA_PLANEACION && pid === cinta?.productoId ? cinta.porHa : (receta.dosis[w]?.[pid] ?? 0);
  const SEMANAS = useMemo(() => [...new Set([...semanasReceta(cultivo, variedades), ...Object.keys(receta.dosis).map(Number)])].sort((a, b) => a - b), [cultivo, variedades, receta]);
  const vacia = Object.values(receta.dosis).every((sem) => Object.values(sem).every((d) => !(d > 0)));
  const productosPaquete = productos.filter((p) => Object.values(receta.dosis).some((sem) => (sem[p.id] ?? 0) > 0));
  const categoriaVisual = (p: (typeof productos)[number]) =>
    p.familia === "Fertilizante" ? "Fertilizantes" : p.familia;
  const sinPrecio = productosPaquete.filter(
    (p) => precioHoy(p) <= 0 && SEMANAS.some((w) => dosis(w, p.id) > 0),
  );

  const costoSemana = useMemo(
    () =>
      SEMANAS.map((w) =>
        productosPaquete.reduce((s, p) => s + dosis(w, p.id) * precioHoy(p), 0),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productos, receta, SEMANAS, cinta?.porHa, hoy],
  );
  const costoCiclo = costoSemana.reduce((s, c) => s + c, 0);
  const costoPlaneacion = costoSemana[0] ?? 0;
  const max = Math.max(...costoSemana);
  const picoW = SEMANAS[costoSemana.indexOf(max)] ?? 0;

  return (
    <AppShell
      path="/paquete"
      eyebrow="Administrador · paquetes"
      title="Paquete tecnológico"
      description="Dosis por hectárea · vigencias y costos"
    >
      <Tabs value={programa} onValueChange={setPrograma} className="mb-4">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="trejo-coliflor">Trejo · Coliflor</TabsTrigger>
          <TabsTrigger value="otros-brocoli">Otros · Brócoli</TabsTrigger>
          <TabsTrigger value="otros-coliflor">Otros · Coliflor</TabsTrigger>
        </TabsList>
      </Tabs>
      {paquete && <section className="mb-5 space-y-2 text-sm">
        <p className="font-medium">{nombreCultivo(cultivos, cultivo)} · vigente desde {paquete.desde.split("-").reverse().join("/")}</p>
        <p>{programa === "trejo-coliflor" ? "Todas las coliflores de Trejo" : "Todos los ranchos excepto Trejo"}</p>
      </section>}
      <p className="mb-6 text-sm text-muted-foreground">
        Variedades:{" "}
        {variedades
          .filter((v) => v.cultivo === cultivo)
          .map((v) => `${v.nombre} (${v.cicloDias} días, cosecha en semana ${Math.ceil(v.cicloDias / 7)})`)
          .join(" · ")}
      </p>
      {vacia && (
        <div className="mb-6 rounded-xl border border-dashed border-soil/50 bg-soil-soft/50 p-4 text-sm">
          Receta de {nombreCultivo(cultivos, cultivo).toLowerCase()} pendiente. Mientras esté vacía, sus
          lotes solo piden la cinta en el paquete de planeación.
        </div>
      )}
      {sinPrecio.length > 0 && (
        <div className="mb-6 rounded-xl border border-destructive/40 bg-destructive-soft p-4 text-sm">
          Sin precio todavía (cuentan como $0 en los costos):{" "}
          <span className="font-medium">{sinPrecio.map((p) => p.nombre).join(", ")}</span>. Agrégalo en
          Catálogos.
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Costo por ha del ciclo"
          value={formatoMXN(costoCiclo)}
          hint={`Incluye ${formatoMXN(costoPlaneacion)} de planeación`}
          tone="primary"
        />
        <Stat
          label="Semana de mayor gasto"
          value={`Sem ${picoW}`}
          hint={`${formatoMXN(max)} por ha · ${etapa(picoW)}`}
          tone="soil"
        />
        <Stat label="Productos del paquete" value={productosPaquete.length} hint="Precios en Catálogos" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/60 text-left">
              <th className="sticky left-0 z-10 bg-secondary px-4 py-3 font-medium">Producto</th>
              <th className="px-2 py-3 font-medium">Unidad</th>
              {SEMANAS.map((w) => (
                <th
                  key={w}
                  className={`num px-1 py-2 text-center text-xs font-medium ${w < 0 ? "bg-soil-soft text-soil-foreground" : ""}`}
                >
                  S{w}
                  <div className="font-sans text-[0.6rem] font-normal opacity-70">
                    {ETAPA_CORTA[etapa(w)]}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...FAMILIAS, "Familia por actualizar"].map((fam) => {
              const items = productosPaquete
                .filter((p) => fam === "Familia por actualizar" ? !FAMILIAS.includes(categoriaVisual(p)) : categoriaVisual(p) === fam)
                .sort((a, b) => a.id === cinta?.productoId ? -1 : b.id === cinta?.productoId ? 1 : a.nombre.localeCompare(b.nombre, "es-MX"));
              if (items.length === 0) return null;
              return (
                <Fragment key={fam}>
                  <tr className="border-y border-border bg-secondary">
                    <th colSpan={2} scope="rowgroup" className="sticky left-0 z-10 bg-secondary px-4 py-3 text-left text-sm font-semibold text-foreground">
                      {fam} <span className="ml-2 text-xs font-normal text-muted-foreground">({items.length})</span>
                    </th>
                    <td colSpan={SEMANAS.length} className="bg-secondary" />
                  </tr>
                  {items.map((p) => (
                    <tr key={p.id} className="border-b border-border/60 last:border-0">
                      <td className="sticky left-0 z-10 bg-card px-4 py-1.5 whitespace-nowrap">
                        <span className="num mr-2 text-xs text-muted-foreground">{p.codigo}</span>
                        <span className="font-medium">{p.nombre}</span>
                        {precioHoy(p) <= 0 && (
                          <span className="ml-2 text-[0.65rem] text-destructive">sin precio</span>
                        )}
                      </td>
                      <td className="px-2 text-muted-foreground">
                        {p.unidad === "rollo" ? "rollos" : p.unidad}/ha
                      </td>
                      {SEMANAS.map((w) => {
                        const v = dosis(w, p.id);
                        if (w === SEMANA_PLANEACION && p.id === cinta?.productoId)
                          return (
                            <td key={w} className="bg-soil-soft/40 px-0.5 py-1">
                              <span
                                title="Se toma de Parámetros (rollos de cinta por hectárea)"
                                className="num block w-full min-w-11 rounded bg-soil-soft px-0.5 py-1.5 text-center text-xs text-soil-foreground"
                              >
                                {formatoNum(v)}
                              </span>
                            </td>
                          );
                        return (
                          <td key={w} className={`px-0.5 py-1 ${w < 0 ? "bg-soil-soft/40" : ""}`}>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={v === 0 ? "" : v}
                              placeholder="·"
                              disabled={!captura || !paquete}
                              onChange={(e) => setDosis(cultivo, p.id, w, Number(e.target.value), paqueteId)}
                              className={`num w-full min-w-11 rounded px-0.5 py-1.5 text-center text-xs focus:ring-1 focus:ring-ring focus:outline-none ${v > 0 ? (w < 0 ? "bg-soil-soft text-soil-foreground" : "bg-primary-soft text-accent-foreground") : "bg-transparent hover:bg-muted"}`}
                              aria-label={`${p.nombre} semana ${w}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-ink text-ink-foreground">
              <td className="sticky left-0 z-10 bg-ink px-4 py-3 font-medium" colSpan={2}>
                Costo por ha en la semana
              </td>
              {costoSemana.map((c, i) => (
                <td key={i} className="num px-1 py-3 text-center text-[0.7rem]">
                  {c > 0 ? `$${Math.round(c).toLocaleString("es-MX")}` : "—"}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Rollos de {cinta ? productos.find((p) => p.id === cinta.productoId)?.nombre.toLowerCase() : "cinta"} en la
        semana -2: salen de Parámetros ({formatoNum(cinta?.porHa ?? 0)} por ha), se piden completos en cada lote y
        su costo se carga al 100% al lote. Las semanas sin productos se quedan vacías.
      </p>

    </AppShell>
  );
}

function Adicionales() {
  const { ranchos, adicionales, productos, tablas, eliminarAdicional } = useCampo();
  const [editando, setEditando] = useState<Adicional | "nuevo" | null>(null);

  return (
    <section className="mt-12">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold">Adicionales por tabla</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Productos extra que solo aplican a ciertas tablas. Se suman a la receta base de esa
            semana.
          </p>
        </div>
        <Button onClick={() => setEditando("nuevo")}>
          <Plus /> Nuevo adicional
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {adicionales.map((a) => {
          const p = productos.find((x) => x.id === a.productoId);
          const rancho = ranchos.find((r) => r.id === a.ranchoId);
          return (
            <article key={a.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">
                    {p?.nombre} <span className="font-normal text-muted-foreground">· {a.motivo}</span>
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {rancho?.nombre} ·{" "}
                    {a.tablaIds.map((id) => tablas.find((t) => t.id === id)?.nombre).join(", ")}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setEditando(a)}>
                    <Pencil />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Eliminar"
                    onClick={() => {
                      eliminarAdicional(a.id);
                      toast("Adicional eliminado");
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <p className="num mt-3 text-sm">
                {formatoNum(a.dosis)} {p?.unidad}/ha · semana{a.semanas.length > 1 ? "s" : ""}{" "}
                {[...a.semanas].sort((x, y) => x - y).join(", ")}
              </p>
            </article>
          );
        })}
        {adicionales.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground md:col-span-2">
            Sin adicionales.
          </p>
        )}
      </div>

      <AdicionalDialog
        key={editando === null ? "x" : editando === "nuevo" ? "nuevo" : editando.id}
        valor={editando}
        onClose={() => setEditando(null)}
      />
    </section>
  );
}

function AdicionalDialog({ valor, onClose }: { valor: Adicional | "nuevo" | null; onClose: () => void }) {
  const { ranchos, productos, tablas, guardarAdicional } = useCampo();
  const inicial = valor && valor !== "nuevo" ? valor : null;
  const [ranchoId, setRanchoId] = useState(inicial?.ranchoId ?? ranchos[0]?.id ?? "");
  const [tablaIds, setTablaIds] = useState<string[]>(inicial?.tablaIds ?? []);
  const [productoId, setProductoId] = useState(inicial?.productoId ?? "");
  const [semanas, setSemanas] = useState<string[]>(inicial?.semanas.map(String) ?? []);
  const [dosis, setDosisV] = useState(inicial ? String(inicial.dosis) : "");
  const [motivo, setMotivo] = useState(inicial?.motivo ?? "");
  const deRancho = tablas.filter((t) => t.ranchoId === ranchoId && !t.archivada);

  const guardar = () => {
    if (tablaIds.length === 0) return void toast.error("Elige al menos una tabla");
    if (!productoId) return void toast.error("Elige el producto");
    if (semanas.length === 0) return void toast.error("Elige al menos una semana de receta");
    if (!(Number(dosis) > 0)) return void toast.error("Indica la cantidad por hectárea");
    if (!motivo.trim()) return void toast.error("Escribe el motivo");
    guardarAdicional({
      id: inicial?.id ?? `ad-${Date.now()}`,
      ranchoId,
      tablaIds,
      productoId,
      semanas: semanas.map(Number),
      dosis: Number(dosis),
      motivo: motivo.trim(),
    });
    toast.success("Adicional guardado. Aplica a los lotes que se planten de aquí en adelante.");
    onClose();
  };

  return (
    <Dialog open={valor !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {inicial ? "Editar adicional" : "Nuevo adicional"}
          </DialogTitle>
          <DialogDescription>Ej. Starkop para corrección de pH en algunas tablas.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Rancho</Label>
              <Select
                value={ranchoId}
                onValueChange={(v) => {
                  setRanchoId(v);
                  setTablaIds([]);
                }}
              >
                <SelectTrigger>
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
              <Label>Producto</Label>
              <Select value={productoId} onValueChange={setProductoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Elige" />
                </SelectTrigger>
                <SelectContent>
                  {productos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.codigo} · {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tablas</Label>
            <div className="flex flex-wrap gap-3">
              {deRancho.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={tablaIds.includes(t.id)}
                    onCheckedChange={(c) =>
                      setTablaIds((ids) => (c ? [...ids, t.id] : ids.filter((x) => x !== t.id)))
                    }
                  />
                  {t.nombre}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Semanas de receta</Label>
            <ToggleGroup type="multiple" value={semanas} onValueChange={setSemanas} className="flex-wrap justify-start">
              {SEMANAS_RECETA.map((w) => (
                <ToggleGroupItem
                  key={w}
                  value={String(w)}
                  className="num h-8 min-w-9 px-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {w}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ad-dosis">Cantidad por ha</Label>
              <Input
                id="ad-dosis"
                type="number"
                inputMode="decimal"
                value={dosis}
                onChange={(e) => setDosisV(e.target.value)}
                className="num"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ad-motivo">Motivo</Label>
              <Input id="ad-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
