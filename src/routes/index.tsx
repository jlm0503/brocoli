import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import campo from "@/assets/campo-brocoli.jpg";
import { EsperandoPuesto } from "@/components/campo/AppShell";
import { Button } from "@/components/ui/button";
import { ROLES } from "@/lib/campo/roles";
import { useSesion } from "@/lib/campo/sesion";
import { useCampo } from "@/lib/campo/store";
import type { Role } from "@/lib/campo/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Brócoli · Control de insumos por receta" },
      {
        name: "description",
        content:
          "Administrador, ingenieros de campo y compras planean la siembra y surten insumos con la receta maestra.",
      },
      { property: "og:title", content: "Brócoli · Control de insumos por receta" },
      {
        property: "og:description",
        content: "Cada kilo de fertilizante calculado por hectárea real plantada y su semana de vida.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const ORDEN: Role[] = ["admin", "ingeniero", "compras"];

function Index() {
  const { lista, user, role } = useSesion();
  const { semanaActual } = useCampo();

  if (lista && user && role) return <Navigate to={ROLES[role].home} />;
  if (lista && user && !role) return <EsperandoPuesto />;

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.15fr_1fr]">
      <section className="relative min-h-[42vh] overflow-hidden bg-ink lg:min-h-screen">
        <img
          src={campo}
          alt="Surcos de brócoli al amanecer"
          width={1600}
          height={1008}
          className="absolute inset-0 h-full w-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
        <div className="relative flex h-full flex-col justify-end p-8 text-ink-foreground sm:p-12">
          <span className="eyebrow !text-sidebar-primary">Ciclo 2026 · Semana {semanaActual}</span>
          <h1 className="mt-3 max-w-xl text-5xl leading-[0.95] font-medium sm:text-7xl">
            Ni un kilo de más.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-ink-foreground/80">
            Los insumos se calculan con la receta maestra y las hectáreas que de verdad se
            plantaron. Sin pedidos libres.
          </p>
        </div>
      </section>

      <section className="paper-grain flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-md">
          <span className="eyebrow">Brócoli · Control de insumos</span>
          <h2 className="mt-2 text-3xl font-semibold">Entra con tu cuenta</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Cada persona entra con su correo y solo ve las pantallas de su puesto.
          </p>

          <ul className="mt-8 space-y-3">
            {ORDEN.map((r) => (
              <li key={r} className="flex items-start gap-4 rounded-xl border border-border bg-card p-4 shadow-card">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft font-display text-lg text-primary">
                  {ROLES[r].nombre[0]}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{ROLES[r].nombre}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{ROLES[r].descripcion}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-2 sm:flex-row">
            <Button asChild className="flex-1">
              <Link to="/auth">
                Entrar <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link to="/auth">Crear cuenta</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
