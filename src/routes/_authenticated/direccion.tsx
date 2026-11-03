import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/campo/AppShell";
import { MapaFotos } from "@/components/campo/Extraordinarios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fechaCorta, reporteMensualAlertas } from "@/lib/campo/calc";
import { useFase3 } from "@/lib/campo/fase3";
import { useCampo } from "@/lib/campo/store";
import type { AlertaDireccion } from "@/lib/campo/types";

export const Route = createFileRoute("/_authenticated/direccion")({
  head: () => ({
    meta: [
      { title: "Alertas a Dirección · Brócoli" },
      { name: "description", content: "Fotos fuera de las tablas y reportes de mejora no entregados, con reporte mensual por ingeniero." },
      { property: "og:title", content: "Alertas a Dirección · Brócoli" },
      { property: "og:description", content: "Incumplimientos de los ingenieros y su seguimiento." },
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
  const { alertasDireccion, extraordinarios } = useFase3();
  const abiertas = alertasDireccion.filter((a) => a.status === "abierta").sort((a, b) => b.fecha.localeCompare(a.fecha));
  const cerradas = alertasDireccion.filter((a) => a.status === "notificada").sort((a, b) => b.fecha.localeCompare(a.fecha));
  const reporte = reporteMensualAlertas(alertasDireccion);

  return (
    <AppShell
      path="/direccion"
      eyebrow="Dirección · incumplimientos"
      title="Alertas a Dirección"
      description="Llegan solas cuando una foto queda fuera de las tablas o cuando un ingeniero no reporta la mejora 3 días después de lo esperado. Ciérralas al hablar con el ingeniero."
    >
      <section className="mb-10">
        <h2 className="mb-3 text-2xl font-semibold">
          Abiertas <span className="num text-base text-muted-foreground">({abiertas.length})</span>
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
