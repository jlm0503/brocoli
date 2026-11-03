import { createFileRoute } from "@tanstack/react-router";
import { ImageIcon, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/campo/AppShell";
import { FotoInput, VerEvidencia } from "@/components/campo/Evidencia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  cantidadesExtraordinario,
  consumoTeorico,
  estatusLinea,
  formatoMXN,
  formatoNum,
  lineasSemana,
} from "@/lib/campo/calc";
import { useFase3 } from "@/lib/campo/fase3";
import { useCampo } from "@/lib/campo/store";

export const Route = createFileRoute("/_authenticated/devoluciones")({
  head: () => ({
    meta: [
      { title: "Devoluciones de no consumido · Brócoli" },
      { name: "description", content: "El Almacén general registra cada semana lo que se retira sin usar; se resta del costo del lote." },
      { property: "og:title", content: "Devoluciones de no consumido · Brócoli" },
      { property: "og:description", content: "Producto, cantidad y foto de lo retirado, y consumo teórico por tabla." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Devoluciones,
});

function Devoluciones() {
  const { ranchos, tablas, productos, semanaActual, lotes, recetas, adicionales, recepciones } = useCampo();
  const { devoluciones, registrarDevolucion, eliminarDevolucion, extraordinarios } = useFase3();
  const [ranchoId, setRanchoId] = useState(ranchos[0]?.id ?? "");
  const [tablaId, setTablaId] = useState("");
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [foto, setFoto] = useState<string | undefined>();
  const [clave, setClave] = useState(0);

  const deSemana = devoluciones.filter((d) => d.semana === semanaActual);

  // Reporte por tabla: receta esperada (entregada) contra consumo teórico (entregado − retirado).
  const reporte = useMemo(() => {
    const desde = Math.min(semanaActual, ...lotes.flatMap((l) => l.avances.map((a) => a.semana)));
    const semanas = Array.from({ length: semanaActual - desde + 1 }, (_, i) => desde + i);
    const lineas = lineasSemana(lotes, recetas, adicionales, semanas).filter(
      (l) => estatusLinea(l, recepciones, semanaActual) === "recibido",
    );
    const filas = new Map<string, { tablaId: string; productoId: string; esperado: number; retirado: number }>();
    const fila = (tablaId: string, productoId: string) => {
      const k = `${tablaId}|${productoId}`;
      const f = filas.get(k) ?? { tablaId, productoId, esperado: 0, retirado: 0 };
      filas.set(k, f);
      return f;
    };
    for (const l of lineas) fila(l.tablaId, l.productoId).esperado += l.cantidad;
    for (const e of extraordinarios.filter((x) => x.status === "surtida")) {
      const ts = tablas.filter((t) => e.tablaIds.includes(t.id));
      for (const t of ts)
        for (const c of cantidadesExtraordinario({ ...e, tablaIds: [t.id] }, tablas)) fila(t.id, c.productoId).esperado += c.cantidad;
    }
    for (const d of devoluciones) fila(d.tablaId, d.productoId).retirado += d.cantidad;
    return [...filas.values()].filter((f) => f.retirado > 0);
  }, [lotes, recetas, adicionales, recepciones, semanaActual, devoluciones, extraordinarios, tablas]);

  const guardar = () => {
    const e = registrarDevolucion({ tablaId, productoId, cantidad: Number(cantidad), foto });
    if (e) return void toast.error(e);
    toast.success("Devolución registrada; se resta del costo del lote.");
    setCantidad("");
    setFoto(undefined);
    setClave((k) => k + 1);
  };

  const nombreT = (id: string) => tablas.find((t) => t.id === id)?.nombre ?? "—";
  const prod = (id: string) => productos.find((p) => p.id === id);

  return (
    <AppShell
      path="/devoluciones"
      eyebrow={`Almacén general · semana ${semanaActual}`}
      title="Devoluciones de no consumido"
      description="La aplicación se registra en otra app. Aquí se captura lo que se retira sin usar: producto, cantidad y foto. Lo retirado sale del costo del lote."
    >
      <section className="mb-10 rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="mb-4 text-2xl font-semibold">Registrar lo retirado</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Rancho</Label>
            <Select
              value={ranchoId}
              onValueChange={(v) => {
                setRanchoId(v);
                setTablaId("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ranchos.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tabla</Label>
            <Select value={tablaId} onValueChange={setTablaId}>
              <SelectTrigger>
                <SelectValue placeholder="Elige" />
              </SelectTrigger>
              <SelectContent>
                {tablas
                  .filter((t) => t.ranchoId === ranchoId)
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Producto</Label>
            <Select value={productoId} onValueChange={setProductoId}>
              <SelectTrigger>
                <SelectValue placeholder="Elige" />
              </SelectTrigger>
              <SelectContent>
                {productos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre} ({p.unidad})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dv-cant">Cantidad retirada</Label>
            <Input id="dv-cant" type="number" inputMode="decimal" className="num" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <FotoInput key={clave} foto={foto} setFoto={setFoto} texto="Foto de lo retirado" />
          <Button onClick={guardar}>Guardar devolución</Button>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-2xl font-semibold">Retirado esta semana</h2>
        {deSemana.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada registrado en la semana {semanaActual}.</p>
        ) : (
          <ul className="space-y-2">
            {deSemana.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm">
                <span>
                  <span className="font-medium">{prod(d.productoId)?.nombre}</span> ·{" "}
                  <span className="num">
                    {formatoNum(d.cantidad)} {prod(d.productoId)?.unidad}
                  </span>{" "}
                  · {nombreT(d.tablaId)} · {formatoMXN(d.cantidad * d.precio)} menos al lote
                </span>
                <span className="flex gap-1">
                  <VerEvidencia foto={d.foto} title="Ver foto">
                    <ImageIcon className="size-4" />
                  </VerEvidencia>
                  <Button size="icon" variant="ghost" aria-label="Eliminar devolución" onClick={() => eliminarDevolucion(d.id)}>
                    <Trash2 />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-semibold">Receta esperada contra consumo teórico</h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Tabla</th>
                <th className="px-4 py-2 font-medium">Producto</th>
                <th className="px-4 py-2 text-right font-medium">Esperado (entregado)</th>
                <th className="px-4 py-2 text-right font-medium">Retirado</th>
                <th className="px-4 py-2 text-right font-medium">Consumo teórico</th>
              </tr>
            </thead>
            <tbody>
              {reporte.map((f) => (
                <tr key={`${f.tablaId}${f.productoId}`} className="border-t border-border/60">
                  <td className="px-4 py-2">{nombreT(f.tablaId)}</td>
                  <td className="px-4 py-2">{prod(f.productoId)?.nombre}</td>
                  <td className="num px-4 py-2 text-right">{formatoNum(f.esperado)}</td>
                  <td className="num px-4 py-2 text-right">{formatoNum(f.retirado)}</td>
                  <td className="num px-4 py-2 text-right font-medium">{formatoNum(consumoTeorico(f.esperado, f.retirado))}</td>
                </tr>
              ))}
              {reporte.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    Aparece cuando registres la primera devolución.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
