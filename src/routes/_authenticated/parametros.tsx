import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CLAVES_PARAMETRO,
  PARAMETROS_INFO,
  costoPorPlanta,
  fechaCorta,
  formatoNum,
  nombreCultivo,
  registroVigente,
} from "@/lib/campo/calc";
import { useCampo } from "@/lib/campo/store";
import type { ClaveParametro } from "@/lib/campo/types";

export const Route = createFileRoute("/_authenticated/parametros")({
  head: () => ({
    meta: [
      { title: "Parámetros · Brócoli" },
      {
        name: "description",
        content: "Plantas por hectárea, costo de planta, precio por kg, meta de rendimiento y demás parámetros con fecha de vigencia.",
      },
      { property: "og:title", content: "Parámetros · Brócoli" },
      {
        property: "og:description",
        content: "Valores de operación que aplican desde su fecha y nunca recalculan lo anterior.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Parametros,
});

const fechaLarga = (iso: string) => `${fechaCorta(iso)} ${iso.slice(0, 4)}`;

function valorConUnidad(clave: ClaveParametro, v: number): string {
  const u = PARAMETROS_INFO[clave].unidad;
  if (u === "MXN") return `$${v.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`;
  if (u === "%") return `${formatoNum(v)}%`;
  return `${formatoNum(v)} ${u}`;
}

const GENERAL = "general";

function Parametros() {
  const { parametros, parametro, hoy, eliminarParametro, variedades, cultivos } = useCampo();
  const [editando, setEditando] = useState<ClaveParametro | null>(null);
  const [vista, setVista] = useState(GENERAL);
  const variedad = variedades.find((v) => v.id === vista);
  const vid = variedad?.id;
  const claves = vid ? CLAVES_PARAMETRO.filter((c) => PARAMETROS_INFO[c].porVariedad) : CLAVES_PARAMETRO;
  const ordenadas = [...variedades].sort(
    (a, b) => a.cultivo.localeCompare(b.cultivo) || a.nombre.localeCompare(b.nombre),
  );

  return (
    <AppShell
      path="/parametros"
      eyebrow="Administrador · parámetros"
      title="Parámetros"
      description="Cada cambio aplica desde su fecha de vigencia. Lo que ya se registró antes (lotes planeados, pedidos, costos) conserva el valor que tenía. Cada variedad puede tener sus propios valores; si no tiene, usa el general."
    >
      <Tabs value={vista} onValueChange={setVista} className="mb-6">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value={GENERAL}>General</TabsTrigger>
          {ordenadas.map((v) => (
            <TabsTrigger key={v.id} value={v.id}>
              {nombreCultivo(cultivos, v.cultivo)} · {v.nombre}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {variedad && (
        <p className="mb-6 text-sm text-muted-foreground">
          Valores solo para {nombreCultivo(cultivos, variedad.cultivo).toLowerCase()} {variedad.nombre}. Descuento por
          viaje y días sin evaluación son iguales para todos y se cambian en General.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {claves.map((clave) => {
          const info = PARAMETROS_INFO[clave];
          const historial = parametros
            .filter((p) => p.clave === clave && (p.variedadId ?? undefined) === vid)
            .sort((a, b) => b.desde.localeCompare(a.desde));
          const vigente = parametro(clave, undefined, vid);
          const propio = vid ? registroVigente(parametros, clave, hoy, vid) : undefined;
          return (
            <article key={clave} className="rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">{info.nombre}</p>
                  <p className="num mt-1 text-3xl font-semibold">{valorConUnidad(clave, vigente)}</p>
                  {vid && !propio && (
                    <p className="mt-1 text-xs text-muted-foreground">Usa el valor general</p>
                  )}
                  {!vid && info.porVariedad && (
                    <p className="mt-1 text-xs text-muted-foreground">Para variedades sin valor propio</p>
                  )}
                  {clave === "costoPlantaHa" && (
                    <p className="num mt-1 text-xs text-muted-foreground">
                      Costo por planta: ${formatoNum(costoPorPlanta(parametros, hoy, vid))} (costo por ha ÷ plantas por ha)
                    </p>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditando(clave)}>
                  <Plus /> Nuevo valor
                </Button>
              </div>
              {historial.length > 0 && (
                <ul className="mt-4 space-y-1 border-t border-border pt-3 text-xs">
                  {historial.map((p) => {
                    const esVigente = p.desde <= hoy && historial.find((h) => h.desde <= hoy)?.id === p.id;
                    return (
                      <li key={p.id} className="flex items-center justify-between gap-2">
                        <span className="num">
                          Desde el {fechaLarga(p.desde)}: {valorConUnidad(clave, p.valor)}
                        </span>
                        <span className="flex items-center gap-1">
                          {esVigente && <Badge variant="verde">vigente</Badge>}
                          {p.desde > hoy && <Badge variant="pendiente">programado</Badge>}
                          {(vid || historial.length > 1) && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-6"
                              aria-label={`Quitar valor desde ${p.desde}`}
                              onClick={() => {
                                eliminarParametro(p.id);
                                toast("Valor quitado");
                              }}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          );
        })}
      </div>
      <NuevoValor
        clave={editando}
        variedadId={vid}
        etiqueta={variedad ? `${nombreCultivo(cultivos, variedad.cultivo)} ${variedad.nombre}` : undefined}
        onClose={() => setEditando(null)}
      />
    </AppShell>
  );
}

function NuevoValor({
  clave,
  variedadId,
  etiqueta,
  onClose,
}: {
  clave: ClaveParametro | null;
  variedadId?: string | undefined;
  etiqueta?: string | undefined;
  onClose: () => void;
}) {
  const { guardarParametro, hoy } = useCampo();
  const [valor, setValor] = useState("");
  const [desde, setDesde] = useState("");
  const fecha = desde || hoy;

  const guardar = () => {
    if (!clave) return;
    const err = guardarParametro(clave, Number(valor), fecha, variedadId);
    if (err) return void toast.error(err);
    toast.success(
      `${PARAMETROS_INFO[clave].nombre}${etiqueta ? ` (${etiqueta})` : ""}: ${valorConUnidad(clave, Number(valor))} desde el ${fechaLarga(fecha)}`,
    );
    setValor("");
    setDesde("");
    onClose();
  };

  return (
    <Dialog open={!!clave} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {clave && PARAMETROS_INFO[clave].nombre}
            {etiqueta && <span className="block text-base font-normal text-muted-foreground">{etiqueta}</span>}
          </DialogTitle>
          <DialogDescription>El nuevo valor aplica desde la fecha que elijas; lo anterior no cambia.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pv-valor">Valor{clave ? ` (${PARAMETROS_INFO[clave].unidad})` : ""}</Label>
            <Input
              id="pv-valor"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="num"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pv-desde">Aplica desde</Label>
            <Input id="pv-desde" type="date" value={fecha} onChange={(e) => setDesde(e.target.value)} className="num" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={valor === ""}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
