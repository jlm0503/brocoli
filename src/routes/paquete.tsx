import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo } from "react";

import { AppShell, Stat } from "@/components/campo/AppShell";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  CICLO_MAX,
  CICLO_MIN,
  PRESIEMBRA_SEMANAS,
  dosisEnSemana,
  formatoMXN,
} from "@/lib/campo/calc";
import { useCampo } from "@/lib/campo/store";
import type { Familia } from "@/lib/campo/types";

export const Route = createFileRoute("/paquete")({
  head: () => ({
    meta: [
      { title: "Paquete tecnológico · Brócoli" },
      {
        name: "description",
        content: "Receta maestra de insumos por hectárea para cada semana del ciclo del brócoli.",
      },
      { property: "og:title", content: "Paquete tecnológico · Brócoli" },
      {
        property: "og:description",
        content: "Define productos, dosis por hectárea y precios por semana de vida del cultivo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Paquete,
});

const FAMILIAS: Familia[] = [
  "Suelo",
  "Agroquímico",
  "Riego",
  "Fertilizante",
  "Bioestimulante",
  "Micronutriente",
  "Fungicida",
  "Insecticida",
  "Herbicida",
];

function Paquete() {
  const { productos, receta, setCiclo, setDosis, setPresiembra, setPrecio } = useCampo();
  const semanas = Array.from({ length: CICLO_MAX }, (_, i) => i + 1);

  const costoSemana = useMemo(
    () =>
      semanas.map((w) =>
        productos.reduce((s, p) => s + dosisEnSemana(receta, p.id, w) * p.precio, 0),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productos, receta],
  );
  const costoPresiembra = productos.reduce(
    (s, p) => s + (receta.presiembra[p.id] ?? 0) * p.precio,
    0,
  );
  const costoCiclo = costoPresiembra + costoSemana.reduce((s, c) => s + c, 0);
  const picoIdx = costoSemana.indexOf(Math.max(...costoSemana));

  return (
    <AppShell
      path="/paquete"
      eyebrow="Administrador · receta maestra"
      title="Paquete tecnológico"
      description={`Dosis exacta por hectárea en cada semana de vida, más la presiembra (suelo, agroquímicos y manguera) que se entrega ${PRESIEMBRA_SEMANAS} semanas antes de plantar. Todo pedido de insumos sale de esta tabla; nadie más puede cambiarla.`}
      actions={
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 shadow-card">
          <span className="eyebrow">Ciclo</span>
          <ToggleGroup
            type="single"
            value={String(receta.semanas)}
            onValueChange={(v) => v && setCiclo(Number(v))}
          >
            {Array.from({ length: CICLO_MAX - CICLO_MIN + 1 }, (_, i) => CICLO_MIN + i).map((n) => (
              <ToggleGroupItem
                key={n}
                value={String(n)}
                className="num data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                {n} sem
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      }
    >
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Costo por ha del ciclo"
          value={formatoMXN(costoCiclo)}
          hint={`Incluye ${formatoMXN(costoPresiembra)} de presiembra`}
          tone="primary"
        />
        <Stat
          label="Semana de mayor gasto"
          value={`Sem ${picoIdx + 1}`}
          hint={`${formatoMXN(costoSemana[picoIdx] ?? 0)} por ha`}
          tone="soil"
        />
        <Stat label="Productos en receta" value={productos.length} hint={`${FAMILIAS.length} familias`} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[1010px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/60 text-left">
              <th className="sticky left-0 z-10 bg-secondary px-4 py-3 font-medium">Producto</th>
              <th className="px-2 py-3 font-medium">Unidad</th>
              <th className="px-2 py-3 font-medium">Precio</th>
              <th className="border-r border-border bg-soil-soft px-1 py-3 text-center text-xs font-medium text-soil-foreground">
                Presiembra
                <div className="num font-normal opacity-80">{PRESIEMBRA_SEMANAS} sem antes</div>
              </th>
              {semanas.map((w) => (
                <th
                  key={w}
                  className={`num px-1 py-3 text-center text-xs font-medium ${w > receta.semanas ? "text-muted-foreground/50" : ""}`}
                >
                  S{w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FAMILIAS.map((fam) => {
              const items = productos.filter((p) => p.familia === fam);
              if (items.length === 0) return null;
              return (
                <Fragment key={fam}>
                  <tr>
                    <td
                      colSpan={4 + CICLO_MAX}
                      className="sticky left-0 bg-card px-4 pt-4 pb-1"
                    >
                      <span className="eyebrow">{fam}</span>
                    </td>
                  </tr>
                  {items.map((p) => (
                    <tr key={p.id} className="border-b border-border/60 last:border-0">
                      <td className="sticky left-0 z-10 bg-card px-4 py-1.5 font-medium whitespace-nowrap">
                        {p.nombre}
                      </td>
                      <td className="px-2 text-muted-foreground">{p.unidad === "rollo" ? "rollos" : p.unidad}/ha</td>
                      <td className="px-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">$</span>
                          <input
                            type="number"
                            min="0"
                            value={p.precio}
                            onChange={(e) => setPrecio(p.id, Number(e.target.value))}
                            className="num w-16 rounded border border-transparent bg-transparent px-1.5 py-1 text-right hover:border-input focus:border-ring focus:outline-none"
                            aria-label={`Precio de ${p.nombre}`}
                          />
                        </div>
                      </td>
                      <td className="border-r border-border bg-soil-soft/40 px-0.5 py-1">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={(receta.presiembra[p.id] ?? 0) === 0 ? "" : receta.presiembra[p.id]}
                          placeholder="·"
                          onChange={(e) => setPresiembra(p.id, Number(e.target.value))}
                          className={`num w-full min-w-14 rounded px-0.5 py-1.5 text-center text-xs focus:ring-1 focus:ring-ring focus:outline-none ${(receta.presiembra[p.id] ?? 0) > 0 ? "bg-soil-soft text-soil-foreground" : "bg-transparent hover:bg-muted"}`}
                          aria-label={`${p.nombre} presiembra`}
                        />
                      </td>
                      {semanas.map((w) => {
                        const fuera = w > receta.semanas;
                        const v = receta.dosis[p.id]?.[w - 1] ?? 0;
                        return (
                          <td key={w} className={`px-0.5 py-1 ${fuera ? "furrows" : ""}`}>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              disabled={fuera}
                              value={v === 0 ? "" : v}
                              placeholder="·"
                              onChange={(e) => setDosis(p.id, w - 1, Number(e.target.value))}
                              className={`num w-full min-w-10 rounded px-0.5 py-1.5 text-center text-xs focus:ring-1 focus:ring-ring focus:outline-none disabled:opacity-30 ${v > 0 && !fuera ? "bg-primary-soft text-accent-foreground" : "bg-transparent hover:bg-muted"}`}
                              aria-label={`${p.nombre} semana ${w}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-ink text-ink-foreground">
              <td className="sticky left-0 z-10 bg-ink px-4 py-3 font-medium" colSpan={3}>
                Costo por ha en la semana
              </td>
              <td className="num border-r border-ink-foreground/20 px-1 py-3 text-center text-[0.7rem]">
                ${Math.round(costoPresiembra).toLocaleString("es-MX")}
              </td>
              {costoSemana.map((c, i) => (
                <td
                  key={i}
                  className={`num px-1 py-3 text-center text-[0.7rem] ${i + 1 > receta.semanas ? "opacity-30" : ""}`}
                >
                  {i + 1 > receta.semanas ? "—" : `$${Math.round(c).toLocaleString("es-MX")}`}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Cambia una dosis o precio y verás el efecto inmediato en compras y en el costo de cada tabla.
      </p>
    </AppShell>
  );
}
