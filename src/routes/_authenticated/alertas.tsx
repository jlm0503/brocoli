import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ArrowRightLeft, ImageIcon, Warehouse } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, Stat } from "@/components/campo/AppShell";
import { FotoInput, VerEvidencia } from "@/components/campo/Evidencia";
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
import {
  DIAS_ALERTA_ROJA,
  alertaVencida,
  diasEntre,
  fechaCorta,
  formatoMXN,
  formatoNum,
  sumarPorProducto,
} from "@/lib/campo/calc";
import { useCampo } from "@/lib/campo/store";
import type { AlertaInsumos, OpcionTardia } from "@/lib/campo/types";

export const Route = createFileRoute("/_authenticated/alertas")({
  head: () => ({
    meta: [
      { title: "Alertas y reportes · Brócoli" },
      {
        name: "description",
        content:
          "Insumos de lotes cancelados por reubicar o recolectar, y reporte de planeaciones con menos de dos semanas de anticipación.",
      },
      { property: "og:title", content: "Alertas y reportes · Brócoli" },
      {
        property: "og:description",
        content: "Insumos por reubicar o recolectar y planeaciones tardías.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Alertas,
});

const OPCION_LABEL: Record<OpcionTardia, string> = {
  "usar-pendientes": "Usó insumos de pendientes",
  "pedir-nuevos": "Pidió nuevos",
  "sin-pendientes": "Sin pendientes · urgente",
};

function Alertas() {
  const { ranchos, alertas, tardias, tablas, productos, inventarioAlmacen, hoy } = useCampo();
  const [resolviendo, setResolviendo] = useState<AlertaInsumos | null>(null);
  const abiertas = alertas.filter((a) => a.status === "abierta");
  const cerradas = alertas.filter((a) => a.status !== "abierta");
  const precio = new Map(productos.map((p) => [p.id, p]));
  const valor = (a: AlertaInsumos) =>
    a.items.reduce((s, i) => s + i.cantidad * (precio.get(i.productoId)?.precio ?? 0), 0);
  const tabla = (id: string) => tablas.find((t) => t.id === id)?.nombre;
  const rancho = (id: string) => ranchos.find((r) => r.id === id)?.nombre;
  const inventario = Object.entries(inventarioAlmacen).filter(([, c]) => c > 0);

  return (
    <AppShell
      path="/alertas"
      eyebrow="Administrador · almacén general"
      title="Alertas y reportes"
      description={`Cuando se cancela un lote con insumos ya entregados, quedan por reubicar o recolectar. Las alertas abiertas más de ${DIAS_ALERTA_ROJA} días se marcan en rojo.`}
    >
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Alertas abiertas" value={abiertas.length} tone="soil" />
        <Stat
          label="Vencidas"
          value={abiertas.filter((a) => alertaVencida(a, hoy)).length}
          hint={`Más de ${DIAS_ALERTA_ROJA} días`}
        />
        <Stat label="Planeaciones tardías" value={tardias.length} tone="primary" />
      </div>

      <h2 className="mb-4 text-2xl font-semibold">Insumos por reubicar o recolectar</h2>
      <div className="space-y-3">
        {abiertas.map((a) => {
          const roja = alertaVencida(a, hoy);
          return (
            <article
              key={a.id}
              className={`rounded-xl border p-5 shadow-card ${roja ? "border-destructive bg-destructive-soft" : "border-border bg-card"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold">
                    {roja && <AlertTriangle className="size-4 text-destructive" />}
                    {rancho(a.ranchoId)} · {tabla(a.tablaId)} · Lote {a.loteCodigo}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Abierta desde {fechaCorta(a.fecha)} · {diasEntre(a.fecha, hoy)} días ·{" "}
                    {formatoMXN(valor(a))}
                  </p>
                </div>
                <Button size="sm" onClick={() => setResolviendo(a)}>
                  Resolver
                </Button>
              </div>
              <ul className="mt-3 flex flex-wrap gap-2 text-xs">
                {[...sumarPorProducto(a.items).entries()].map(([pid, c]) => (
                  <li key={pid} className="rounded-md bg-secondary px-2 py-1">
                    {precio.get(pid)?.nombre}{" "}
                    <span className="num">
                      {formatoNum(c)} {precio.get(pid)?.unidad}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
        {abiertas.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No hay insumos pendientes de reubicar o recolectar.
          </p>
        )}
      </div>

      {cerradas.length > 0 && (
        <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
          {cerradas.map((a) => (
            <li key={a.id} className="flex items-center gap-2">
              <Badge variant="verde">{a.status === "reubicada" ? "Reubicada" : "Recolectada"}</Badge>
              {tabla(a.tablaId)} · Lote {a.loteCodigo} · {fechaCorta(a.fechaCierre ?? a.fecha)}
              {a.recolecto && ` · recolectó ${a.recolecto}`}
              {a.foto && (
                <VerEvidencia foto={a.foto} title="Ver foto">
                  <ImageIcon className="size-3.5 text-primary" />
                </VerEvidencia>
              )}
            </li>
          ))}
        </ul>
      )}

      {inventario.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-card">
          <h3 className="flex items-center gap-2 font-semibold">
            <Warehouse className="size-4" /> Regresado al inventario del almacén general
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2 text-xs">
            {inventario.map(([pid, c]) => (
              <li key={pid} className="rounded-md bg-secondary px-2 py-1">
                {precio.get(pid)?.nombre} <span className="num">{formatoNum(c)} {precio.get(pid)?.unidad}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mt-12 mb-4 text-2xl font-semibold">Planeaciones tardías</h2>
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Fecha</TableHead>
              <TableHead>Ingeniero</TableHead>
              <TableHead>Rancho</TableHead>
              <TableHead>Tabla · lote</TableHead>
              <TableHead className="text-right">Anticipación</TableHead>
              <TableHead className="pr-5">Opción elegida</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tardias.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="num pl-5">{fechaCorta(t.fecha)}</TableCell>
                <TableCell>{t.ingeniero}</TableCell>
                <TableCell>{rancho(t.ranchoId)}</TableCell>
                <TableCell>
                  {tabla(t.tablaId)} · {t.loteCodigo}
                </TableCell>
                <TableCell className="num text-right">{t.semanasAnticipacion} sem</TableCell>
                <TableCell className="pr-5">
                  {OPCION_LABEL[t.opcion]}
                  {t.motivo && <div className="text-xs text-muted-foreground">{t.motivo}</div>}
                  {t.lotesUsados && (
                    <div className="text-xs text-muted-foreground">De: {t.lotesUsados.join(", ")}</div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {tardias.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Sin planeaciones tardías.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ResolverDialog
        key={resolviendo?.id ?? "x"}
        alerta={resolviendo}
        onClose={() => setResolviendo(null)}
      />
    </AppShell>
  );
}

function ResolverDialog({ alerta, onClose }: { alerta: AlertaInsumos | null; onClose: () => void }) {
  const { ranchos, lotes, tablas, hoy, resolverAlerta } = useCampo();
  const [tipo, setTipo] = useState<"reubicar" | "recolectar">("reubicar");
  const [loteId, setLoteId] = useState("");
  const [quien, setQuien] = useState("");
  const [foto, setFoto] = useState<string | undefined>();
  const destinos = lotes.filter((l) => !l.cancelado && l.avances.length === 0);

  const confirmar = () => {
    if (!alerta) return;
    const err =
      tipo === "reubicar"
        ? resolverAlerta(alerta.id, { tipo, loteId })
        : resolverAlerta(alerta.id, { tipo, quien, foto: foto ?? "" });
    if (err) return void toast.error(err);
    toast.success(tipo === "reubicar" ? "Insumos reubicados; el costo pasa a ese lote" : "Recolección registrada");
    onClose();
  };

  return (
    <Dialog open={!!alerta} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Resolver alerta</DialogTitle>
          <DialogDescription>Lote {alerta?.loteCodigo}. Elige qué pasó con los insumos.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Button variant={tipo === "reubicar" ? "default" : "outline"} onClick={() => setTipo("reubicar")}>
            <ArrowRightLeft /> Reubicar
          </Button>
          <Button variant={tipo === "recolectar" ? "default" : "outline"} onClick={() => setTipo("recolectar")}>
            <Warehouse /> Recolectado
          </Button>
        </div>
        {tipo === "reubicar" ? (
          <div className="space-y-2">
            <Label>Lote destino (cualquier rancho)</Label>
            <Select value={loteId} onValueChange={setLoteId}>
              <SelectTrigger>
                <SelectValue placeholder="Elige un lote" />
              </SelectTrigger>
              <SelectContent>
                {destinos.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {ranchos.find((r) => r.id === l.ranchoId)?.nombre} · {tablas.find((t) => t.id === l.tablaId)?.nombre} · {l.codigo} (sem {l.semanaPlaneada})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="rec-quien">Recolectó</Label>
                <Input id="rec-quien" value={quien} onChange={(e) => setQuien(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input value={fechaCorta(hoy)} disabled />
              </div>
            </div>
            <FotoInput foto={foto} setFoto={setFoto} texto="Foto obligatoria" alt="Evidencia de recolección" />
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={confirmar}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
