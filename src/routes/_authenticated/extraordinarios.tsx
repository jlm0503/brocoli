import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/campo/AppShell";
import {
  BadgeUbicacion,
  CONDICIONES,
  FotosGps,
  MapaFotos,
  STATUS_EXTRA,
} from "@/components/campo/Extraordinarios";
import { Badge } from "@/components/ui/badge";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  costoExtraordinario,
  debeReportarMejora,
  fechaCorta,
  fechaReporteMejora,
  formatoMXN,
  formatoNum,
  sumarDias,
  urgenteSurtido,
} from "@/lib/campo/calc";
import { useFase3 } from "@/lib/campo/fase3";
import { tiene } from "@/lib/campo/roles";
import { useSesion } from "@/lib/campo/sesion";
import { useCampo } from "@/lib/campo/store";
import type { Condicion, Extraordinario, FotoGps, LineaExtra, ResultadoMejora } from "@/lib/campo/types";

export const Route = createFileRoute("/_authenticated/extraordinarios")({
  head: () => ({
    meta: [
      { title: "Solicitudes extraordinarias · Brócoli" },
      {
        name: "description",
        content: "Plagas, gusano o heladas: el ingeniero pide productos con fotos y ubicación, y el autorizador decide.",
      },
      { property: "og:title", content: "Solicitudes extraordinarias · Brócoli" },
      { property: "og:description", content: "Captura con fotos y GPS, autorización y reporte de mejora." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Extraordinarios,
});

const RESULTADOS: Record<ResultadoMejora, string> = { mejoro: "Mejoró", parcial: "Parcial", no_mejoro: "No mejoró" };

function Extraordinarios() {
  const { roles, user } = useSesion();
  const { extraordinarios } = useFase3();
  const { hoy } = useCampo();
  const autoriza = tiene(roles, "admin", "autorizador");
  const ingeniero = tiene(roles, "ingeniero");
  const [nueva, setNueva] = useState(false);
  const [viendo, setViendo] = useState<Extraordinario | null>(null);
  const [mejora, setMejora] = useState<Extraordinario | null>(null);

  const porAutorizar = extraordinarios
    .filter((e) => e.status === "por_autorizar")
    .sort((a, b) => a.fechaMaxSurtido.localeCompare(b.fechaMaxSurtido));
  const mias = extraordinarios.filter((e) => e.ingenieroId === user?.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const otras = autoriza
    ? extraordinarios.filter((e) => e.status !== "por_autorizar").sort((a, b) => b.fecha.localeCompare(a.fecha))
    : [];

  return (
    <AppShell
      path="/extraordinarios"
      eyebrow="Plaga · gusano · helada"
      title="Solicitudes extraordinarias"
      description="Toda solicitud entra como “Por autorizar” y no llega a Compras hasta que se autoriza. Las fotos se toman en el momento y se revisa que estén dentro de las tablas."
      actions={
        ingeniero || autoriza ? (
          <Button onClick={() => setNueva(true)}>
            <Plus /> Nueva solicitud
          </Button>
        ) : undefined
      }
    >
      {autoriza && (
        <section className="mb-10">
          <h2 className="mb-3 text-2xl font-semibold">
            Por autorizar <span className="num text-base text-muted-foreground">({porAutorizar.length})</span>
          </h2>
          <Lista items={porAutorizar} onAbrir={setViendo} hoy={hoy} />
        </section>
      )}

      {ingeniero && (
        <section className="mb-10">
          <h2 className="mb-3 text-2xl font-semibold">Mis solicitudes</h2>
          <Lista items={mias} onAbrir={setViendo} hoy={hoy} onMejora={setMejora} />
        </section>
      )}

      {autoriza && otras.length > 0 && (
        <section>
          <h2 className="mb-3 text-2xl font-semibold">Historial</h2>
          <Lista items={otras} onAbrir={setViendo} hoy={hoy} />
        </section>
      )}

      {nueva && <NuevaDialog onClose={() => setNueva(false)} />}
      {viendo && (
        <DetalleDialog
          key={viendo.id}
          ex={extraordinarios.find((e) => e.id === viendo.id) ?? viendo}
          onClose={() => setViendo(null)}
          autoriza={autoriza}
        />
      )}
      {mejora && <MejoraDialog ex={mejora} onClose={() => setMejora(null)} />}
    </AppShell>
  );
}

function Lista({
  items,
  onAbrir,
  hoy,
  onMejora,
}: {
  items: Extraordinario[];
  onAbrir: (e: Extraordinario) => void;
  hoy: string;
  onMejora?: (e: Extraordinario) => void;
}) {
  const { tablas, ranchos } = useCampo();
  if (items.length === 0)
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Nada por aquí.
      </p>
    );
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((e) => {
        const rojo = urgenteSurtido(e, hoy);
        const toca = onMejora && debeReportarMejora(e, hoy);
        return (
          <article
            key={e.id}
            className={`rounded-xl border bg-card p-4 shadow-card ${rojo ? "border-destructive bg-destructive-soft" : "border-border"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">
                  <span className="num">{e.folio}</span> · {CONDICIONES[e.condicion]}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {ranchos.find((r) => r.id === e.ranchoId)?.nombre} ·{" "}
                  {e.tablaIds.map((id) => tablas.find((t) => t.id === id)?.nombre).join(", ")} · {e.ingeniero}
                </p>
              </div>
              <Badge variant={STATUS_EXTRA[e.status].variant}>{STATUS_EXTRA[e.status].texto}</Badge>
            </div>
            <p className="mt-2 line-clamp-2 text-sm">{e.descripcion}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <BadgeUbicacion u={e.ubicacion} />
              <span className={rojo ? "font-medium text-destructive" : "text-muted-foreground"}>
                {rojo && <AlertTriangle className="mr-1 inline size-3" />}Surtir antes del {fechaCorta(e.fechaMaxSurtido)}
              </span>
            </div>
            {e.autorizacion?.conCambios && (
              <p className="mt-2 rounded-md bg-soil-soft px-2 py-1 text-xs text-soil-foreground">
                Autorizada con cambios: {e.autorizacion.cambios}
              </p>
            )}
            {e.status === "rechazada" && (
              <p className="mt-2 rounded-md bg-destructive-soft px-2 py-1 text-xs text-destructive">
                Rechazada: {e.autorizacion?.motivo}
              </p>
            )}
            {e.mejora && (
              <p className="mt-2 text-xs text-muted-foreground">
                Mejora reportada: <span className="font-medium">{RESULTADOS[e.mejora.resultado]}</span>
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onAbrir(e)}>
                Ver detalle
              </Button>
              {toca && (
                <Button size="sm" variant="destructive" onClick={() => onMejora(e)}>
                  Reportar mejora
                </Button>
              )}
              {onMejora && !toca && !e.mejora && fechaReporteMejora(e) && (
                <span className="self-center text-xs text-muted-foreground">
                  Reportar mejora el {fechaCorta(fechaReporteMejora(e)!)}
                </span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function LineasEditor({ lineas, setLineas }: { lineas: LineaExtra[]; setLineas: (l: LineaExtra[]) => void }) {
  const { productos } = useCampo();
  return (
    <div className="space-y-2">
      {lineas.map((l, i) => (
        <div key={i} className="flex gap-2">
          <Select
            value={l.productoId}
            onValueChange={(v) => setLineas(lineas.map((x, j) => (j === i ? { ...x, productoId: v } : x)))}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Producto" />
            </SelectTrigger>
            <SelectContent>
              {productos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre} ({p.unidad})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            inputMode="decimal"
            className="num w-28"
            placeholder="por ha"
            aria-label="Cantidad por ha"
            value={l.porHa || ""}
            onChange={(e) => setLineas(lineas.map((x, j) => (j === i ? { ...x, porHa: Number(e.target.value) } : x)))}
          />
          <Button
            size="icon"
            variant="ghost"
            aria-label="Quitar producto"
            onClick={() => setLineas(lineas.filter((_, j) => j !== i))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => setLineas([...lineas, { productoId: "", porHa: 0 }])}>
        <Plus /> Agregar producto
      </Button>
    </div>
  );
}

function NuevaDialog({ onClose }: { onClose: () => void }) {
  const { ranchos, tablas, hoy } = useCampo();
  const { ranchosVisibles, crearExtraordinario } = useFase3();
  const misRanchos = ranchos.filter((r) => !ranchosVisibles || ranchosVisibles.includes(r.id));
  const [ranchoId, setRanchoId] = useState(misRanchos[0]?.id ?? "");
  const [tablaIds, setTablaIds] = useState<string[]>([]);
  const [condicion, setCondicion] = useState<Condicion>("plaga");
  const [descripcion, setDescripcion] = useState("");
  const [lineas, setLineas] = useState<LineaExtra[]>([{ productoId: "", porHa: 0 }]);
  const [fotos, setFotos] = useState<FotoGps[]>([]);
  const [dias, setDias] = useState("7");
  const [fechaMax, setFechaMax] = useState(sumarDias(hoy, 2));

  const enviar = () => {
    const r = crearExtraordinario({
      tablaIds,
      condicion,
      descripcion,
      lineas,
      fotos,
      diasEfecto: Number(dias),
      fechaMaxSurtido: fechaMax,
    });
    if ("error" in r) return void toast.error(r.error);
    if (r.ex.ubicacion === "no_valida") toast.warning(`${r.ex.folio} enviada, pero una foto quedó fuera de las tablas. Se avisó a Dirección.`);
    else toast.success(`${r.ex.folio} enviada. Espera la autorización.`);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Nueva solicitud extraordinaria</DialogTitle>
          <DialogDescription>Mínimo 3 fotos tomadas ahora con la cámara, estando en las tablas.</DialogDescription>
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
                  {misRanchos.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Condición</Label>
              <Select value={condicion} onValueChange={(v) => setCondicion(v as Condicion)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CONDICIONES) as Condicion[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {CONDICIONES[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tablas afectadas</Label>
            <div className="flex flex-wrap gap-3">
              {tablas
                .filter((t) => t.ranchoId === ranchoId)
                .map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={tablaIds.includes(t.id)}
                      onCheckedChange={(c) => setTablaIds((ids) => (c ? [...ids, t.id] : ids.filter((x) => x !== t.id)))}
                    />
                    {t.nombre}
                  </label>
                ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ex-desc">Descripción</Label>
            <Textarea id="ex-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Productos y cantidad por ha</Label>
            <LineasEditor lineas={lineas} setLineas={setLineas} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ex-dias">Días esperados de efecto</Label>
              <Input id="ex-dias" type="number" className="num" value={dias} onChange={(e) => setDias(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ex-max">Fecha máxima de surtido</Label>
              <Input id="ex-max" type="date" value={fechaMax} min={hoy} onChange={(e) => setFechaMax(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Fotos</Label>
            <FotosGps fotos={fotos} setFotos={setFotos} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={enviar}>Enviar a autorizar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetalleDialog({ ex, onClose, autoriza }: { ex: Extraordinario; onClose: () => void; autoriza: boolean }) {
  const { tablas, productos, hoy } = useCampo();
  const { extraordinarios, autorizar, rechazar } = useFase3();
  const [lineas, setLineas] = useState<LineaExtra[]>(ex.lineas);
  const [cambios, setCambios] = useState("");
  const [motivo, setMotivo] = useState("");
  const ts = tablas.filter((t) => ex.tablaIds.includes(t.id));
  const decide = autoriza && ex.status === "por_autorizar";
  const cambiado = JSON.stringify(lineas) !== JSON.stringify(ex.lineas);
  const costo = costoExtraordinario(decide ? lineas : ex.lineas, ts, productos, ex.autorizacion?.fecha ?? hoy);
  const histTabla = extraordinarios.filter((e) => e.id !== ex.id && e.tablaIds.some((id) => ex.tablaIds.includes(id)));
  const histIng = extraordinarios.filter((e) => e.id !== ex.id && e.ingenieroId === ex.ingenieroId);
  const nombreP = (id: string) => productos.find((p) => p.id === id);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {ex.folio} · {CONDICIONES[ex.condicion]}
          </DialogTitle>
          <DialogDescription>
            {ex.ingeniero} · {ts.map((t) => `${t.nombre} (${formatoNum(t.hectareas)} ha)`).join(", ")} · {fechaCorta(ex.fecha)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant={STATUS_EXTRA[ex.status].variant}>{STATUS_EXTRA[ex.status].texto}</Badge>
            <BadgeUbicacion u={ex.ubicacion} />
          </div>
          <p>{ex.descripcion}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <span className="eyebrow">Días de efecto</span>
              <div className="num">{ex.diasEfecto}</div>
            </div>
            <div>
              <span className="eyebrow">Surtir a más tardar</span>
              <div className={urgenteSurtido(ex, hoy) ? "font-medium text-destructive" : ""}>{fechaCorta(ex.fechaMaxSurtido)}</div>
            </div>
            {autoriza && (
              <div>
                <span className="eyebrow">Costo estimado</span>
                <div className="num font-medium">{formatoMXN(costo)}</div>
              </div>
            )}
          </div>

          <div>
            <span className="eyebrow">Productos por ha</span>
            {decide ? (
              <div className="mt-2">
                <LineasEditor lineas={lineas} setLineas={setLineas} />
              </div>
            ) : (
              <ul className="mt-2 space-y-1">
                {ex.lineas.map((l) => (
                  <li key={l.productoId} className="flex justify-between">
                    <span>{nombreP(l.productoId)?.nombre}</span>
                    <span className="num">
                      {formatoNum(l.porHa)} {nombreP(l.productoId)?.unidad}/ha
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <span className="eyebrow">Fotos y ubicación</span>
            <div className="mt-2">
              <MapaFotos fotos={ex.fotos} tablas={ts} />
            </div>
          </div>

          {ex.autorizacion && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs">
              {ex.status === "rechazada" ? "Rechazó" : "Autorizó"} {ex.autorizacion.por} el {fechaCorta(ex.autorizacion.fecha)}
              {ex.autorizacion.conCambios && ` · cambios: ${ex.autorizacion.cambios}`}
              {ex.autorizacion.motivo && ` · motivo: ${ex.autorizacion.motivo}`}
              {ex.autorizacion.lineasOriginales &&
                ` · pedía: ${ex.autorizacion.lineasOriginales.map((l) => `${nombreP(l.productoId)?.nombre} ${formatoNum(l.porHa)}/ha`).join(", ")}`}
            </p>
          )}

          {ex.mejora && (
            <div>
              <span className="eyebrow">Reporte de mejora · {RESULTADOS[ex.mejora.resultado]}</span>
              <p className="mt-1">{ex.mejora.comentario}</p>
              <div className="mt-2 flex gap-2">
                <BadgeUbicacion u={ex.mejora.ubicacion} />
              </div>
              <div className="mt-2">
                <MapaFotos fotos={ex.mejora.fotos} tablas={ts} />
              </div>
            </div>
          )}

          {autoriza && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <span className="eyebrow">Historial de estas tablas ({histTabla.length})</span>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {histTabla.slice(0, 6).map((e) => (
                    <li key={e.id}>
                      {e.folio} · {CONDICIONES[e.condicion]} · {fechaCorta(e.fecha)} · {STATUS_EXTRA[e.status].texto}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="eyebrow">Historial de {ex.ingeniero} ({histIng.length})</span>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {histIng.slice(0, 6).map((e) => (
                    <li key={e.id}>
                      {e.folio} · {CONDICIONES[e.condicion]} · {fechaCorta(e.fecha)} · {STATUS_EXTRA[e.status].texto}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {decide && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ex-cambios">Qué cambiaste (si cambias productos)</Label>
                <Textarea id="ex-cambios" value={cambios} onChange={(e) => setCambios(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ex-motivo">Motivo del rechazo</Label>
                <Textarea id="ex-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          {decide ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  const e = rechazar(ex.id, motivo);
                  if (e) return void toast.error(e);
                  toast(`${ex.folio} rechazada`);
                  onClose();
                }}
              >
                Rechazar
              </Button>
              <Button
                onClick={() => {
                  const e = autorizar(ex.id, { lineas, cambios });
                  if (e) return void toast.error(e);
                  toast.success(cambiado ? `${ex.folio} autorizada con cambios; se avisa al ingeniero` : `${ex.folio} autorizada; ya está en Compras`);
                  onClose();
                }}
              >
                {cambiado ? "Autorizar con cambios" : "Autorizar"}
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MejoraDialog({ ex, onClose }: { ex: Extraordinario; onClose: () => void }) {
  const { reportarMejora } = useFase3();
  const [resultado, setResultado] = useState<ResultadoMejora>("mejoro");
  const [comentario, setComentario] = useState("");
  const [fotos, setFotos] = useState<FotoGps[]>([]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Reportar mejora · {ex.folio}</DialogTitle>
          <DialogDescription>3 fotos de ahora en las tablas, el resultado y un comentario.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Resultado</Label>
            <Select value={resultado} onValueChange={(v) => setResultado(v as ResultadoMejora)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RESULTADOS) as ResultadoMejora[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {RESULTADOS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mj-com">Comentario</Label>
            <Textarea id="mj-com" value={comentario} onChange={(e) => setComentario(e.target.value)} />
          </div>
          <FotosGps fotos={fotos} setFotos={setFotos} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              const e = reportarMejora(ex.id, { resultado, comentario, fotos });
              if (e) return void toast.error(e);
              toast.success("Mejora reportada");
              onClose();
            }}
          >
            Guardar reporte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
