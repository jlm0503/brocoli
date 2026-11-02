import { KeyRound, LogOut, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { eliminarMiCuenta } from "@/lib/campo/cuenta.functions";
import { useSesion } from "@/lib/campo/sesion";

/** Botón "Mi cuenta": cambiar contraseña, cerrar sesión y eliminar la cuenta. */
export function MiCuenta({ className }: { className?: string }) {
  const { user, nombre, salir } = useSesion();
  const [open, setOpen] = useState(false);
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [borrar, setBorrar] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const cambiar = async () => {
    if (nueva.length < 8)
      return void toast.error("La contraseña nueva debe tener al menos 8 caracteres.");
    if (nueva !== confirmar) return void toast.error("Las contraseñas nuevas no coinciden.");
    setOcupado(true);
    const { error } = await supabase.auth.updateUser({
      password: nueva,
      current_password: actual,
    } as never);
    setOcupado(false);
    if (error) return void toast.error("No se pudo cambiar. Revisa tu contraseña actual.");
    toast.success("Contraseña cambiada");
    setActual("");
    setNueva("");
    setConfirmar("");
  };

  const eliminar = async () => {
    setOcupado(true);
    try {
      const r = await eliminarMiCuenta();
      if ("error" in r) return void toast.error(r.error);
      toast.success("Tu cuenta fue eliminada");
      await salir();
    } catch {
      toast.error("No se pudo eliminar la cuenta.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" className={className} onClick={() => setOpen(true)}>
        <UserRound /> Mi cuenta
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setBorrar(false);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Mi cuenta</DialogTitle>
            <DialogDescription>
              {nombre} · {user?.email}
            </DialogDescription>
          </DialogHeader>

          <section className="space-y-3">
            <h3 className="flex items-center gap-2 font-medium">
              <KeyRound className="size-4" /> Cambiar contraseña
            </h3>
            <div className="space-y-1">
              <Label htmlFor="mc-actual">Contraseña actual</Label>
              <Input
                id="mc-actual"
                type="password"
                autoComplete="current-password"
                value={actual}
                onChange={(e) => setActual(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mc-nueva">Contraseña nueva</Label>
              <Input
                id="mc-nueva"
                type="password"
                autoComplete="new-password"
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mc-conf">Repite la contraseña nueva</Label>
              <Input
                id="mc-conf"
                type="password"
                autoComplete="new-password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
              />
            </div>
            <Button onClick={() => void cambiar()} disabled={ocupado || !actual || !nueva}>
              Guardar contraseña
            </Button>
          </section>

          <section className="space-y-2 border-t border-border pt-4">
            <Button variant="outline" className="w-full" onClick={() => void salir()}>
              <LogOut /> Cerrar sesión
            </Button>
          </section>

          <section className="space-y-2 border-t border-border pt-4">
            {borrar ? (
              <div className="space-y-2 rounded-lg bg-destructive/10 p-3 text-sm">
                <p>
                  ¿Seguro? Tu cuenta se borra y ya no podrás entrar. Lo que capturaste en la app se
                  queda.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setBorrar(false)}>
                    No
                  </Button>
                  <Button variant="destructive" onClick={() => void eliminar()} disabled={ocupado}>
                    Sí, eliminar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                className="w-full text-destructive"
                onClick={() => setBorrar(true)}
              >
                <Trash2 /> Eliminar mi cuenta
              </Button>
            )}
          </section>
        </DialogContent>
      </Dialog>
    </>
  );
}
