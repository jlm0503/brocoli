import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock, CornerDownRight, Lock, Plus } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ANTICIPACION_SEMANAS,
  PRESIEMBRA_SEMANAS,
  costoLineas,
  estatusTabla,
  fechaCorta,
  fechaLimite,
  formatoMXN,
  formatoNum,
  hectareasPendientes,
  hectareasPlaneadas,
  hectareasPlantadas,
  hectareasSinPlanear,
  lineasTabla,
  pendientesPlan,
  planArrastrado,
  planesOrdenados,
  planesPorPlantar,
  plantadasPlan,
  semanaCultivoTabla,
  semanaPendiente,
  validarApartado,
} from "@/lib/campo/calc";
import { RANCHOS } from "@/lib/campo/seed";
import { useCampo } from "@/lib/campo/store";
import type { Tabla } from "@/lib/campo/types";

export const Route = createFileRoute("/planeacion")({
  head: () => ({
    meta: [
      { title: "Planeación y avance · Brócoli" },
      {
        name: "description",
        content: "Aparta tablas completas o por partes en distintas semanas, con dos semanas de anticipación, y registra las hectáreas plantadas cada día.",
      },
      { property: "og:title", content: "Planeación y avance · Brócoli" },
      {
        property: "og:description",
        content: "Aparta tablas libres y captura el avance diario de siembra.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Planeacion,
});

function Planeacion() {
  const { tablas, semanaActual } = useCampo();
  const [rancho, setRancho] = useState(RANCHOS[0]!.id);
  const [apartando, setApartando] = useState<Tabla | null>(null);

  const delRancho = tablas.filter((t) => t.ranchoId === rancho);
  const planes = delRancho.flatMap((t) => t.planes);
  const plantadasSemana = planes
    .flatMap((p) => p.avances)
    .filter((a) => a.semana === semanaActual)
    .reduce((s, a) => s + a.ha, 0);
  const pendientesSemana = planes
    .filter((p) => semanaPendiente(p, semanaActual) === semanaActual)
    .reduce((s, p) => s + pendientesPlan(p), 0);
  const conEspacio = delRancho.filter((t) => hectareasSinPlanear(t) > 0);

  return (
    <AppShell
      path="/planeacion"
      eyebrow={`Ingenieros · semana ${semanaActual}`}
      title="Planeación y avance"
      description={`Aparta la tabla completa o por partes en distintas semanas, con ${ANTICIPACION_SEMANAS} semanas de anticipación. Lo que no se plante en su semana se arrastra a la siguiente.`}
    >
      <Tabs value={rancho} onValueChange={setRancho} className="mb-6">
        <TabsList>
          {RANCHOS.map((r) => (
            <TabsTrigger key={r.id} value={r.id}>
              {r.nombre}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Plantado esta semana" value={`${formatoNum(plantadasSemana)} ha`} tone="primary" />
        <Stat
          label="Pendiente esta semana"
          value={`${formatoNum(pendientesSemana)} ha`}
          hint="Incluye lo arrastrado de semanas anteriores"
          tone="soil"
        />
        <Stat
          label="Sin planear"
          value={`${formatoNum(conEspacio.reduce((s, t) => s + hectareasSinPlanear(t), 0))} ha`}
          hint={`En ${conEspacio.length} tabla(s)`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {delRancho.map((t) => (
          <TablaCard key={t.id} tabla={t} onApartar={() => setApartando(t)} />
        ))}
      </div>

      <div className="mt-10 flex items-start gap-3 rounded-xl border border-dashed border-border bg-card/60 p-5 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          Aquí no se piden insumos a mano. Compras recibe automáticamente lo que marca la receta
          para las hectáreas reales y planeadas de cada tabla, incluida la presiembra{" "}
          {PRESIEMBRA_SEMANAS} semanas antes de plantar.
        </p>
      </div>

      <ApartarDialog
        key={apartando ? `${apartando.id}-${apartando.planes.length}` : "cerrado"}
        tabla={apartando}
        onClose={() => setApartando(null)}
      />
    </AppShell>
  );
}

function TablaCard({ tabla, onApartar }: { tabla: Tabla; onApartar: () => void }) {
  const { semanaActual, receta, registrarAvance, liberarSiembra } = useCampo();
  const [ha, setHa] = useState("");
  const estatus = estatusTabla(tabla);
  const siembras = planesOrdenados(tabla);
  const planeadas = hectareasPlaneadas(tabla);
  const plantadas = hectareasPlantadas(tabla);
  const pendientes = hectareasPendientes(tabla);
  const sinPlanear = hectareasSinPlanear(tabla);
  const sc = semanaCultivoTabla(tabla, semanaActual);
  const porPlantar = planesPorPlantar(tabla, semanaActual).reduce(
    (s, p) => s + pendientesPlan(p),
    0,
  );
  const avances = siembras
    .flatMap((p) => p.avances)
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
          <p className="num text-xs text-muted-foreground">{formatoNum(tabla.hectareas)} ha totales</p>
        </div>
        <Badge variant={estatus} className="capitalize">
          {estatus}
        </Badge>
      </div>

      {siembras.length === 0 && (
        <div className="mt-auto pt-6">
          <Button onClick={onApartar} className="w-full">
            <Plus /> Apartar tabla
          </Button>
        </div>
      )}

      {siembras.length > 0 && (
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
            <Progress value={(plantadas / planeadas) * 100} className="mt-2 h-2" />
            {sc !== null && (
              <p className="mt-2 text-xs text-muted-foreground">
                Cultivo en semana{" "}
                <span className="num text-foreground">
                  {sc}/{receta.semanas}
                </span>
              </p>
            )}
          </div>

          <ul className="space-y-2">
            {siembras.map((p) => {
              const hechas = plantadasPlan(p);
              const faltan = pendientesPlan(p);
              const futura = p.semana > semanaActual;
              return (
                <li key={p.id} className="rounded-md bg-secondary/60 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <CalendarClock className="size-3.5" /> Semana {p.semana} ·{" "}
                      <span className="num">{formatoNum(p.ha)} ha</span>
                    </span>
                    {futura && p.avances.length === 0 ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={() => liberarSiembra(tabla.id, p.id)}
                      >
                        Liberar
                      </Button>
                    ) : faltan === 0 ? (
                      <span className="text-primary">Completa</span>
                    ) : (
                      <span className="num text-muted-foreground">
                        {formatoNum(hechas)}/{formatoNum(p.ha)}
                      </span>
                    )}
                  </div>
                  {futura && (
                    <p className="mt-1 text-muted-foreground">
                      Siembra en {p.semana - semanaActual} semana(s) · presiembra en semana{" "}
                      {p.semana - PRESIEMBRA_SEMANAS}
                    </p>
                  )}
                  {planArrastrado(p, semanaActual) && (
                    <p className="mt-1 inline-flex items-center gap-1 text-soil-foreground">
                      <CornerDownRight className="size-3.5" />
                      {formatoNum(faltan)} ha arrastradas a la semana {semanaActual}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          {avances.length > 0 && (
            <ul className="space-y-1 border-t border-border pt-3 text-xs">
              {avances.map((a) => (
                <li key={a.id} className="flex justify-between text-muted-foreground">
                  <span>{fechaCorta(a.fecha)}</span>
                  <span className="num text-foreground">+{formatoNum(a.ha)} ha</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-auto space-y-2">
            {porPlantar > 0 && (
              <div className="flex gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
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
            {sinPlanear > 0 ? (
              <Button onClick={onApartar} variant="outline" className="w-full">
                <Plus /> Apartar {formatoNum(sinPlanear)} ha restantes
              </Button>
            ) : (
              pendientes === 0 && <p className="text-xs text-primary">Plantación completa</p>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function ApartarDialog({ tabla, onClose }: { tabla: Tabla | null; onClose: () => void }) {
  const { semanaActual, receta, productos, apartarTabla } = useCampo();
  const ocupadas = new Set(tabla?.planes.map((p) => p.semana) ?? []);
  const opciones = Array.from({ length: 8 }, (_, i) => semanaActual + ANTICIPACION_SEMANAS + i)
    .filter((w) => !ocupadas.has(w))
    .slice(0, 6);
  const [semana, setSemana] = useState(String(opciones[0]));
  const [ha, setHa] = useState("");
  const disponibles = tabla ? hectareasSinPlanear(tabla) : 0;

  const haNum = Number(ha);
  const error = tabla ? validarApartado(tabla, Number(semana), haNum, semanaActual) : null;

  const preview = useMemo(() => {
    if (!tabla || !(haNum > 0)) return null;
    const hipotetica: Tabla = {
      ...tabla,
      planes: [
        { id: "nuevo", semana: Number(semana), ha: haNum, ingeniero: "Israel", avances: [] },
      ],
    };
    const inicio = Number(semana) - PRESIEMBRA_SEMANAS;
    const sem = Array.from(
      { length: receta.semanas + PRESIEMBRA_SEMANAS },
      (_, i) => inicio + i,
    );
    const lineas = sem.flatMap((w) => lineasTabla(hipotetica, receta, w, semanaActual));
    const presiembra = lineas.filter((l) => l.semana === inicio);
    return {
      costo: costoLineas(lineas, productos, {}),
      presiembra: presiembra.length,
      inicio,
    };
  }, [tabla, haNum, semana, receta, productos, semanaActual]);

  const confirmar = () => {
    if (!tabla) return;
    const err = apartarTabla(tabla.id, Number(semana), haNum);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(`${tabla.nombre}: ${formatoNum(haNum)} ha apartadas para la semana ${semana}`);
    setHa("");
    onClose();
  };

  const parcial = tabla && tabla.planes.length > 0;

  return (
    <Dialog open={!!tabla} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Apartar {tabla?.nombre}</DialogTitle>
          <DialogDescription>
            {tabla &&
              (parcial
                ? `Quedan ${formatoNum(disponibles)} de ${formatoNum(tabla.hectareas)} ha sin planear. `
                : `${formatoNum(tabla.hectareas)} ha disponibles. `)}
            Puedes apartar solo una parte y el resto en otra semana.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Semana de siembra</Label>
            <Select value={semana} onValueChange={setSemana}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {opciones.map((w) => (
                  <SelectItem key={w} value={String(w)}>
                    Semana {w} · {fechaLimite(w)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ha-apartar">Hectáreas a plantar</Label>
            <Input
              id="ha-apartar"
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              max={disponibles}
              placeholder={`hasta ${formatoNum(disponibles)}`}
              value={ha}
              onChange={(e) => setHa(e.target.value)}
              className="num"
            />
          </div>
        </div>

        {preview && !error && (
          <div className="rounded-lg bg-primary-soft p-4 text-sm text-accent-foreground">
            Inversión estimada en insumos de esta siembra:{" "}
            <span className="num font-medium">{formatoMXN(preview.costo)}</span>
            <br />
            {preview.presiembra > 0 && (
            <span className="text-xs">
              Presiembra ({preview.presiembra} productos: suelo, agroquímicos y manguera) se surte
              en la semana {preview.inicio}.
            </span>
            )}
          </div>
        )}
        {ha && error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={!!error}>
            Apartar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
