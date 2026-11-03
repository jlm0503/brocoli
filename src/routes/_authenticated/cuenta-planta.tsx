import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell, Stat } from "@/components/campo/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  abonosViajes,
  cargosPlanta,
  cuentaMensual,
  cuentaPlanta,
  fechaCorta,
  folioSolicitud,
  formatoMXN,
  formatoNum,
} from "@/lib/campo/calc";
import { useCampo } from "@/lib/campo/store";
import { useCosecha } from "@/lib/campo/cosecha";
import { useFiltro } from "@/lib/campo/filtro";
import type { MovimientoPlanta } from "@/lib/campo/types";

export const Route = createFileRoute("/_authenticated/cuenta-planta")({
  head: () => ({
    meta: [
      { title: "Cuenta de planta · Brócoli" },
      {
        name: "description",
        content: "Cargos por planta recibida contra los descuentos de la congeladora por viaje, con saldo acumulado.",
      },
      { property: "og:title", content: "Cuenta de planta · Brócoli" },
      { property: "og:description", content: "Relación entre plantas recibidas, cargos y descuentos de la congeladora." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CuentaPlanta,
});

function rangoMes(hoy: string, atras = 0): [string, string] {
  let y = Number(hoy.slice(0, 4));
  let m = Number(hoy.slice(5, 7)) - atras;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  const mes = `${y}-${String(m).padStart(2, "0")}`;
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [`${mes}-01`, `${mes}-${ultimo}`];
}

function CuentaPlanta() {
  const { solicitudes, hoy } = useCampo();
  const { viajes } = useCosecha();
  const { pasaLoteId } = useFiltro();
  // Abonos: el descuento de planta de cada viaje evaluado.
  const movimientos = useMemo<MovimientoPlanta[]>(
    () =>
      [...cargosPlanta(solicitudes), ...abonosViajes(viajes)]
        .filter((m) => !m.loteId || pasaLoteId(m.loteId))
        .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [solicitudes, viajes, pasaLoteId],
  );
  const primero = movimientos[0]?.fecha ?? `${hoy.slice(0, 4)}-01-01`;
  const atajos: { label: string; rango: [string, string] }[] = [
    { label: "Este mes", rango: rangoMes(hoy) },
    { label: "Mes pasado", rango: rangoMes(hoy, 1) },
    { label: "Este año", rango: [`${hoy.slice(0, 4)}-01-01`, `${hoy.slice(0, 4)}-12-31`] },
    { label: "Todo", rango: [primero < hoy ? primero : hoy, hoy] },
  ];
  const [[desde, hasta], setRango] = useState<[string, string]>(atajos[2]!.rango);
  const r = cuentaPlanta(movimientos, desde, hasta);
  const meses = desde <= hasta ? cuentaMensual(movimientos, desde, hasta) : [];
  const delPeriodo = movimientos.filter((m) => m.fecha >= desde && m.fecha <= hasta).reverse();

  return (
    <AppShell
      path="/cuenta-planta"
      eyebrow="Administrador · planta"
      title="Cuenta de planta"
      description="La planta la financia la congeladora: cada planta recibida es un cargo y cada viaje evaluado un descuento. La cuenta corre todo el año y no se cierra en cero."
      filtros
    >
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-2">
          {atajos.map((a) => (
            <Button
              key={a.label}
              size="sm"
              variant={a.rango[0] === desde && a.rango[1] === hasta ? "default" : "outline"}
              onClick={() => setRango(a.rango)}
            >
              {a.label}
            </Button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="cp-desde" className="text-xs">
              Desde
            </Label>
            <Input id="cp-desde" type="date" value={desde} onChange={(e) => setRango([e.target.value, hasta])} className="num h-8" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cp-hasta" className="text-xs">
              Hasta
            </Label>
            <Input id="cp-hasta" type="date" value={hasta} onChange={(e) => setRango([desde, e.target.value])} className="num h-8" />
          </div>
        </div>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Plantas recibidas"
          value={formatoNum(r.plantas)}
          hint={`${formatoNum(r.haEquivalentes)} ha equivalentes`}
        />
        <Stat label="Cargos de planta" value={formatoMXN(r.cargos)} tone="soil" />
        <Stat
          label="Descuentos de la congeladora"
          value={formatoMXN(r.descuentos)}
          hint={r.viajes > 0 ? `${r.viajes} viajes evaluados` : "Llegan con la captura de cosecha"}
        />
        <Stat
          label="Relación descuento / cargo"
          value={r.relacion === null ? "—" : `${formatoNum(r.relacion)}%`}
          tone="primary"
        />
      </div>
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Saldo del periodo" value={formatoMXN(r.saldoPeriodo)} hint="Positivo = debo" />
        <Stat
          label="Saldo acumulado"
          value={formatoMXN(r.saldoAcumulado)}
          hint={r.saldoAcumulado < 0 ? "Me descontaron de más" : "Al cierre del periodo"}
        />
        <Stat label="Descuento por ha cosechada" value="—" hint="Con la captura de cosecha" />
        <Stat label="Descuento por kg pagable" value="—" hint="Con la captura de cosecha" />
      </div>

      <section className="mb-10 rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="mb-4 text-xl font-semibold">Cargos contra descuentos por mes</h2>
        {meses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Elige un periodo válido.</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={meses} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="etiqueta" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v: number) => `$${formatoNum(v / 1000)}k`}
                  width={56}
                />
                <Tooltip
                  formatter={(v: number) => formatoMXN(v)}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="cargos" name="Cargos" fill="var(--soil)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="descuentos" name="Descuentos" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                <Line dataKey="saldo" name="Saldo acumulado" stroke="var(--foreground)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Movimientos del periodo</h2>
        {delPeriodo.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
            Sin movimientos. Los cargos aparecen al marcar “Planta recibida” en Solicitudes de planta.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card text-sm shadow-card">
            {delPeriodo.map((m, i) => (
              <li key={`${m.fecha}-${m.loteId ?? i}-${i}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <span>
                  {m.tipo === "cargo" ? `Planta · ${m.tabla} · lote ${m.lote}` : "Descuento por viaje"}
                  <span className="num block text-xs text-muted-foreground">
                    {fechaCorta(m.fecha)}
                    {m.folio ? ` · ${folioSolicitud(m.folio)}` : ""}
                    {m.plantas ? ` · ${formatoNum(m.plantas)} plantas` : ""}
                  </span>
                </span>
                <span className={`num ${m.tipo === "abono" ? "text-primary" : ""}`}>
                  {m.tipo === "abono" ? "−" : ""}
                  {formatoMXN(m.monto)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
