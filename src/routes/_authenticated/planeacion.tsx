import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  CornerDownRight,
  FileText,
  Lock,
  Package,
  Plus,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, Stat } from "@/components/campo/AppShell";
import { CorregirFechasDialog } from "@/components/campo/CorregirFechasDialog";
import { GenerarSolicitudDialog, SolicitudListaDialog } from "@/components/campo/SolicitudPlanta";
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
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ANTICIPACION_SEMANAS,
  ESTATUS_TABLA_LABEL,
  esArrastrado,
  esPlaneacionTardia,
  estatusTabla,
  etapa,
  fechaCorta,
  fechaCosechaLote,
  fechaEnSemana,
  fechaLimite,
  formatoNum,
  hectareasDisponibles,
  hectareasPlaneadas,
  hectareasPlantadas,
  insumosEntregados,
  cintaPlaneacion,
  lineasPlaneacion,
  lotePorPlantar,
  nombreCultivo,
  plantasFueraDeRango,
  plantasSugeridas,
  recetaDe,
  lotesDeTabla,
  lotesParaSolicitud,
  pendientesConInsumos,
  pendientesLote,
  plantadasLote,
  semanaCosechaLote,
  semanaRecetaLote,
  semanaCultivoTabla,
  sumarDias,
  semanasAnticipacion,
  semaforoPedido,
  sumarPorProducto,
  validarApartado,
  validarPlantacionPrevia,
} from "@/lib/campo/calc";
import { puedeCorregirFechas } from "@/lib/campo/roles";
import { useCampo } from "@/lib/campo/store";
import { useRanchosVisibles } from "@/lib/campo/fase3";
import type {
  CultivoCat,
  Lote,
  OpcionTardia,
  Producto,
  SolicitudPlanta,
  Tabla,
  Variedad,
} from "@/lib/campo/types";

