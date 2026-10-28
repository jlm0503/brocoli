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
  costoLineas,
  estatusTabla,
  fechaCorta,
  fechaLimite,
  formatoMXN,
  formatoNum,
  hectareasPendientes,
  hectareasPlantadas,
  lineasTabla,
  pendienteArrastrado,
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
        content: "Aparta tablas libres con dos semanas de anticipación y registra las hectáreas plantadas cada día.",
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
  const [rancho, setRancho] = useState(RANCHOS[0].id);
  const [apartando, setApartando] = useState<Tabla | null>(null);

  const delRancho = tablas.filter((t) => t.ranchoId === rancho);
  const plantadasHoy = delRancho
    .flatMap((t) => t.plan?.avances ?? [])
    .filter((a) => a.semana === semanaActual)
    .reduce((s, a) => s + a.ha, 0);
  const pendientesSemana = delRancho
    .filter((t) => t.plan && semanaPendiente(t.plan, semanaActual) === semanaActual)
    .reduce((s, t) => s + hectareasPendientes(t.plan), 0);
  const libres = delRancho.filter((t) => estatusTabla(t) === "libre");

  return (
    <AppShell
      path="/planeacion"
      eyebrow={`Ingenieros · semana ${semanaActual}`}
      title="Planeación y avance"
      description={`Aparta solo tablas libres, con ${ANTICIPACION_SEMANAS} semanas de anticipación. Lo que no se plante en su semana se arrastra a la siguiente.`}
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
        <Stat label="Plantado esta semana" value={`${formatoNum(plantadasHoy)} ha`} tone="primary" />
        <Stat
          label="Pendiente esta semana"
          value={`${formatoNum(pendientesSemana)} ha`}
          hint="Incluye lo arrastrado de semanas anteriores"
          tone="soil"
        />
        <Stat
          label="Tablas libres"
          value={libres.length}
          hint={`${formatoNum(libres.reduce((s, t) => s + t.hectareas, 0))} ha disponibles`}
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
          para las hectáreas reales y planeadas de cada tabla.
        </p>
      </div>

      <ApartarDialog tabla={apartando} onClose={() => setApartando(null)} />
    </AppShell>
  );
}

function TablaCard({ tabla, onApartar }: { tabla: Tabla; onApartar: () => void }) {
  const { semanaActual, receta, registrarAvance, liberarTabla } = useCampo();
  const [ha, setHa] = useState("");
  const estatus = estatusTabla(tabla);
  const plan = tabla.plan;
  const plantadas = hectareasPlantadas(plan);
  const pendientes = hectareasPendientes(plan);
  const sc = semanaCultivoTabla(tabla, semanaActual);
  const arrastrado = pendienteArrastrado(plan, semanaActual);
  const puedeAvanzar = plan && plan.semana <= semanaActual && pendientes > 0;

  const guardar = () => {
    const n = Number(ha);
    const err = registrarAvance(tabla.id, n);
    if (err) return toast.error(err);
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

      {estatus === "libre" && (
        <div className="mt-auto pt-6">
          <Button onClick={onApartar} className="w-full">
            <Plus /> Apartar tabla
          </Button>
        </div>
      )}

      {plan && (
        <div className="mt-5 flex flex-1 flex-col gap-4">
          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span>
                <span className="num font-medium">{formatoNum(plantadas)} ha</span> plantadas
              </span>
              <span className="text-muted-foreground">
                <span className="num">{formatoNum(pendientes)}</span> restantes
              </span>
            </div>
            <Progress value={(plantadas / plan.ha) * 100} className="mt-2 h-2" />
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3.5" /> Planeada sem {plan.semana} ·{" "}
                {formatoNum(plan.ha)} ha
              </span>
              {sc !== null && (
                <span>
                  Cultivo en semana{" "}
                  <span className="num text-foreground">
                    {sc}/{receta.semanas}
                  </span>
                </span>
              )}
            </div>
          </div>

          {arrastrado && (
            <div className="flex items-center gap-2 rounded-md bg-soil-soft px-3 py-2 text-xs text-soil-foreground">
              <CornerDownRight className="size-3.5" />
              {formatoNum(pendientes)} ha arrastradas de la semana {plan.semana} a la {semanaActual}
            </div>
          )}

          {plan.avances.length > 0 && (
            <ul className="space-y-1 border-t border-border pt-3 text-xs">
              {plan.avances.slice(-3).map((a) => (
                <li key={a.id} className="flex justify-between text-muted-foreground">
                  <span>{fechaCorta(a.fecha)}</span>
                  <span className="num text-foreground">+{formatoNum(a.ha)} ha</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-auto">
            {puedeAvanzar ? (
              <div className="flex gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min="0"
                  max={pendientes}
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
            ) : pendientes > 0 && plan.avances.length === 0 ? (
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Siembra en {plan.semana - semanaActual} semana(s)</span>
                <Button size="sm" variant="ghost" onClick={() => liberarTabla(tabla.id)}>
                  Liberar
                </Button>
              </div>
            ) : (
              pendientes === 0 && (
                <p className="text-xs text-primary">Plantación completa</p>
              )
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function ApartarDialog({ tabla, onClose }: { tabla: Tabla | null; onClose: () => void }) {
  const { semanaActual, receta, productos, apartarTabla } = useCampo();
  const opciones = Array.from({ length: 5 }, (_, i) => semanaActual + ANTICIPACION_SEMANAS + i);
  const [semana, setSemana] = useState(String(opciones[0]));
  const [ha, setHa] = useState("");

  const haNum = Number(ha);
  const error = tabla ? validarApartado(tabla, Number(semana), haNum, semanaActual) : null;

  const preview = useMemo(() => {
    if (!tabla || !(haNum > 0)) return null;
    const hipotetica: Tabla = {
      ...tabla,
      plan: { semana: Number(semana), ha: haNum, ingeniero: "Israel", avances: [] },
    };
    const sem = Array.from({ length: receta.semanas }, (_, i) => Number(semana) + i);
    const lineas = sem.flatMap((w) => lineasTabla(hipotetica, receta, w, semanaActual));
    const primeras = lineas.filter((l) => l.semana === Number(semana));
    return { costo: costoLineas(lineas, productos, {}), primeras: primeras.length };
  }, [tabla, haNum, semana, receta, productos, semanaActual]);

  const confirmar = () => {
    if (!tabla) return;
    const err = apartarTabla(tabla.id, Number(semana), haNum);
    if (err) return toast.error(err);
    toast.success(`${tabla.nombre} apartada para la semana ${semana}`);
    setHa("");
    onClose();
  };

  return (
    <Dialog open={!!tabla} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Apartar {tabla?.nombre}</DialogTitle>
          <DialogDescription>
            {tabla && `${formatoNum(tabla.hectareas)} ha disponibles. `}
            Compras verá la demanda calculada desde ahora.
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
              max={tabla?.hectareas}
              value={ha}
              onChange={(e) => setHa(e.target.value)}
              className="num"
            />
          </div>
        </div>

        {preview && !error && (
          <div className="rounded-lg bg-primary-soft p-4 text-sm text-accent-foreground">
            Inversión estimada en insumos del ciclo:{" "}
            <span className="num font-medium">{formatoMXN(preview.costo)}</span>
            <br />
            <span className="text-xs">
              {preview.primeras} productos se surtirán para la semana {semana}.
            </span>
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
