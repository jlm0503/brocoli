import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import {
  BellRing,
  BookOpen,
  ClipboardList,
  FastForward,
  FlaskConical,
  LayoutGrid,
  ShieldAlert,
  Sprout,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fechaCorta } from "@/lib/campo/calc";
import { NAV, ROLES, type NavPath } from "@/lib/campo/roles";
import { useCampo } from "@/lib/campo/store";
import type { Role } from "@/lib/campo/types";

const ICONS: Record<NavPath, typeof Sprout> = {
  "/ranchos": LayoutGrid,
  "/planeacion": Sprout,
  "/compras": ClipboardList,
  "/paquete": FlaskConical,
  "/catalogos": BookOpen,
  "/alertas": BellRing,
};

interface AppShellProps {
  path: NavPath;
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppShell({ path, eyebrow, title, description, actions, children }: AppShellProps) {
  const { ready, role, setRole, semanaActual, hoy, avanzarSemana } = useCampo();
  const navigate = useNavigate();

  if (!ready) return <div className="min-h-screen bg-background" />;
  if (!role) return <Navigate to="/" />;

  const allowed = NAV.find((n) => n.to === path)?.roles.includes(role);
  const items = NAV.filter((n) => n.roles.includes(role));

  const cambiarRol = (r: string) => {
    const nuevo = r as Role;
    setRole(nuevo);
    navigate({ to: ROLES[nuevo].home });
  };

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="flex flex-col bg-ink text-ink-foreground lg:sticky lg:top-0 lg:h-screen">
        <div className="flex items-center justify-between gap-3 px-5 py-5 lg:block">
          <Link to="/" className="block">
            <span className="eyebrow !text-sidebar-primary">Control de insumos</span>
            <span className="mt-1 block font-display text-3xl leading-none">Brócoli</span>
          </Link>
          <div className="num rounded-md border border-sidebar-border px-2.5 py-1.5 text-xs lg:mt-5 lg:inline-block">
            Sem {semanaActual} · {fechaCorta(hoy)}
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0">
          {items.map((item) => {
            const Icon = ICONS[item.to];
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-sm text-ink-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-ink-foreground"
                activeProps={{
                  className: "!bg-sidebar-primary !text-sidebar-primary-foreground font-medium",
                }}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto hidden border-t border-sidebar-border p-4 lg:block">
          <span className="eyebrow !text-ink-foreground/60">Entrando como</span>
          <Select value={role} onValueChange={cambiarRol}>
            <SelectTrigger className="mt-2 border-sidebar-border bg-sidebar-accent text-ink-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROLES) as Role[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLES[r].persona} · {ROLES[r].nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-3 text-xs leading-relaxed text-ink-foreground/55">
            Prototipo con datos de ejemplo. Los cambios no se guardan.
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-2 w-full justify-start px-2 text-xs text-ink-foreground/75 hover:bg-sidebar-accent hover:text-ink-foreground"
            onClick={avanzarSemana}
            title="Cierra la semana: lo no plantado pasa a un lote pendiente nuevo"
          >
            <FastForward /> Simular: pasar a semana {semanaActual + 1}
          </Button>
        </div>
      </aside>

      <main className="paper-grain min-w-0">
        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
          <div className="mb-3 flex items-center justify-between gap-2 lg:hidden">
            <span className="text-xs text-muted-foreground">
              {ROLES[role].persona} · {ROLES[role].nombre}
            </span>
            <Select value={role} onValueChange={cambiarRol}>
              <SelectTrigger className="h-8 w-auto text-xs">
                <SelectValue placeholder="Cambiar" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLES) as Role[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLES[r].persona} · {ROLES[r].nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {allowed ? (
            <>
              <header className="mb-8 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-2xl">
                  <span className="eyebrow">{eyebrow}</span>
                  <h1 className="mt-2 text-4xl leading-[1.05] font-semibold text-foreground sm:text-5xl">
                    {title}
                  </h1>
                  {description && (
                    <p className="mt-3 text-[0.95rem] leading-relaxed text-muted-foreground">
                      {description}
                    </p>
                  )}
                </div>
                {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
              </header>
              {children}
            </>
          ) : (
            <div className="mx-auto mt-16 max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-card">
              <ShieldAlert className="mx-auto size-8 text-soil" />
              <h1 className="mt-4 text-2xl font-semibold">Esta pantalla no es para tu puesto</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Como {ROLES[role].nombre.toLowerCase()} no tienes acceso a esta sección.
              </p>
              <Button asChild className="mt-6">
                <Link to={ROLES[role].home}>Ir a mi pantalla</Link>
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "primary" | "soil";
}) {
  const toneClass =
    tone === "primary"
      ? "bg-primary text-primary-foreground"
      : tone === "soil"
        ? "bg-soil-soft text-soil-foreground"
        : "bg-card text-card-foreground";
  return (
    <div className={`rounded-xl border border-border p-5 shadow-card ${toneClass}`}>
      <span className={`eyebrow ${tone === "primary" ? "!text-primary-foreground/70" : ""}`}>
        {label}
      </span>
      <div className="num mt-2 text-3xl font-medium">{value}</div>
      {hint && (
        <div
          className={`mt-1 text-xs ${tone === "primary" ? "text-primary-foreground/70" : "text-muted-foreground"}`}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
