import { createFileRoute } from "@tanstack/react-router";
import { FileDown, ImageIcon, PackageCheck, Plus, Send, Share2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, Stat } from "@/components/campo/AppShell";
import { VerEvidencia } from "@/components/campo/Evidencia";
import { GenerarSolicitudDialog, RecibirPlantaDialog, usePdfSolicitud } from "@/components/campo/SolicitudPlanta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ESTATUS_SOLICITUD_LABEL,
  diferenciaPlantas,
  fechaCorta,
  folioSolicitud,
  formatoNum,
  lotesParaSolicitud,
  totalesSolicitud,
} from "@/lib/campo/calc";
import { entregarPdf } from "@/lib/campo/pdf-solicitud";
import { useCampo } from "@/lib/campo/store";
import type { EstatusSolicitud, SolicitudPlanta } from "@/lib/campo/types";

export const Route = createFileRoute("/_authenticated/solicitudes")({
  head: () => ({
    meta: [
      { title: "Solicitudes de planta · Brócoli" },
      {
        name: "description",
        content: "Genera la solicitud de planta en PDF para el vivero, compártela y registra la planta recibida.",
      },
      { property: "og:title", content: "Solicitudes de planta · Brócoli" },
      { property: "og:description", content: "Solicitudes de planta al vivero con folio, estatus y recepción." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Solicitudes,
});

const VARIANTE: Record<EstatusSolicitud, "pendiente" | "comprado" | "recibido" | "cancelado"> = {
  generada: "pendiente",
  enviada: "comprado",
  recibida: "recibido",
  cancelada: "cancelado",
};

function Solicitudes() {
  const { solicitudes, lotes, semanaActual } = useCampo();
  const [generando, setGenerando] = useState(false);
  const [recibiendo, setRecibiendo] = useState<SolicitudPlanta | null>(null);
  const lista = [...solicitudes].sort((a, b) => b.folio - a.folio);
  const sinSolicitud = lotesParaSolicitud(lotes, solicitudes);
  const porRecibir = solicitudes.filter((s) => s.status === "generada" || s.status === "enviada");

  return (
    <AppShell
      path="/solicitudes"
      eyebrow={`Planta · semana ${semanaActual}`}
      title="Solicitudes de planta"
      description="Cada solicitud lleva folio y se descarga en PDF para mandarla al vivero. Al llegar la planta se captura lo que realmente se recibió."
      actions={
        <Button onClick={() => setGenerando(true)}>
          <Plus /> Generar solicitud
        </Button>
      }
    >
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Lotes sin solicitud" value={String(sinSolicitud.length)} hint="Planeados, sin plantar" tone="soil" />
        <Stat
          label="Por recibir"
          value={`${formatoNum(porRecibir.reduce((s, x) => s + totalesSolicitud(x).plantas, 0))} plantas`}
          hint={`${porRecibir.length} solicitudes`}
        />
        <Stat label="Solicitudes" value={String(solicitudes.length)} tone="primary" />
      </div>

      {lista.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
          Aún no hay solicitudes. Genera la primera con el botón de arriba o desde cada lote en Planeación.
        </div>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {lista.map((s) => (
            <SolicitudCard key={s.id} s={s} onRecibir={() => setRecibiendo(s)} />
          ))}
        </ul>
      )}

      {generando && <GenerarSolicitudDialog open onClose={() => setGenerando(false)} />}
      {recibiendo && <RecibirPlantaDialog solicitud={recibiendo} onClose={() => setRecibiendo(null)} />}
    </AppShell>
  );
}

function SolicitudCard({ s, onRecibir }: { s: SolicitudPlanta; onRecibir: () => void }) {
  const { marcarSolicitudEnviada, cancelarSolicitud } = useCampo();
  const tot = totalesSolicitud(s);
  const semanas = [...new Set(s.lineas.map((l) => l.semanaPlantacion))].join(", ");
  const dif = s.status === "recibida" ? tot.recibidas - tot.plantas : 0;
  const abierta = s.status === "generada" || s.status === "enviada";

  // El PDF se arma de antemano: así el botón lo entrega al instante y el celular no pierde el toque.
  const blob = usePdfSolicitud(s);
  const pdf = () => {
    if (blob) void entregarPdf(blob, s);
  };
  const compartir = () => {
    if (!blob) return;
    void entregarPdf(blob, s, true).then((ok) => {
      if (ok && s.status === "generada") {
        marcarSolicitudEnviada(s.id);
        toast.success(`${folioSolicitud(s.folio)} marcada como enviada al vivero`);
      } else if (!ok) toast("Se descargó el PDF para que lo mandes por WhatsApp o correo.");
    });
  };

  return (
    <li className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="num text-sm font-semibold text-primary">{folioSolicitud(s.folio)}</span>
          <h3 className="text-xl font-semibold">{s.vivero.nombre}</h3>
          <p className="text-xs text-muted-foreground">
            {fechaCorta(s.fecha)} · {s.ingeniero} · plantación sem {semanas}
          </p>
        </div>
        <Badge variant={VARIANTE[s.status]}>{ESTATUS_SOLICITUD_LABEL[s.status]}</Badge>
      </div>

      <ul className="mt-4 space-y-1.5 text-sm">
        {s.lineas.map((l) => {
          const d = diferenciaPlantas(l);
          return (
            <li key={l.loteId} className="flex justify-between gap-3 rounded-md bg-secondary/60 px-3 py-2">
              <span>
                {l.tabla} · lote {l.lote}
                <span className="block text-xs text-muted-foreground">
                  {l.variedad} · {formatoNum(l.ha)} ha · entrega {fechaCorta(l.fechaEntrega)}
                </span>
              </span>
              <span className="num text-right">
                {formatoNum(l.plantas)}
                {l.plantasRecibidas !== undefined && (
                  <span className={`block text-xs ${d < 0 ? "text-destructive" : d > 0 ? "text-primary" : "text-muted-foreground"}`}>
                    recibidas {formatoNum(l.plantasRecibidas)}
                    {d !== 0 && ` (${d > 0 ? "+" : ""}${formatoNum(d)})`}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="num mt-2 text-right text-sm">
        {formatoNum(tot.ha)} ha · {formatoNum(tot.plantas)} plantas
      </p>
      {s.status === "recibida" && s.recepcion && (
        <p className="mt-1 text-right text-xs text-muted-foreground">
          Recibida {fechaCorta(s.recepcion.fecha)}
          {dif !== 0 && (
            <span className={dif < 0 ? "font-medium text-destructive" : "font-medium text-primary"}>
              {" "}
              · diferencia {dif > 0 ? "+" : ""}
              {formatoNum(dif)} plantas
            </span>
          )}
        </p>
      )}
      {s.observaciones && <p className="mt-2 text-xs text-muted-foreground">“{s.observaciones}”</p>}

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <Button size="sm" variant="outline" onClick={pdf} disabled={!blob}>
          <FileDown /> {s.status === "generada" ? "PDF" : "Reimprimir"}
        </Button>
        {s.status !== "cancelada" && (
          <Button size="sm" variant="outline" onClick={compartir} disabled={!blob}>
            <Share2 /> Compartir
          </Button>
        )}
        {s.status === "generada" && (
          <Button size="sm" variant="ghost" onClick={() => marcarSolicitudEnviada(s.id)}>
            <Send /> Marcar enviada
          </Button>
        )}
        {abierta && (
          <Button size="sm" onClick={onRecibir}>
            <PackageCheck /> Planta recibida
          </Button>
        )}
        {s.recepcion?.foto && (
          <VerEvidencia foto={s.recepcion.foto} title="Ver remisión">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm hover:bg-secondary">
              <ImageIcon className="size-4" /> Remisión
            </span>
          </VerEvidencia>
        )}
        {abierta && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => {
              const err = cancelarSolicitud(s.id);
              if (err) toast.error(err);
              else toast(`${folioSolicitud(s.folio)} cancelada. Sus lotes pueden pedir planta de nuevo.`);
            }}
          >
            <X /> Cancelar
          </Button>
        )}
      </div>
    </li>
  );
}
