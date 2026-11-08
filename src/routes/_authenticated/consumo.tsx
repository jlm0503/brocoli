import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/campo/AppShell";
import { useNombreLote } from "@/components/campo/Cosecha";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { consumoProductosLote, formatoNum, formatoMXN } from "@/lib/campo/calc";
import { useCosecha } from "@/lib/campo/cosecha";
import { useCostos } from "@/lib/campo/costos";
import { useFase3 } from "@/lib/campo/fase3";
import { useFiltro } from "@/lib/campo/filtro";
import { useCampo } from "@/lib/campo/store";

export const Route = createFileRoute("/_authenticated/consumo")({
  head: () => ({
    meta: [
      { title: "Consumo por tabla · Brócoli" },
      { name: "description", content: "Total real de cada producto que consumió una tabla cerrada, descontando devoluciones." },
      { property: "og:title", content: "Consumo por tabla · Brócoli" },
      { property: "og:description", content: "Kilos y litros reales de cada producto por tabla, ya con devoluciones." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Consumo,
});

function Consumo() {
  return (
    <AppShell
      path="/consumo"
      eyebrow="Cierre · insumos"
      title="Consumo por tabla"
      description="Lo que realmente se usó de cada producto: recibido (receta, preparación y extraordinarios) menos lo devuelto."
      filtros
    >
      <Contenido />
    </AppShell>
  );
}

function Contenido() {
  const { lotes, productos, recepciones, pedidos, tablas, ranchos } = useCampo();
  const { ciclos } = useCosecha();
  const { extraordinarios, devoluciones } = useFase3();
  const { porLote } = useCostos();
  const { pasaLote, pasaRancho, pasaCultivo } = useFiltro();
  const importados = ciclos.filter((c) => c.importacion && pasaRancho(c.ranchoId) && pasaCultivo(c.cultivo));
  const nombreLote = useNombreLote();
  const cerrados = lotes.filter((l) => !l.cancelado && (l.cerrado || l.finalizado || l.cosechaTerminada || l.avances.length > 0 || (l.aplicacionesPrevias?.length ?? 0) > 0) && pasaLote(l));
  const [sel, setSel] = useState("");
  const historico = importados.find((c) => c.id === sel) ?? (!cerrados.length && !sel ? importados[0] : undefined);
  const lote = cerrados.find((l) => l.id === sel) ?? cerrados[0];
  const filas = useMemo(
    () =>
      lote
        ? consumoProductosLote(lote, { lineas: porLote.get(lote.id) ?? [], recepciones, pedidos, extraordinarios, devoluciones })
        : [],
    [lote, porLote, recepciones, pedidos, extraordinarios, devoluciones],
  );
  const prod = new Map(productos.map((p) => [p.id, p]));

  if (!cerrados.length && !importados.length)
    return <p className="text-sm text-muted-foreground">Aún no hay tablas cerradas o con cosecha terminada.</p>;

  return (
    <div className="space-y-6">
      <div className="max-w-md space-y-2">
        <Label>Tabla</Label>
        <Select value={historico?.id ?? lote?.id ?? ""} onValueChange={setSel}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {importados.map((c) => <SelectItem key={c.id} value={c.id}>{ranchos.find((r) => r.id === c.ranchoId)?.nombre} · {tablas.find((t) => t.id === c.tablaId)?.nombre} · {c.codigo} · {formatoNum(c.ha)} ha (histórico)</SelectItem>)}
            {cerrados.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {nombreLote(l)} · {formatoNum(l.ha)} ha{l.cerrado ? "" : l.cosechaTerminada ? " (cosecha terminada)" : l.avances.length ? " (activa)" : " (planeada)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {historico?.importacion ? <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full text-sm"><thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Producto</th><th className="p-3 text-right">Consumo de origen</th><th className="p-3 text-right">Por ha</th><th className="p-3 text-right">Costo de origen</th></tr></thead><tbody>{Object.values(historico.importacion.productos.reduce<Record<string, { nombre: string; unidad: string; cantidad: number; costo: number }>>((m, p) => { const k = `${p.nombre}|${p.unidad}`; const x = m[k] ?? { nombre: p.nombre, unidad: p.unidad, cantidad: 0, costo: 0 }; x.cantidad += p.cantidad; x.costo += p.costo; m[k] = x; return m; }, {})).map((p) => <tr key={`${p.nombre}|${p.unidad}`} className="border-t"><td className="p-3">{p.nombre}</td><td className="p-3 text-right font-mono">{formatoNum(p.cantidad)} {p.unidad}</td><td className="p-3 text-right font-mono">{formatoNum(p.cantidad / historico.ha)} {p.unidad}/ha</td><td className="p-3 text-right font-mono">{formatoMXN(p.costo)}</td></tr>)}</tbody></table></div> :
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Producto</th>
              <th className="p-3 text-right">Receta</th>
              <th className="p-3 text-right">Preparación</th>
              <th className="p-3 text-right">Extraordinarios</th>
              <th className="p-3 text-right">Devuelto</th>
              <th className="p-3 text-right">Consumo real</th>
              <th className="p-3 text-right">Por ha</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const p = prod.get(f.productoId);
              const u = p?.unidad ?? "";
              return (
                <tr key={f.productoId} className="border-t">
                  <td className="p-3 font-medium">{p?.nombre ?? f.productoId}</td>
                  <td className="p-3 text-right font-mono">{formatoNum(f.receta)}</td>
                  <td className="p-3 text-right font-mono">{formatoNum(f.planeacion)}</td>
                  <td className="p-3 text-right font-mono">{formatoNum(f.extraordinarios)}</td>
                  <td className="p-3 text-right font-mono text-destructive">{f.devuelto ? `−${formatoNum(f.devuelto)}` : "0"}</td>
                  <td className="p-3 text-right font-mono font-semibold">{formatoNum(f.neto)} {u}</td>
                  <td className="p-3 text-right font-mono">{formatoNum(f.porHa)} {u}/ha</td>
                </tr>
              );
            })}
            {!filas.length && (
              <tr><td colSpan={7} className="p-3 text-muted-foreground">Sin productos recibidos en la app.</td></tr>
            )}
          </tbody>
        </table>
      </div>}
      {!historico && lote?.aplicacionesPrevias?.length ? (
        <div className="space-y-2">
          <h3 className="font-semibold">Aplicaciones previas (sistema anterior{lote.folioProgramacion ? ` · ${lote.folioProgramacion}` : ""})</h3>
          <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full text-sm"><thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Producto</th><th className="p-3">Categoría</th><th className="p-3 text-right">Consumo</th><th className="p-3 text-right">Por ha</th><th className="p-3 text-right">Costo</th></tr></thead>
          <tbody>{lote.aplicacionesPrevias.map((a) => <tr key={`${a.nombre}|${a.unidad}`} className="border-t"><td className="p-3">{a.nombre}</td><td className="p-3">{a.categoria}</td><td className="p-3 text-right font-mono">{formatoNum(a.cantidad)} {a.unidad}</td><td className="p-3 text-right font-mono">{formatoNum(lote.ha ? a.cantidad / lote.ha : 0)} {a.unidad}/ha</td><td className="p-3 text-right font-mono">{formatoMXN(a.costo)}</td></tr>)}
          <tr className="border-t font-semibold"><td className="p-3" colSpan={4}>Total</td><td className="p-3 text-right font-mono">{formatoMXN(lote.aplicacionesPrevias.reduce((s, a) => s + a.costo, 0))}</td></tr></tbody></table></div>
        </div>
      ) : null}
    </div>
  );
}
