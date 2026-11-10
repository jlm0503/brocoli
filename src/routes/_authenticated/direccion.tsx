import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/campo/AppShell";
import { AlertasOperativas } from "@/components/campo/AlertasOperativas";
import { MapaFotos } from "@/components/campo/Extraordinarios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CICLOS_PLANTACION, fechaCorta, registroEnCicloPlantacion, reporteMensualAlertas } from "@/lib/campo/calc";
import { useCosecha } from "@/lib/campo/cosecha";
import { useFase3 } from "@/lib/campo/fase3";
import { useFiltro } from "@/lib/campo/filtro";
import { useCampo } from "@/lib/campo/store";
import type { AlertaDireccion } from "@/lib/campo/types";

export const Route = createFileRoute("/_authenticated/direccion")({
  head: () => ({
    meta: [
      { title: "Alertas a Dirección · Brócoli" },
      { name: "description", content: "Pedidos extraordinarios, plantaciones incumplidas, devoluciones y ciclos cerrados por debajo de la meta." },
      { property: "og:title", content: "Alertas a Dirección · Brócoli" },
      { property: "og:description", content: "Extraordinarios, avance de plantación, devoluciones y rendimientos finales por ingeniero y rancho." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Direccion,
});

const TIPO: Record<AlertaDireccion["tipo"], string> = {
  ubicacion: "Fotos con ubicación no válida",
  sin_mejora: "Reporte de mejora no entregado",
};

function Direccion() {
  const { alertasDireccion: todas, extraordinarios } = useFase3();
  const { tablas, lotes } = useCampo();
  const { ciclos } = useCosecha();
  const [ciclo, setCiclo] = useState<string>("2026-2");
  const { pasaRancho, pasaTabla } = useFiltro();
  const alertasDireccion = todas.filter(
    (a) => {
      const extra = extraordinarios.find((e) => e.id === a.extraordinarioId);
      return pasaRancho(a.ranchoId) && tablas.some((t) => a.tablaIds.includes(t.id) && pasaTabla(t)) && registroEnCicloPlantacion({ fecha: extra?.fecha ?? a.fecha, tablaIds: extra?.tablaIds ?? a.tablaIds, loteIds: extra?.reparto?.flatMap((r) => r.loteId ? [r.loteId] : []) }, ciclo, lotes, ciclos);
    },
  );
  const abiertas = alertasDireccion.filter((a) => a.status === "abierta").sort((a, b) => b.fecha.localeCompare(a.fecha));
  const cerradas = alertasDireccion.filter((a) => a.status === "notificada").sort((a, b) => b.fecha.localeCompare(a.fecha));
  const reporte = reporteMensualAlertas(alertasDireccion);

  return (
    <AppShell
      path="/direccion"
      eyebrow="Dirección · incumplimientos"
      title="Alertas a Dirección"
      filtros
    >
      <div className="mb-6 max-w-md space-y-1">
        <Label htmlFor="ciclo-direccion">Ciclo de plantación</Label>
        <Select value={ciclo} onValueChange={setCiclo}>
          <SelectTrigger id="ciclo-direccion" aria-label="Ciclo de plantación" className="h-auto min-h-9 w-full [&>span]:whitespace-normal [&>span]:text-left"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los ciclos</SelectItem>
            {CICLOS_PLANTACION.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <AlertasOperativas ciclo={ciclo} />
      <section className="mb-10">
        <h2 className="mb-3 text-2xl font-semibold">
          Seguimiento de ubicación y mejora <span className="num text-base text-muted-foreground">({abiertas.length})</span>
        </h2>
        {abiertas.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay alertas abiertas.</p>
        ) : (
          <div className="space-y-3">
            {abiertas.map((a) => (
              <Tarjeta key={a.id} a={a} folio={extraordinarios.find((e) => e.id === a.extraordinarioId)?.folio} />
            ))}
          </div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-2xl font-semibold">Reporte mensual</h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Mes</th>
                <th className="px-4 py-2 font-medium">Ingeniero</th>
                <th className="px-4 py-2 text-right font-medium">Ubicación no válida</th>
                <th className="px-4 py-2 text-right font-medium">Mejora no entregada</th>
              </tr>
            </thead>
            <tbody>
              {reporte.map((r) => (
                <tr key={`${r.mes}${r.ingeniero}`} className="border-t border-border/60">
                  <td className="num px-4 py-2">{r.mes}</td>
                  <td className="px-4 py-2">{r.ingeniero}</td>
                  <td className="num px-4 py-2 text-right">{r.ubicacion}</td>
                  <td className="num px-4 py-2 text-right">{r.sin_mejora}</td>
                </tr>
              ))}
              {reporte.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    Sin alertas todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {cerradas.length > 0 && (
        <section>
          <h2 className="mb-3 text-2xl font-semibold">Notificadas al ingeniero</h2>
          <ul className="space-y-2 text-sm">
            {cerradas.map((a) => (
              <li key={a.id} className="rounded-lg border border-border bg-card p-3">
                <span className="font-medium">{TIPO[a.tipo]}</span> · {a.ingeniero} · {fechaCorta(a.fecha)}
                <div className="text-xs text-muted-foreground">
                  {a.cierre?.por}, {a.cierre && fechaCorta(a.cierre.fecha)}: {a.cierre?.comentario}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppShell>
  );
}

function Tarjeta({ a, folio }: { a: AlertaDireccion; folio?: string | undefined }) {
  const { ranchos, tablas } = useCampo();
  const { cerrarAlerta } = useFase3();
  const [comentario, setComentario] = useState("");
  const ts = tablas.filter((t) => a.tablaIds.includes(t.id));
  return (
    <article className="rounded-xl border border-destructive/40 bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{TIPO[a.tipo]}</h3>
          <p className="text-xs text-muted-foreground">
            {a.ingeniero} · {ranchos.find((r) => r.id === a.ranchoId)?.nombre} · {ts.map((t) => t.nombre).join(", ")} ·{" "}
            {folio} · {fechaCorta(a.fecha)}
          </p>
        </div>
        <Badge variant="rojo">Abierta</Badge>
      </div>
      {a.fotos.length > 0 && (
        <div className="mt-3">
          <MapaFotos fotos={a.fotos} tablas={ts} />
        </div>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Textarea
          placeholder="Comentario (obligatorio)"
          aria-label="Comentario para cerrar la alerta"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
        />
        <Button
          className="shrink-0"
          onClick={() => {
            const e = cerrarAlerta(a.id, comentario);
            if (e) return void toast.error(e);
            toast.success("Alerta cerrada: notificada al ingeniero");
          }}
        >
          Notificada al ingeniero
        </Button>
      </div>
    </article>
  );
}
