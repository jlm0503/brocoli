import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nueva contraseña · Brócoli control de insumos" },
      { name: "description", content: "Pon una contraseña nueva para entrar a la app de control de insumos." },
      { property: "og:title", content: "Nueva contraseña · Brócoli control de insumos" },
      { property: "og:description", content: "Recupera el acceso a tu cuenta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [valido, setValido] = useState<boolean | null>(null);
  const [clave, setClave] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const esRecuperacion = window.location.hash.includes("type=recovery");
    supabase.auth.getSession().then(({ data }) => setValido(esRecuperacion || !!data.session));
  }, []);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: clave });
    setEnviando(false);
    if (error) return void toast.error("No se pudo cambiar. Usa al menos 8 caracteres o pide otro correo.");
    toast.success("Contraseña cambiada");
    await navigate({ to: "/" });
  };

  return (
    <div className="paper-grain flex min-h-screen items-center justify-center bg-background px-6">
      <form onSubmit={guardar} className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6 shadow-card">
        <h1 className="text-3xl font-semibold">Contraseña nueva</h1>
        {valido === false ? (
          <p className="text-sm text-muted-foreground">
            El enlace no es válido o ya venció. Pide otro desde “Olvidé mi contraseña”.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="r-clave">Contraseña nueva</Label>
              <Input id="r-clave" type="password" autoComplete="new-password" minLength={8} required value={clave} onChange={(e) => setClave(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={enviando || valido === null}>
              {enviando && <Loader2 className="animate-spin" />} Guardar contraseña
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
