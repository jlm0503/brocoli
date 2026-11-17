import { Download, Loader2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { entregarPdfSalida, pdfSalida } from "@/lib/campo/pdf-salida";
import type { Viaje } from "@/lib/campo/types";

export function PdfSalida({ viaje, onClose }: { viaje: Viaje | null; onClose: () => void }) {
  const [pdf, setPdf] = useState<{ id: string; blob: Blob } | null>(null);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    if (!viaje) return;
    let activo = true;
    setError(false);
    void pdfSalida(viaje).then((blob) => { if (activo) setPdf({ id: viaje.id, blob }); }).catch(() => { if (activo) setError(true); });
    return () => { activo = false; };
  }, [viaje, intento]);
  const blob = pdf?.id === viaje?.id ? pdf?.blob : undefined;
  const entregar = (compartir: boolean) => {
    if (!blob || !viaje) return;
    void entregarPdfSalida(blob, viaje.folio, compartir).catch(() => toast.error("No se pudo compartir el PDF. Puedes descargarlo."));
  };
  return <Dialog open={!!viaje} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent>
      <DialogHeader><DialogTitle>Salida {viaje?.folio} · PDF</DialogTitle></DialogHeader>
      {error ? <div className="space-y-3"><p className="text-sm text-destructive">No se pudieron cargar las fotos del PDF.</p><Button variant="outline" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button></div>
        : !blob ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Preparando PDF…</p>
        : <div className="flex flex-wrap gap-2"><Button onClick={() => entregar(true)}><Share2 /> Compartir por WhatsApp</Button><Button variant="outline" onClick={() => entregar(false)}><Download /> Descargar PDF</Button></div>}
    </DialogContent>
  </Dialog>;
}