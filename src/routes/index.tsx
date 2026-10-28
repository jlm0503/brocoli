import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import campo from "@/assets/campo-brocoli.jpg";
import { ROLES } from "@/lib/campo/roles";
import { useCampo } from "@/lib/campo/store";
import type { Role } from "@/lib/campo/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Brócoli · Elige tu puesto" },
      {
        name: "description",
        content:
          "Entra como administrador, ingeniero de campo o compras para planear la siembra y surtir insumos con la receta maestra.",
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
  const { setRole } = useCampo();
  const navigate = useNavigate();

  const entrar = (r: Role) => {
    setRole(r);
    navigate({ to: ROLES[r].home });
  };

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
          <span className="eyebrow !text-sidebar-primary">Ciclo 2026 · Semana 44</span>
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
          <h2 className="mt-2 text-3xl font-semibold">¿Quién entra hoy?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Cada puesto ve solo las pantallas que le corresponden.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            {ORDEN.map((r) => (
              <button
                key={r}
                onClick={() => entrar(r)}
                className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lift"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft font-display text-xl text-primary">
                  {ROLES[r].persona[0]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground">
                    {ROLES[r].persona}{" "}
                    <span className="font-normal text-muted-foreground">· {ROLES[r].nombre}</span>
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {ROLES[r].descripcion}
                  </span>
                </span>
                <ArrowRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </button>
            ))}
          </div>

          <p className="mt-8 text-xs text-muted-foreground">
            Prototipo navegable con datos de ejemplo. Nada se guarda.
          </p>
        </div>
      </section>
    </div>
  );
}
