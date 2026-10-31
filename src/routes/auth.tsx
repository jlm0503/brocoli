import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { Loader2, MailCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import campo from "@/assets/campo-brocoli.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useSesion } from "@/lib/campo/sesion";

interface Busqueda {
  redirect?: string | undefined;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Busqueda => ({
    redirect: typeof s["redirect"] === "string" && s["redirect"].startsWith("/") ? s["redirect"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar · Brócoli control de insumos" },
      { name: "description", content: "Entra con tu correo y contraseña o crea tu cuenta para que el administrador te asigne tu puesto." },
      { property: "og:title", content: "Entrar · Brócoli control de insumos" },
      { property: "og:description", content: "Acceso para administrador, ingenieros de campo y compras." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function traducir(msg: string): string {
  if (/invalid login/i.test(msg)) return "Correo o contraseña incorrectos.";
  if (/email not confirmed/i.test(msg)) return "Primero confirma tu correo con el enlace que te enviamos.";
  if (/already registered|already exists/i.test(msg)) return "Ya existe una cuenta con ese correo. Entra con tu contraseña.";
  if (/not allowed|invalid.*email|email.*invalid/i.test(msg)) return "Ese correo no es válido. Revisa que esté bien escrito.";
  if (/password/i.test(msg) && /characters|short|weak/i.test(msg)) return "La contraseña es muy corta o débil; usa al menos 8 caracteres.";
  return "No se pudo completar. Intenta de nuevo.";
}

function AuthPage() {
  const { user, lista } = useSesion();
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [modo, setModo] = useState<"entrar" | "crear" | "olvide">("entrar");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [nombre, setNombre] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  if (lista && user && !aviso) return <Navigate to={redirect ?? "/"} />;

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave });
    setEnviando(false);
    if (error) return void toast.error(traducir(error.message));
    await navigate({ to: redirect ?? "/" });
  };

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return void toast.error("Escribe tu nombre.");
    setEnviando(true);
    const { error } = await supabase.auth.signUp({
      email: correo.trim(),
      password: clave,
      options: { emailRedirectTo: window.location.origin, data: { nombre: nombre.trim() } },
    });
    setEnviando(false);
    if (error) return void toast.error(traducir(error.message));
    setAviso(
      `Te enviamos un correo a ${correo.trim()}. Abre el enlace para confirmar tu cuenta; después el administrador te asigna tu puesto.`,
    );
  };

  const olvide = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(correo.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setEnviando(false);
    if (error) return void toast.error(traducir(error.message));
    setAviso(`Si ${correo.trim()} tiene cuenta, te llegará un correo para poner una contraseña nueva.`);
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.15fr_1fr]">
      <section className="relative hidden overflow-hidden bg-ink lg:block">
        <img src={campo} alt="Surcos de brócoli al amanecer" width={1600} height={1008} className="absolute inset-0 h-full w-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
        <div className="relative flex h-full flex-col justify-end p-12 text-ink-foreground">
          <span className="eyebrow !text-sidebar-primary">Brócoli · Control de insumos</span>
          <h1 className="mt-3 max-w-xl text-6xl leading-[0.95] font-medium">Cada quien, su pantalla.</h1>
        </div>
      </section>

      <section className="paper-grain flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="eyebrow">
            Brócoli · Control de insumos
          </Link>

          {aviso ? (
            <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-card">
              <MailCheck className="size-7 text-primary" />
              <p className="mt-3 text-sm leading-relaxed">{aviso}</p>
              <Button
                variant="outline"
                className="mt-5 w-full"
                onClick={() => {
                  setAviso(null);
                  setModo("entrar");
                }}
              >
                Volver a entrar
              </Button>
            </div>
          ) : modo === "olvide" ? (
            <form onSubmit={olvide} className="mt-6 space-y-4">
              <h2 className="text-3xl font-semibold">Recuperar contraseña</h2>
              <div className="space-y-2">
                <Label htmlFor="o-correo">Correo</Label>
                <Input id="o-correo" type="email" required value={correo} onChange={(e) => setCorreo(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={enviando}>
                {enviando && <Loader2 className="animate-spin" />} Enviar correo
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setModo("entrar")}>
                Volver
              </Button>
            </form>
          ) : (
            <Tabs value={modo} onValueChange={(v) => setModo(v as "entrar" | "crear")} className="mt-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="entrar">Entrar</TabsTrigger>
                <TabsTrigger value="crear">Crear cuenta</TabsTrigger>
              </TabsList>

              <TabsContent value="entrar">
                <form onSubmit={entrar} className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="e-correo">Correo</Label>
                    <Input id="e-correo" type="email" autoComplete="email" required value={correo} onChange={(e) => setCorreo(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="e-clave">Contraseña</Label>
                    <Input id="e-clave" type="password" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={enviando}>
                    {enviando && <Loader2 className="animate-spin" />} Entrar
                  </Button>
                  <button type="button" className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => setModo("olvide")}>
                    Olvidé mi contraseña
                  </button>
                </form>
              </TabsContent>

              <TabsContent value="crear">
                <form onSubmit={crear} className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="c-nombre">Tu nombre</Label>
                    <Input id="c-nombre" autoComplete="name" required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Israel" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="c-correo">Correo</Label>
                    <Input id="c-correo" type="email" autoComplete="email" required value={correo} onChange={(e) => setCorreo(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="c-clave">Contraseña</Label>
                    <Input id="c-clave" type="password" autoComplete="new-password" minLength={8} required value={clave} onChange={(e) => setClave(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={enviando}>
                    {enviando && <Loader2 className="animate-spin" />} Crear cuenta
                  </Button>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Al crearla no verás nada hasta que el administrador te asigne tu puesto.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </section>
    </div>
  );
}
