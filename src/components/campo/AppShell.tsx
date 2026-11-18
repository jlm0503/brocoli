import { Link, Navigate } from "@tanstack/react-router";

import logoUltra from "@/assets/logo-ultra.jpg.asset.json";
import {
  BellRing,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FlaskConical,
  Hourglass,
  FileText,
  LayoutGrid,
  Wallet,
  Loader2,
  LogOut,
  ShieldAlert,
  SlidersHorizontal,
  Sprout,
  Truck,
  Users,
  Bug,
  Siren,
  Undo2,
  Tractor,
  Receipt,
  TrendingUp,
  Archive,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { FiltroBar } from "@/components/campo/FiltroBar";
import { MiCuenta } from "@/components/campo/MiCuenta";
import { Button } from "@/components/ui/button";
import { fechaCorta } from "@/lib/campo/calc";
import { useAvisos } from "@/lib/campo/fase3";
import { agruparPantallas } from "@/lib/campo/navegacion";
import { NAV, ROLES, inicioDe, puedeVer, type NavPath } from "@/lib/campo/roles";
import { useSesion } from "@/lib/campo/sesion";
import { useCampo } from "@/lib/campo/store";

const ICONS: Record<NavPath, typeof Sprout> = {
  "/aplicaciones": FlaskConical,
  "/panel": LayoutGrid,
  "/ranchos": LayoutGrid,
  "/planeacion": Sprout,
  "/compras": ClipboardList,
  "/paquete": FlaskConical,
  "/catalogos": BookOpen,
  "/alertas": BellRing,
  "/usuarios": Users,
  "/parametros": SlidersHorizontal,
  "/solicitudes": FileText,
  "/cuenta-planta": Wallet,
  "/llegadas": Truck,
  "/extraordinarios": Bug,
  "/direccion": Siren,
  "/devoluciones": Undo2,
  "/cosecha": Tractor,
  "/liquidacion": Receipt,
  "/rendimiento": TrendingUp,
  "/historicos": Archive,
  "/consumo": Archive,
  "/gastos": Receipt,
  "/resultados": TrendingUp,
};

interface AppShellProps {
  path: NavPath;
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Muestra los filtros de rancho y cultivo arriba del contenido. */
  filtros?: boolean;
  children: ReactNode;
}

export function AppShell({ path, eyebrow, title, description, actions, filtros, children }: AppShellProps) {
  const { ready, semanaActual, hoy, semanasAdelantadas } = useCampo();
  const { lista, user, role, roles, nombre } = useSesion();
  const avisos = useAvisos();
  const [menuAbierto, setMenuAbierto] = useState(false);

  if (!lista) return <div className="min-h-screen bg-background" />;
  if (!user) return <Navigate to="/auth" />;
  if (!role) return <EsperandoPuesto />;
  if (!ready)
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-background text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Cargando datos…
      </div>
    );

  const allowed = puedeVer(roles, path);
  const items = NAV.filter((n) => puedeVer(roles, n.to));

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="flex flex-col bg-ink text-ink-foreground lg:sticky lg:top-0 lg:h-screen">
        <div className="flex items-center justify-between gap-3 px-5 py-5 lg:block">
          <Link to="/" className="block">
            <span className="block rounded-md bg-white px-3 py-2">
              <img src={logoUltra.url} alt="Ultrafarms" className="h-9 w-auto" />
            </span>
            <span className="eyebrow mt-2 block !text-sidebar-primary">Control de insumos</span>
          </Link>
          <div className="num rounded-md border border-sidebar-border px-2.5 py-1.5 text-xs lg:mt-5 lg:inline-block">
            Sem {semanaActual} · {fechaCorta(hoy)}
          </div>
        </div>

        <div className="px-3 pb-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuAbierto((v) => !v)}
            aria-expanded={menuAbierto}
            className="flex w-full items-center justify-between gap-3 rounded-md bg-sidebar-accent px-3 py-2.5 text-sm font-medium"
          >
            <span className="flex items-center gap-3">
              {(() => {
                const Icon = ICONS[path];
                return <Icon className="size-4" />;
              })()}
              {NAV.find((n) => n.to === path)?.label ?? "Menú"}
            </span>
            <ChevronDown
              className={`size-4 transition-transform ${menuAbierto ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        <nav
          className={`${menuAbierto ? "flex" : "hidden"} max-h-[62vh] flex-col gap-1 overflow-y-auto px-3 pb-3 lg:flex lg:max-h-none lg:flex-1 lg:pb-0`}
        >
          {agruparPantallas(items).map((grupo) => (
            <div key={grupo.id} className="shrink-0 pb-3">
              <h2 className="px-3 pt-3 pb-2 text-xs font-semibold uppercase text-ink-foreground/60">{grupo.label}</h2>
              {grupo.items.map((item) => {
            const Icon = ICONS[item.to];
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMenuAbierto(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-ink-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-ink-foreground"
                activeProps={{
                  className: "!bg-sidebar-primary !text-sidebar-primary-foreground font-medium",
                }}
              >
                <Icon className="size-4" />
                {item.label}
                {(avisos[item.to] ?? 0) > 0 && (
                  <span className="num ml-auto rounded-full bg-destructive px-1.5 text-[0.65rem] text-destructive-foreground">
                    {avisos[item.to]}
                  </span>
                )}
              </Link>
            );
              })}
            </div>
          ))}
        </nav>

        <div className="mt-auto hidden border-t border-sidebar-border p-4 lg:block">
          <span className="eyebrow !text-ink-foreground/60">{roles.map((r) => ROLES[r].nombre).join(" · ")}</span>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="truncate text-sm">{nombre}</span>
            <MiCuenta className="h-8 border-sidebar-border bg-sidebar-accent text-xs text-ink-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground" />
          </div>
          <span className="eyebrow mt-4 block !text-ink-foreground/60">Simular semana</span>
          <ControlSemana oscuro />
        </div>
      </aside>

      <main className="paper-grain min-w-0">
        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
          <div className="mb-3 flex items-center justify-between gap-2 lg:hidden">
            <span className="min-w-0 truncate text-xs text-muted-foreground">
              {nombre} · {roles.map((r) => ROLES[r].nombre).join(" · ")}
            </span>
            <div className="ml-auto">
              <ControlSemana />
            </div>
            <MiCuenta className="h-8 text-xs" />
          </div>

          {semanasAdelantadas > 0 && (
            <div className="mb-6 rounded-lg border border-soil/40 bg-soil-soft px-4 py-3 text-sm text-soil-foreground">
              Estás simulando la semana {semanaActual}. Lo que hagas aquí es práctica y no se
              guarda; con “Hoy” regresas a los datos reales.
            </div>
          )}

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
              {filtros && <FiltroBar />}
              {children}
            </>
          ) : (
            <div className="mx-auto mt-16 max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-card">
              <ShieldAlert className="mx-auto size-8 text-soil" />
              <h1 className="mt-4 text-2xl font-semibold">Esta pantalla no es para tu puesto</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {role === "personalizado" ? "No tienes permiso para ver esta sección." : `Como ${ROLES[role].nombre.toLowerCase()} no tienes acceso a esta sección.`}
              </p>
              <Button asChild className="mt-6">
                <Link to={inicioDe(roles)}>Ir a mi pantalla</Link>
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/** Pantalla para quien ya tiene cuenta pero aún no tiene puesto asignado. */
export function EsperandoPuesto() {
  const { nombre, user, salir, recargarPuesto } = useSesion();
  return (
    <div className="paper-grain flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-card">
        <Hourglass className="mx-auto size-8 text-soil" />
        <h1 className="mt-4 text-2xl font-semibold">Tu cuenta espera aprobación</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Hola {nombre || user?.email}. El administrador tiene que asignarte tu puesto; cuando lo
          haga, aquí verás tus pantallas.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={() => void recargarPuesto()}>Ya me aprobaron</Button>
          <Button variant="outline" onClick={() => void salir()}>
            <LogOut /> Salir
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Adelantar, regresar o volver a la semana real. Lo simulado no se guarda. */
function ControlSemana({ oscuro = false }: { oscuro?: boolean }) {
  const { semanaActual, semanasAdelantadas, avanzarSemana, regresarSemana, volverAHoy } =
    useCampo();
  const btn = oscuro
    ? "border-sidebar-border bg-sidebar-accent text-ink-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
    : "";
  return (
    <div className="mt-2 flex items-center gap-1">
      <Button
        size="icon"
        variant="outline"
        className={`size-8 ${btn}`}
        onClick={regresarSemana}
        disabled={semanasAdelantadas === 0}
        aria-label={`Regresar a la semana ${semanaActual - 1}`}
        title="Regresar una semana (deshace lo hecho en esta semana)"
      >
        <ChevronLeft />
      </Button>
      <span className="num min-w-16 text-center text-xs">Sem {semanaActual}</span>
      <Button
        size="icon"
        variant="outline"
        className={`size-8 ${btn}`}
        onClick={avanzarSemana}
        aria-label={`Pasar a la semana ${semanaActual + 1}`}
        title="Cierra la semana: lo no plantado pasa a un lote pendiente nuevo"
      >
        <ChevronRight />
      </Button>
      {semanasAdelantadas > 0 && (
        <Button size="sm" variant="outline" className={`h-8 text-xs ${btn}`} onClick={volverAHoy}>
          Hoy
        </Button>
      )}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
  compact = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "primary" | "soil";
  compact?: boolean;
}) {
  const toneClass =
    tone === "primary"
      ? "bg-primary text-primary-foreground"
      : tone === "soil"
        ? "bg-soil-soft text-soil-foreground"
        : "bg-card text-card-foreground";
  return (
    <div className={`min-w-0 border border-border shadow-card ${compact ? "rounded-lg p-3" : "rounded-xl p-5"} ${toneClass}`}>
      <span className={`${compact ? "block text-xs leading-snug" : "eyebrow"} ${tone === "primary" ? "!text-primary-foreground/70" : ""}`}>
        {label}
      </span>
      <div className={`num break-words font-medium ${compact ? "mt-1 text-xl" : "mt-2 text-3xl"}`}>{value}</div>
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
