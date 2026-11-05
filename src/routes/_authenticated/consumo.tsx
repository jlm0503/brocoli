import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/campo/AppShell";
import { useNombreLote } from "@/components/campo/Cosecha";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { consumoProductosLote, formatoNum } from "@/lib/campo/calc";
import { useCostos } from "@/lib/campo/costos";
import { useFase3 } from "@/lib/campo/fase3";
import { useFiltro } from "@/lib/campo/filtro";
import { useCampo } from "@/lib/campo/store";

export const Route = createFileRoute("/_authenticated/consumo")({
  head: () => ({
    meta: [
      { title: "Consumo por tabla cerrada · Brócoli" },
      { name: "description", content: "Total real de cada producto que consumió una tabla cerrada, descontando devoluciones." },
      { property: "og:title", content: "Consumo por tabla cerrada · Brócoli" },
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
      title="Consumo por tabla cerrada"
      description="Lo que realmente se usó de cada producto: recibido (receta, preparación y extraordinarios) menos lo devuelto."
      filtros
    >
      <Contenido />
    </AppShell>
  );
}

function Contenido() {
  const { lotes, productos, recepciones, pedidos } = useCampo();
  const { extraordinarios, devoluciones } = useFase3();
  const { porLote } = useCostos();
  const { pasaLote } = useFiltro();
  const nombreLote = useNombreLote();
  const cerrados = lotes.filter((l) => !l.cancelado && (l.cerrado || l.finalizado || l.cosechaTerminada) && pasaLote(l));
  const [sel, setSel] = useState("");
  const lote = cerrados.find((l) => l.id === sel) ?? cerrados[0];
  const filas = useMemo(
    () =>
      lote
        ? consumoProductosLote(lote, { lineas: porLote.get(lote.id) ?? [], recepciones, pedidos, extraordinarios, devoluciones })
        : [],
    [lote, porLote, recepciones, pedidos, extraordinarios, devoluciones],
  );
  const prod = new Map(productos.map((p) => [p.id, p]));

  if (!cerrados.length)
    return <p className="text-sm text-muted-foreground">Aún no hay tablas cerradas o con cosecha terminada.</p>;

  return (
    <div className="space-y-6">
      <div className="max-w-md space-y-2">
        <Label>Tabla cerrada</Label>
        <Select value={lote?.id ?? ""} onValueChange={setSel}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {cerrados.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {nombreLote(l)} · {formatoNum(l.ha)} ha{l.cerrado ? "" : " (cosecha terminada)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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
              <tr><td colSpan={7} className="p-3 text-muted-foreground">Esta tabla no tiene productos recibidos.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
