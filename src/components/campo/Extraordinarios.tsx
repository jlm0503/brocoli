import { Camera, Check, Loader2, MapPin, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { VerEvidencia, subirEvidencia } from "@/components/campo/Evidencia";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cantidadesExtraordinario, distanciaM, fechaCorta, formatoNum, fotoRecienTomada, radioValidacion } from "@/lib/campo/calc";
import { useFase3 } from "@/lib/campo/fase3";
import { useFiltro } from "@/lib/campo/filtro";
import { useCampo } from "@/lib/campo/store";
import type { Condicion, EstadoUbicacion, FotoGps, Tabla } from "@/lib/campo/types";

export const CONDICIONES: Record<Condicion, string> = {
  plaga: "Plaga",
  gusano: "Gusano",
  helada: "Helada",
  otra: "Otra",
};

export const STATUS_EXTRA = {
  por_autorizar: { texto: "Por autorizar", variant: "pendiente" },
  autorizada: { texto: "Autorizada", variant: "verde" },
  rechazada: { texto: "Rechazada", variant: "cancelado" },
  surtida: { texto: "Surtida", variant: "recibido" },
} as const;

export function BadgeUbicacion({ u }: { u: EstadoUbicacion }) {
  if (u === "valida") return <Badge variant="verde">Ubicación válida</Badge>;
  if (u === "no_valida") return <Badge variant="rojo">Ubicación no válida</Badge>;
  return <Badge variant="gris">Ubicación no verificable</Badge>;
}

function leerGps(): Promise<GeolocationPosition | null> {
  return new Promise((res) => {
    if (!("geolocation" in navigator)) return res(null);
    navigator.geolocation.getCurrentPosition(res, () => res(null), {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

/** Fotos tomadas en el momento con la cámara: guarda fecha, hora y GPS. Rechaza fotos viejas (galería). */
export function FotosGps({ fotos, setFotos, minimo = 3 }: { fotos: FotoGps[]; setFotos: (f: FotoGps[]) => void; minimo?: number }) {
  const [subiendo, setSubiendo] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {fotos.map((f, i) => (
          <div key={f.ruta} className="flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs">
            <VerEvidencia foto={f.ruta} title={`Ver foto ${i + 1}`}>
              <span className="underline">Foto {i + 1}</span>
            </VerEvidencia>
            <span className="text-muted-foreground">
              {f.lat !== undefined ? `· GPS ±${Math.round(f.precision ?? 0)} m` : "· sin GPS"}
            </span>
            <button type="button" aria-label="Quitar foto" onClick={() => setFotos(fotos.filter((x) => x !== f))}>
              <X className="size-3" />
            </button>
          </div>
        ))}
      </div>
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-muted/50 p-3 text-sm text-muted-foreground hover:border-primary">
        {subiendo ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
        {subiendo ? "Guardando foto y ubicación…" : `Tomar foto (${fotos.length} de ${minimo} mínimo)`}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={subiendo}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            if (!fotoRecienTomada(file.lastModified, Date.now()))
              return void toast.error("Esa foto no es de este momento. Tómala con la cámara, no de la galería.");
            setSubiendo(true);
            try {
              const [pos, ruta] = await Promise.all([leerGps(), subirEvidencia(file)]);
              if (!pos) toast.warning("No se pudo leer la ubicación; la foto quedará sin GPS.");
              setFotos([
                ...fotos,
                {
                  ruta,
                  fecha: new Date().toISOString(),
                  lat: pos?.coords.latitude,
                  lng: pos?.coords.longitude,
                  precision: pos?.coords.accuracy,
                },
              ]);
            } catch {
              toast.error("No se pudo subir la foto. Intenta de nuevo.");
            } finally {
              setSubiendo(false);
            }
          }}
        />
      </label>
    </div>
  );
}

/** Fotos con su mapa y la distancia a la tabla más cercana con punto. */
export function MapaFotos({ fotos, tablas }: { fotos: FotoGps[]; tablas: Tabla[] }) {
  const conPunto = tablas.filter((t) => t.gps);
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {fotos.map((f, i) => {
        const cerca =
          f.lat !== undefined && f.lng !== undefined
            ? conPunto
                .map((t) => ({ t, d: distanciaM({ lat: f.lat!, lng: f.lng! }, t.gps!) }))
                .sort((a, b) => a.d - b.d)[0]
            : undefined;
        const dentro = cerca && cerca.d <= radioValidacion(cerca.t);
        return (
          <li key={f.ruta} className="overflow-hidden rounded-lg border border-border bg-card text-xs">
            {f.lat !== undefined && f.lng !== undefined ? (
              <iframe
                title={`Mapa foto ${i + 1}`}
                className="h-32 w-full"
                loading="lazy"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${f.lng - 0.004},${f.lat - 0.003},${f.lng + 0.004},${f.lat + 0.003}&layer=mapnik&marker=${f.lat},${f.lng}`}
              />
            ) : (
              <div className="flex h-32 items-center justify-center bg-muted text-muted-foreground">Sin GPS</div>
            )}
            <div className="space-y-1 p-2">
              <VerEvidencia foto={f.ruta} title={`Ver foto ${i + 1}`}>
                <span className="font-medium underline">Foto {i + 1}</span>
              </VerEvidencia>
              <div className="text-muted-foreground">{new Date(f.fecha).toLocaleString("es-MX")}</div>
              {cerca ? (
                <div className={dentro ? "text-primary" : "text-destructive"}>
                  <MapPin className="mr-1 inline size-3" />
                  {formatoNum(Math.round(cerca.d))} m de {cerca.t.nombre} (radio {formatoNum(radioValidacion(cerca.t))} m)
                </div>
              ) : (
                <div className="text-muted-foreground">Sin tabla con punto para comparar</div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Pestaña de Compras: solo llegan los extraordinarios ya autorizados. */
export function ExtrasCompras() {
  const { extraordinarios, surtir } = useFase3();
  const { tablas, productos, ranchos } = useCampo();
  const { pasaRancho, pasaTabla } = useFiltro();
  const lista = extraordinarios
    .filter((e) => e.status === "autorizada" || e.status === "surtida")
    .filter((e) => pasaRancho(e.ranchoId) && tablas.some((t) => e.tablaIds.includes(t.id) && pasaTabla(t)))
    .sort((a, b) => (a.status === b.status ? a.fechaMaxSurtido.localeCompare(b.fechaMaxSurtido) : a.status === "autorizada" ? -1 : 1));
  if (lista.length === 0)
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No hay extraordinarios autorizados. Solo aparecen aquí cuando el autorizador los aprueba.
      </p>
    );
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {lista.map((e) => (
        <article key={e.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
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
          <ul className="mt-3 space-y-1 text-sm">
            {cantidadesExtraordinario(e, tablas).map((c) => {
              const p = productos.find((x) => x.id === c.productoId);
              return (
                <li key={c.productoId} className="flex justify-between">
                  <span>{p?.nombre}</span>
                  <span className="num">
                    {formatoNum(c.cantidad)} {p?.unidad}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Surtir a más tardar {fechaCorta(e.fechaMaxSurtido)}</span>
            {e.status === "autorizada" ? (
              <Button
                size="sm"
                onClick={() => {
                  surtir(e.id);
                  toast.success(`${e.folio} surtido`);
                }}
              >
                <Check /> Marcar surtido
              </Button>
            ) : (
              <span>Surtido {e.surtido && fechaCorta(e.surtido.fecha)}</span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