export const Route = createFileRoute("/_authenticated/planeacion")({
  head: () => ({
    meta: [
      { title: "Planeación por lotes y avance · Brócoli" },
      {
        name: "description",
        content:
          "Planea lotes de una tabla en distintas semanas, registra lo plantado cada día y revisa los pendientes con sus insumos de planeación.",
      },
      { property: "og:title", content: "Planeación por lotes y avance · Brócoli" },
      {
        property: "og:description",
        content: "Lotes de plantación, avance diario y pendientes arrastrados por tabla.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Planeacion,
});

function listaInsumos(items: { productoId: string; cantidad: number }[], productos: Producto[]) {
  const m = sumarPorProducto(items);
  return [...m.entries()]
    .map(([pid, c]) => {
      const p = productos.find((x) => x.id === pid);
      return `${p?.nombre ?? pid} ${formatoNum(c)} ${p?.unidad ?? ""}`;
    })
    .join(" · ");
}

function Planeacion() {
  const { ranchos: todosRanchos, tablas, lotes, semanaActual } = useCampo();
  const ranchos = useRanchosVisibles(todosRanchos);
  const [ranchoElegido, setRancho] = useState("");
  const rancho = ranchos.some((r) => r.id === ranchoElegido)
    ? ranchoElegido
    : (ranchos[0]?.id ?? "");
  const [planeando, setPlaneando] = useState<Tabla | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const [solicitando, setSolicitando] = useState(false);
  const [lista, setLista] = useState<SolicitudPlanta | null>(null);

  const delRancho = tablas.filter((t) => t.ranchoId === rancho);
  const lotesRancho = lotes.filter((l) => l.ranchoId === rancho && !l.cancelado);
  const plantadasSemana = lotesRancho
    .flatMap((l) => l.avances)
    .filter((a) => a.semana === semanaActual)
    .reduce((s, a) => s + a.ha, 0);
  const porPlantar = lotesRancho
    .filter((l) => lotePorPlantar(l, semanaActual))
    .reduce((s, l) => s + pendientesLote(l), 0);
  const disponibles = delRancho.reduce((s, t) => s + hectareasDisponibles(t, lotes), 0);
  const pendientes = lotesRancho.filter((l) => esArrastrado(l, semanaActual));

  return (
    <AppShell
      path="/planeacion"
      eyebrow={`Ingenieros · semana ${semanaActual}`}
      title="Planeación y avance"
      description={`Planea la tabla completa o por lotes en distintas semanas, idealmente con ${ANTICIPACION_SEMANAS} semanas de anticipación. Lo que no se plante en su semana pasa a un lote pendiente.`}
      actions={
        tablas.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setSolicitando(true)}>
              <FileText /> Generar solicitud de planta
            </Button>
            <Button variant="outline" onClick={() => setRegistrando(true)}>
              <CalendarCheck /> Registrar plantación ya hecha
            </Button>
          </div>
        )
      }
    >
      {ranchos.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
          Aún no hay ranchos ni tablas. El administrador los agrega en Catálogos; después aquí se
          planean los lotes y se registran las plantaciones que ya se hicieron.
        </div>
      )}
      {ranchos.length > 0 && (
        <>
          <Tabs value={rancho} onValueChange={setRancho} className="mb-6">
            <TabsList>
              {ranchos.map((r) => (
                <TabsTrigger key={r.id} value={r.id}>
                  {r.nombre}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <Stat
              label="Plantado esta semana"
              value={`${formatoNum(plantadasSemana)} ha`}
              tone="primary"
            />
            <Stat
              label="Por plantar esta semana"
              value={`${formatoNum(porPlantar)} ha`}
              hint="Incluye pendientes arrastrados"
              tone="soil"
            />
            <Stat label="Disponible para planear" value={`${formatoNum(disponibles)} ha`} />
          </div>

          {pendientes.length > 0 && <Pendientes lotes={pendientes} />}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {delRancho.map((t) => (
              <TablaCard key={t.id} tabla={t} onPlanear={() => setPlaneando(t)} />
            ))}
          </div>

          <div className="mt-10 flex items-start gap-3 rounded-xl border border-dashed border-border bg-card/60 p-5 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>
              Aquí no se piden insumos a mano. Al planear un lote se genera de inmediato su pedido
              de planeación (semana -2); lo demás sale de la receta según las hectáreas realmente
              plantadas.
            </p>
          </div>
        </>
      )}

      <PlanearDialog
        key={planeando ? `${planeando.id}-${lotes.length}` : "cerrado"}
        tabla={planeando}
        onClose={() => setPlaneando(null)}
        onPlaneado={(sol) => {
          setPlaneando(null);
          setLista(sol);
        }}
      />
      {lista && <SolicitudListaDialog solicitud={lista} onClose={() => setLista(null)} />}
      {solicitando && <GenerarSolicitudDialog open onClose={() => setSolicitando(false)} />}
      <RegistrarPlantacionDialog
        key={registrando ? `reg-${rancho}` : "reg-cerrado"}
        open={registrando}
        ranchoInicial={rancho}
        onClose={() => setRegistrando(false)}
      />
    </AppShell>
  );
}

function Pendientes({ lotes }: { lotes: Lote[] }) {
  const { tablas, productos, pedidos, cancelarLote } = useCampo();
  return (
    <section className="mb-8 rounded-xl border border-soil/40 bg-soil-soft/50 p-5">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <CornerDownRight className="size-5 text-soil" /> Pendientes arrastrados
      </h2>
      <ul className="mt-4 space-y-3">
        {lotes.map((l) => {
          const t = tablas.find((x) => x.id === l.tablaId);
          const entregados = insumosEntregados(l, pedidos);
          const porEntregar = l.insumos.filter((i) => !entregados.includes(i));
          return (
            <li key={l.id} className="rounded-lg bg-card p-4 text-sm shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {t?.nombre} · Lote {l.codigo} ·{" "}
                  <span className="num">{formatoNum(pendientesLote(l))} ha</span>
                </span>
                {l.avances.length === 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => {
                      cancelarLote(l.id);
                      toast(
                        entregados.length > 0
                          ? `Lote ${l.codigo} cancelado. Se avisó al administrador para reubicar o recolectar sus insumos.`
                          : `Lote ${l.codigo} cancelado.`,
                      );
                    }}
                  >
                    <X /> Cancelar lote
                  </Button>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {l.sinInsumos ? (
                  <span className="text-destructive">
                    Sin insumos de planeación: se usaron en otro lote. Al plantarse se pide de
                    nuevo.
                  </span>
                ) : (
                  <>
                    {entregados.length > 0 && (
                      <>
                        <span className="text-foreground">
                          Insumos de planeación ya entregados:
                        </span>{" "}
                        {listaInsumos(entregados, productos)}
                      </>
                    )}
                    {porEntregar.length > 0 && (
                      <>
                        {entregados.length > 0 && <br />}
                        <span className="text-foreground">Por entregar:</span>{" "}
                        {listaInsumos(porEntregar, productos)}
                      </>
                    )}
                  </>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RegistrarPlantacionDialog({
  open,
  ranchoInicial,
  onClose,
}: {
  open: boolean;
  ranchoInicial: string;
  onClose: () => void;
}) {
  const { ranchos: todosRanchos, tablas, lotes, variedades, cultivos, hoy, registrarPlantacion } = useCampo();
  const ranchos = useRanchosVisibles(todosRanchos);
  const [ranchoId, setRanchoId] = useState(ranchoInicial);
  const deRancho = tablas.filter((t) => t.ranchoId === ranchoId);
  const [tablaElegida, setTablaId] = useState("");
  const tabla = deRancho.find((t) => t.id === tablaElegida) ?? deRancho[0];
  const [variedadId, setVariedadId] = useState(variedades[0]?.id ?? "");
  const variedad = variedades.find((v) => v.id === variedadId);
  const [ha, setHa] = useState("");
  const [fecha, setFecha] = useState("");
  const [cosecha, setCosecha] = useState("");
  const disponibles = tabla ? hectareasDisponibles(tabla, lotes) : 0;
  const error = tabla
    ? validarPlantacionPrevia(tabla, lotes, Number(ha), fecha, hoy, cosecha || undefined)
    : "Elige la tabla.";

  const guardar = () => {
    if (!tabla) return void toast.error("Elige la tabla.");
    const err = registrarPlantacion({
      tablaId: tabla.id,
      ha: Number(ha),
      variedadId,
      fechaPlantacion: fecha,
      fechaCosecha: cosecha || undefined,
    });
    if (err) return void toast.error(err);
    toast.success(
      `${tabla.nombre}: ${formatoNum(Number(ha))} ha de ${variedad?.nombre} registradas`,
    );
    // Se queda abierta para capturar la siguiente.
    setHa("");
    setFecha("");
    setCosecha("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Registrar plantación ya hecha</DialogTitle>
          <DialogDescription>
            Para lo que ya está plantado. Su paquete de planeación se da por entregado y desde aquí
            la receta sigue semana a semana. La ventana se queda abierta para capturar varias.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
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
            <Label>Tabla</Label>
            <Select value={tabla?.id ?? ""} onValueChange={setTablaId}>
              <SelectTrigger aria-label="Tabla">
                <SelectValue placeholder="Sin tablas" />
              </SelectTrigger>
              <SelectContent>
                {deRancho.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nombre} · {formatoNum(hectareasDisponibles(t, lotes))} de{" "}
                    {formatoNum(t.hectareas)} ha libres
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Variedad</Label>
            <Select value={variedadId} onValueChange={setVariedadId}>
              <SelectTrigger aria-label="Variedad">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {variedades.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {etiquetaVariedad(v, cultivos)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-ha">Hectáreas plantadas</Label>
            <Input
              id="rp-ha"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              placeholder={`hasta ${formatoNum(disponibles)}`}
              value={ha}
              onChange={(e) => setHa(e.target.value)}
              className="num"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-fecha">Fecha de plantación</Label>
            <Input
              id="rp-fecha"
              type="date"
              max={hoy}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="num"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-cosecha">Fecha estimada de cosecha (opcional)</Label>
            <Input
              id="rp-cosecha"
              type="date"
              value={cosecha}
              onChange={(e) => setCosecha(e.target.value)}
              className="num"
            />
            {fecha && variedad && !cosecha && (
              <p className="text-xs text-muted-foreground">
                Si la dejas vacía: {fechaCorta(sumarDias(fecha, variedad.cicloDias))} (
                {variedad.cicloDias} días).
              </p>
            )}
          </div>
        </div>
        {ha && fecha && error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Listo
          </Button>
          <Button onClick={guardar} disabled={!!error}>
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const etiquetaVariedad = (v: Variedad, cultivos: CultivoCat[]) =>
  `${v.nombre} · ${nombreCultivo(cultivos, v.cultivo).toLowerCase()} · ${v.cicloDias} días`;

function estadoLote(l: Lote, semanaActual: number): string {
  const plantadas = plantadasLote(l);
  if (plantadas > 0 && pendientesLote(l) === 0) {
    const sr = semanaRecetaLote(l, semanaActual)!;
    return `Plantado · sem ${sr}/${semanaCosechaLote(l)} (${etapa(sr, semanaCosechaLote(l)).toLowerCase()})`;
  }
  if (plantadas > 0) return `Plantando ${formatoNum(plantadas)}/${formatoNum(l.ha)}`;
  if (esArrastrado(l, semanaActual)) return "Pendiente arrastrado";
  if (l.semanaPlaneada === semanaActual) return "Toca plantar";
  return "Planeado";
}

function TablaCard({ tabla, onPlanear }: { tabla: Tabla; onPlanear: () => void }) {
  const {
    semanaActual,
    lotes,
    pedidos,
    registrarAvance,
    cancelarLote,
    role,
    variedades,
    viveros,
    solicitudes,
  } = useCampo();
  const [solicitandoLote, setSolicitandoLote] = useState<Lote | null>(null);
  const puedenPedir = new Set(lotesParaSolicitud(lotes, solicitudes).map((l) => l.id));
  const solicitudDe = (loteId: string) =>
    solicitudes.find((s) => s.status !== "cancelada" && s.lineas.some((x) => x.loteId === loteId));
  const nombreVariedad = (id: string) => variedades.find((v) => v.id === id)?.nombre ?? id;
  const [ha, setHa] = useState("");
  const [corrigiendo, setCorrigiendo] = useState<Lote | null>(null);
  const editarFechas = puedeCorregirFechas(role);
  const estatus = estatusTabla(tabla, lotes, semanaActual);
  const deTabla = lotesDeTabla(lotes, tabla.id);
  const planeadas = hectareasPlaneadas(lotes, tabla.id);
  const plantadas = hectareasPlantadas(lotes, tabla.id);
  const disponibles = hectareasDisponibles(tabla, lotes);
  const sc = semanaCultivoTabla(lotes, tabla.id, semanaActual);
  const porPlantar = deTabla
    .filter((l) => lotePorPlantar(l, semanaActual))
    .reduce((s, l) => s + pendientesLote(l), 0);
  const avances = deTabla
    .flatMap((l) => l.avances.map((a) => ({ ...a, codigo: l.codigo })))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(-3);

  const guardar = () => {
    const n = Number(ha);
    const err = registrarAvance(tabla.id, n);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(`${tabla.nombre}: ${formatoNum(n)} ha registradas hoy`);
    setHa("");
  };

  return (
    <article className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">{tabla.nombre}</h3>
          <p className="num text-xs text-muted-foreground">
            {formatoNum(tabla.hectareas)} ha totales
          </p>
        </div>
        <Badge variant={estatus}>{ESTATUS_TABLA_LABEL[estatus]}</Badge>
      </div>

      {deTabla.length > 0 && (
        <div className="mt-5 flex flex-1 flex-col gap-4">
          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span>
                <span className="num font-medium">{formatoNum(plantadas)} ha</span> plantadas
              </span>
              <span className="text-muted-foreground">
                de <span className="num">{formatoNum(planeadas)}</span> planeadas
              </span>
            </div>
            <Progress value={(plantadas / tabla.hectareas) * 100} className="mt-2 h-2" />
            {sc !== null && (
              <p className="mt-2 text-xs text-muted-foreground">
                Primer lote en semana de receta <span className="num text-foreground">{sc}</span>
              </p>
            )}
          </div>

          <ul className="space-y-2">
            {deTabla.map((l) => {
              const pedido = pedidos.find((p) => p.loteId === l.id && p.status !== "cancelado");
              const sem = pedido ? semaforoPedido(pedido, semanaActual) : null;
              const arr = esArrastrado(l, semanaActual);
              return (
                <li
                  key={l.id}
                  className={`rounded-md px-3 py-2 text-xs ${arr ? "bg-soil-soft" : "bg-secondary/60"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <span className="num rounded bg-card px-1.5 py-0.5">{l.codigo}</span>
                      <CalendarClock className="size-3.5" /> Sem {l.semanaPlaneada} ·{" "}
                      <span className="num">{formatoNum(l.ha)} ha</span>
                    </span>
                    {l.avances.length === 0 ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          const conInsumos = insumosEntregados(l, pedidos).length > 0;
                          cancelarLote(l.id);
                          toast(
                            conInsumos
                              ? `Lote ${l.codigo} cancelado. Sus insumos quedan por reubicar o recolectar.`
                              : `Lote ${l.codigo} cancelado.`,
                          );
                        }}
                      >
                        Cancelar
                      </Button>
                    ) : editarFechas ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={() => setCorrigiendo(l)}
                      >
                        Corregir fechas
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {nombreVariedad(l.variedadId)} · cosecha {fechaCorta(fechaCosechaLote(l))}
                    {l.plantas ? ` · ${formatoNum(l.plantas)} plantas` : ""}
                    {l.viveroId
                      ? ` · ${viveros.find((v) => v.id === l.viveroId)?.nombre ?? ""}`
                      : ""}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
                    <span className={arr ? "font-medium text-soil-foreground" : ""}>
                      {estadoLote(l, semanaActual)}
                    </span>
                    {pedido && sem && plantadasLote(l) === 0 && (
                      <Badge variant={sem} className="px-1.5 py-0 text-[0.65rem]">
                        <Package className="mr-1 size-3" />
                        {sem === "verde"
                          ? "Planeación entregada"
                          : `Planeación límite sem ${pedido.semanaPlantacion - 1}`}
                      </Badge>
                    )}
                    {(() => {
                      const sp = solicitudDe(l.id);
                      if (sp)
                        return (
                          <Badge
                            variant={sp.status === "recibida" ? "recibido" : "comprado"}
                            className="px-1.5 py-0 text-[0.65rem]"
                          >
                            <FileText className="mr-1 size-3" />
                            SP-{String(sp.folio).padStart(4, "0")}
                            {sp.status === "recibida"
                              ? " · planta recibida"
                              : sp.status === "parcial"
                                ? " · recibida parcial"
                                : ""}
                          </Badge>
                        );
                      if (!puedenPedir.has(l.id)) return null;
                      return (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 px-1.5 text-[0.65rem]"
                          onClick={() => setSolicitandoLote(l)}
                        >
                          <FileText className="size-3" /> Solicitar planta
                        </Button>
                      );
                    })()}
                  </div>
                </li>
              );
            })}
          </ul>

          {avances.length > 0 && (
            <ul className="space-y-1 border-t border-border pt-3 text-xs">
              {avances.map((a) => (
                <li key={a.id} className="flex justify-between text-muted-foreground">
                  <span>
                    {fechaCorta(a.fecha)} · lote {a.codigo}
                  </span>
                  <span className="num text-foreground">+{formatoNum(a.ha)} ha</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-auto space-y-2 pt-4">
        {porPlantar > 0 && (
          <div className="flex gap-2">
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              max={porPlantar}
              placeholder="ha hoy"
              value={ha}
              onChange={(e) => setHa(e.target.value)}
              className="num"
              aria-label={`Hectáreas plantadas hoy en ${tabla.nombre}`}
            />
            <Button onClick={guardar} variant="soil">
              Registrar hoy
            </Button>
          </div>
        )}
        {disponibles > 0 ? (
          <Button
            onClick={onPlanear}
            variant={deTabla.length === 0 ? "default" : "outline"}
            className="w-full"
          >
            <Plus />{" "}
            {deTabla.length === 0
              ? "Planear lote"
              : `Planear ${formatoNum(disponibles)} ha disponibles`}
          </Button>
        ) : (
          estatus === "plantada" && <p className="text-xs text-primary">Plantación completa</p>
        )}
      </div>
      <CorregirFechasDialog lote={corrigiendo} onClose={() => setCorrigiendo(null)} />
      {solicitandoLote && (
        <GenerarSolicitudDialog
          open
          lote={solicitandoLote}
          onClose={() => setSolicitandoLote(null)}
        />
      )}
    </article>
  );
}

function PlanearDialog({
  tabla,
  onClose,
  onPlaneado,
}: {
  tabla: Tabla | null;
  onClose: () => void;
  /** Al planear: si hay vivero, la solicitud de planta del lote para descargar el PDF. */
  onPlaneado: (solicitud: SolicitudPlanta | null) => void;
}) {
  const {
    semanaActual,
    recetas,
    variedades,
    cultivos,
    viveros,
    adicionales,
    productos,
    lotes,
    pedidos,
    tablas,
    planearLote,
    parametro,
  } = useCampo();
  const [variedadId, setVariedadId] = useState(variedades[0]?.id ?? "");
  const variedad = variedades.find((v) => v.id === variedadId) ?? variedades[0];
  const cultivo = variedad?.cultivo ?? "";
  const [plantasTxt, setPlantasTxt] = useState("");
  /** Plantas por ha mientras se escriben (el total se calcula con las hectáreas). */
  const [porHaTxt, setPorHaTxt] = useState<string | null>(null);
  const [motivoPlantas, setMotivoPlantas] = useState("");
  const [viveroId, setViveroId] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const opciones = Array.from({ length: 9 }, (_, i) => semanaActual + i);
  const [semana, setSemana] = useState(String(semanaActual + ANTICIPACION_SEMANAS));
  const [ha, setHa] = useState("");
  const [opcion, setOpcion] = useState<OpcionTardia | "">("");
  const [motivo, setMotivo] = useState("");
  const [usar, setUsar] = useState<string[]>([]);
  const disponibles = tabla ? hectareasDisponibles(tabla, lotes) : 0;

  const haNum = Number(ha);
  const w = Number(semana);
  const error = tabla ? validarApartado(tabla, lotes, w, haNum, semanaActual) : null;
  const sugeridas = plantasSugeridas(haNum > 0 ? haNum : 0, parametro("plantasPorHa", undefined, variedad?.id));
  const plantas =
    porHaTxt !== null
      ? Math.round(Number(porHaTxt) * (haNum > 0 ? haNum : 0))
      : plantasTxt === ""
        ? sugeridas
        : Math.round(Number(plantasTxt));
  const fueraDeRango = plantasFueraDeRango(plantas, sugeridas);
  const entregaPlanta = fechaEntrega || fechaEnSemana(w, 0);
  const cinta = useMemo(
    () => cintaPlaneacion(productos, parametro("rollosCintaHa", undefined, variedad?.id)),
    [productos, parametro, variedad?.id],
  );
  const paquete = useMemo(
    () =>
      tabla && haNum > 0
        ? lineasPlaneacion(recetaDe(recetas, cultivo), adicionales, tabla.id, haNum, cinta)
        : [],
    [tabla, haNum, recetas, cultivo, adicionales, cinta],
  );
  const sinPaquete = useMemo(
    () =>
      lineasPlaneacion(recetaDe(recetas, cultivo), adicionales, tabla?.id ?? "", 1, cinta)
        .length === 0,
    [recetas, cultivo, adicionales, tabla, cinta],
  );
  // Sin paquete de planeación (receta pendiente) no hay insumos que decidir.
  const tardia = esPlaneacionTardia(w, semanaActual) && !sinPaquete;
  const candidatos = useMemo(
    () => (tabla ? pendientesConInsumos(lotes, pedidos, tabla.ranchoId, semanaActual) : []),
    [tabla, lotes, pedidos, semanaActual],
  );
  const opcionEfectiva: OpcionTardia | "" = tardia
    ? candidatos.length === 0
      ? opcion === "sin-pendientes"
        ? "sin-pendientes"
        : ""
      : opcion
    : "";

  const confirmar = () => {
    if (!tabla) return;
    if (!variedad) return void toast.error("Primero agrega una variedad en Catálogos.");
    const r = planearLote(tabla.id, w, haNum, {
      variedadId: variedad.id,
      plantas,
      motivoPlantas: fueraDeRango ? motivoPlantas : undefined,
      viveroId: viveroId || undefined,
      fechaEntregaPlanta: entregaPlanta,
      opcion: opcionEfectiva || undefined,
      motivo,
      usarLoteIds: usar,
    });
    if ("error" in r) {
      toast.error(r.error);
      return;
    }
    toast.success(
      sinPaquete
        ? `${tabla.nombre}: lote de ${formatoNum(haNum)} ha de ${variedad.nombre} para la semana ${w}.`
        : `${tabla.nombre}: lote de ${formatoNum(haNum)} ha de ${variedad.nombre} para la semana ${w}. Pedido de planeación enviado a Compras.`,
    );
    onPlaneado(r.solicitud);
  };

  const faltaDecision =
    (tardia &&
      (!opcionEfectiva ||
        (opcionEfectiva === "pedir-nuevos" && !motivo.trim()) ||
        (opcionEfectiva === "usar-pendientes" && usar.length === 0))) ||
    !variedad ||
    !(plantas > 0) ||
    (fueraDeRango && !motivoPlantas.trim()) ||
    (viveros.length > 0 && !viveroId);

  return (
    <Dialog open={!!tabla} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Planear lote · {tabla?.nombre}
          </DialogTitle>
          <DialogDescription>
            {tabla &&
              `${formatoNum(disponibles)} de ${formatoNum(tabla.hectareas)} ha disponibles. Puedes planear solo una parte; el resto queda libre para otro lote.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Variedad</Label>
            <Select value={variedadId} onValueChange={setVariedadId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {variedades.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {etiquetaVariedad(v, cultivos)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {variedad && (
              <p className="text-xs text-muted-foreground">
                Cosecha estimada {fechaCorta(sumarDias(fechaEnSemana(w), variedad.cicloDias))} si se
                planta el lunes de la semana {w}.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Semana de plantación</Label>
            <Select value={semana} onValueChange={setSemana}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {opciones.map((o) => (
                  <SelectItem key={o} value={String(o)}>
                    Semana {o} · {fechaLimite(o)}
                    {esPlaneacionTardia(o, semanaActual) ? " · tardía" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ha-planear">Hectáreas del lote</Label>
            <Input
              id="ha-planear"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              max={disponibles}
              placeholder={`hasta ${formatoNum(disponibles)}`}
              value={ha}
              onChange={(e) => setHa(e.target.value)}
              className="num"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plantas-ha-planear">Plantas por ha</Label>
            <Input
              id="plantas-ha-planear"
              type="number"
              inputMode="numeric"
              step="1000"
              min="0"
              value={
                porHaTxt !== null
                  ? porHaTxt
                  : haNum > 0 && plantas > 0
                    ? Math.round(plantas / haNum)
                    : ""
              }
              onChange={(e) => {
                setPorHaTxt(e.target.value);
              }}
              className="num"
            />
            <p className="text-xs text-muted-foreground">O escribe el total de plantas.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="plantas-planear">Total de plantas</Label>
            <Input
              id="plantas-planear"
              type="number"
              inputMode="numeric"
              step="1000"
              min="0"
              value={
                porHaTxt !== null
                  ? plantas > 0
                    ? plantas
                    : ""
                  : plantasTxt === ""
                    ? sugeridas > 0
                      ? sugeridas
                      : ""
                    : plantasTxt
              }
              onChange={(e) => {
                setPlantasTxt(e.target.value);
                setPorHaTxt(null);
              }}
              className="num"
            />
            <p className="text-xs text-muted-foreground">
              Sugerido: {formatoNum(sugeridas)} ({formatoNum(parametro("plantasPorHa", undefined, variedad?.id))} por ha
              {variedad ? ` para ${variedad.nombre}` : ""})
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="entrega-planta">Entrega de la planta</Label>
            <Input
              id="entrega-planta"
              type="date"
              value={entregaPlanta}
              onChange={(e) => setFechaEntrega(e.target.value)}
              className="num"
            />
            <p className="text-xs text-muted-foreground">
              Por defecto, el lunes de la semana de plantación.
            </p>
          </div>
          {fueraDeRango && (
            <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive-soft p-3 sm:col-span-2">
              <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertTriangle className="size-4" /> Las plantas difieren más de 10% de lo sugerido
              </p>
              <Textarea
                placeholder="Motivo (obligatorio)"
                value={motivoPlantas}
                onChange={(e) => setMotivoPlantas(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-2 sm:col-span-2">
            <Label>Vivero</Label>
            {viveros.length > 0 ? (
              <Select value={viveroId} onValueChange={setViveroId}>
                <SelectTrigger aria-label="Vivero">
                  <SelectValue placeholder="Elige el vivero" />
                </SelectTrigger>
                <SelectContent>
                  {viveros.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground">
                Aún no hay viveros. El administrador los agrega en Catálogos → Viveros.
              </p>
            )}
          </div>
        </div>

        {ha && error && <p className="text-sm text-destructive">{error}</p>}

        {tardia && (
          <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive-soft p-4 text-sm">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <AlertTriangle className="size-4" /> Planeación con menos de {ANTICIPACION_SEMANAS}{" "}
              semanas de anticipación ({semanasAnticipacion(w, semanaActual)})
            </p>
            {candidatos.length > 0 ? (
              <>
                <p className="text-xs text-muted-foreground">
                  En este rancho hay lotes pendientes con insumos de planeación ya entregados:
                </p>
                <ul className="space-y-1.5">
                  {candidatos.map((l) => {
                    const t = tablas.find((x) => x.id === l.tablaId);
                    const marcado = usar.includes(l.id);
                    return (
                      <li key={l.id} className="flex items-start gap-2 text-xs">
                        <Checkbox
                          id={`usar-${l.id}`}
                          checked={marcado}
                          disabled={opcion !== "usar-pendientes"}
                          onCheckedChange={(c) =>
                            setUsar((u) => (c ? [...u, l.id] : u.filter((x) => x !== l.id)))
                          }
                        />
                        <label htmlFor={`usar-${l.id}`}>
                          <span className="font-medium">
                            {t?.nombre} · {l.codigo}
                          </span>{" "}
                          — {listaInsumos(insumosEntregados(l, pedidos), productos)}
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <RadioGroup value={opcion} onValueChange={(v) => setOpcion(v as OpcionTardia)}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="usar-pendientes" id="op-usar" />
                    <Label htmlFor="op-usar">Usar insumos de pendientes</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="pedir-nuevos" id="op-nuevos" />
                    <Label htmlFor="op-nuevos">Pedir nuevos</Label>
                  </div>
                </RadioGroup>
                {opcion === "pedir-nuevos" && (
                  <Textarea
                    placeholder="Motivo (obligatorio)"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                )}
              </>
            ) : (
              <label className="flex items-start gap-2 text-xs">
                <Checkbox
                  checked={opcion === "sin-pendientes"}
                  onCheckedChange={(c) => setOpcion(c ? "sin-pendientes" : "")}
                />
                <span>
                  Confirmo: no hay tablas pendientes con insumos disponibles. El pedido se marca{" "}
                  <strong>Urgente</strong>.
                </span>
              </label>
            )}
          </div>
        )}

        {sinPaquete && !error && (
          <p className="rounded-lg bg-secondary p-4 text-xs text-muted-foreground">
            La receta de {nombreCultivo(cultivos, cultivo).toLowerCase()} aún está pendiente: este
            lote no genera pedido de planeación ni compras hasta que se cargue.
          </p>
        )}

        {paquete.length > 0 && !error && (
          <div className="rounded-lg bg-primary-soft p-4 text-sm text-accent-foreground">
            <p className="font-medium">Pedido de planeación (semana -2) que se genera:</p>
            <p className="mt-1 text-xs">{listaInsumos(paquete, productos)}</p>
            <p className="mt-2 text-xs">
              Entrega ideal semana {w - 2} · fecha límite semana {w - 1} ({fechaLimite(w - 1)}).
              {opcionEfectiva === "usar-pendientes" &&
                " Se descuenta lo que ya cubren los pendientes elegidos."}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={!!error || faltaDecision}>
            Planear lote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
