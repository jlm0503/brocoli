import { Camera, Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

const BUCKET = "evidencias";

/** Sube la foto al almacén privado y regresa su ruta (lo que se guarda en el pedido o la alerta). */
export async function subirEvidencia(file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const ruta = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, file, file.type ? { contentType: file.type } : {});
  if (error) throw error;
  return ruta;
}

/** Campo para tomar o subir la foto de evidencia. `setFoto` recibe la ruta ya guardada. */
export function FotoInput({
  foto,
  setFoto,
  texto = "Tomar o subir foto",
  alt = "Evidencia",
  galeria = false,
  pdf = false,
}: {
  foto?: string | undefined;
  setFoto: (ruta: string) => void;
  texto?: string;
  alt?: string;
  /** Permite elegir de la galería (p. ej. fotos que llegan por chat). */
  galeria?: boolean;
  /** Acepta también PDF. */
  pdf?: boolean;
}) {
  const [vista, setVista] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  return (
    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-muted/50 p-4 text-sm text-muted-foreground transition-colors hover:border-primary">
      {vista && foto ? (
        <img src={vista} alt={alt} className="max-h-40 rounded-md" />
      ) : subiendo ? (
        <>
          <Loader2 className="size-5 animate-spin" /> Subiendo foto…
        </>
      ) : (
        <>
          <Camera className="size-5" />
          {texto}
        </>
      )}
      <input
        type="file"
        accept={pdf ? "image/*,application/pdf" : "image/*"}
        {...(galeria || pdf ? {} : { capture: "environment" as const })}
        className="sr-only"
        disabled={subiendo}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setSubiendo(true);
          try {
            const ruta = await subirEvidencia(file);
            setVista(file.type === "application/pdf" ? null : URL.createObjectURL(file));
            if (file.type === "application/pdf") toast.success(`PDF guardado: ${file.name}`);
            setFoto(ruta);
          } catch {
            toast.error("No se pudo subir la foto. Intenta de nuevo.");
          } finally {
            setSubiendo(false);
          }
        }}
      />
    </label>
  );
}

/** Abre la foto de evidencia guardada (enlace temporal privado). */
export function VerEvidencia({ foto, title, children }: { foto: string; title: string; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className="inline-flex"
      onClick={async () => {
        const ventana = window.open("", "_blank");
        const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(foto, 60 * 10);
        if (error || !data) {
          ventana?.close();
          toast.error("No se pudo abrir la foto.");
          return;
        }
        if (ventana) ventana.location.href = data.signedUrl;
        else window.location.href = data.signedUrl;
      }}
    >
      {children}
    </button>
  );
}
