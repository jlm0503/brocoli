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
  repartirDevolucion,
} from "@/lib/campo/calc";
import { useFase3 } from "@/lib/campo/fase3";
import { puedeCapturar } from "@/lib/campo/roles";
import { useSesion } from "@/lib/campo/sesion";
import { useCampo } from "@/lib/campo/store";
import { useFiltro } from "@/lib/campo/filtro";

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
  const { roles } = useSesion();
  const captura = puedeCapturar(roles, "/devoluciones");
  const { tablas, productos, semanaActual, lotes, recetas, adicionales, recepciones } = useCampo();
  const { ranchos, pasaTabla } = useFiltro();
  const { devoluciones: todasDev, registrarDevolucionSemana, eliminarDevolucion, extraordinarios } = useFase3();
  const [ranchoId, setRanchoId] = useState(ranchos[0]?.id ?? "");
  const [semanaOrigen, setSemanaOrigen] = useState(semanaActual);
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [foto, setFoto] = useState<string | undefined>();
  const [clave, setClave] = useState(0);
  const devoluciones = todasDev.filter((d) => {
    const t = tablas.find((x) => x.id === d.tablaId);
    return !t || pasaTabla(t);
  });

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

  // Lo que se entregó en el rancho la semana elegida: de ahí salen productos y tablas a descontar.
  const lineasOrigen = useMemo(
    () =>
      lineasSemana(lotes.filter((l) => tablas.find((t) => t.id === l.tablaId)?.ranchoId === ranchoId), recetas, adicionales, [semanaOrigen]).filter(
        (l) => estatusLinea(l, recepciones, semanaActual) === "recibido",
      ),
    [lotes, tablas, ranchoId, recetas, adicionales, semanaOrigen, recepciones, semanaActual],
  );
  const productosOrigen = productos.filter((p) => lineasOrigen.some((l) => l.productoId === p.id && l.cantidad > 0));
  const calculo = productoId && Number(cantidad) > 0 ? repartirDevolucion(lineasOrigen, productoId, Number(cantidad)) : null;
  const semanasOpc = Array.from({ length: 12 }, (_, i) => semanaActual - i);

  const guardar = () => {
    if (!productoId) return void toast.error("Elige el producto.");
    if (!calculo) return void toast.error("Indica la cantidad devuelta.");
    if (calculo.error) return void toast.error(calculo.error);
    const e = registrarDevolucionSemana({ semanaOrigen, productoId, reparto: calculo.reparto, foto });
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
      description="Producto, cantidad y foto de lo retirado sin usar. Lo retirado sale del costo del lote."
      filtros
    >
      {captura && <section className="mb-10 rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="mb-4 text-2xl font-semibold">Registrar lo retirado</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Rancho</Label>
            <Select
              value={ranchoId}
              onValueChange={(v) => {
                setRanchoId(v);
                setProductoId("");
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
            <Label>Semana de la que se regresa</Label>
            <Select
              value={String(semanaOrigen)}
              onValueChange={(v) => {
                setSemanaOrigen(Number(v));
                setProductoId("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {semanasOpc.map((w) => (
                  <SelectItem key={w} value={String(w)}>
                    Semana {w}
                    {w === semanaActual ? " (actual)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Producto</Label>
            <Select value={productoId} onValueChange={setProductoId}>
              <SelectTrigger>
                <SelectValue placeholder={productosOrigen.length ? "Elige" : "Nada entregado esa semana"} />
              </SelectTrigger>
              <SelectContent>
                {productosOrigen.map((p) => (
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
        {calculo && (
          <div className="mt-4 rounded-lg border border-border bg-secondary/40 p-3 text-sm">
            {calculo.error ? (
              <p className="text-destructive">{calculo.error}</p>
            ) : (
              <>
                <p className="mb-1 text-muted-foreground">
                  Se descuenta de las tablas que lo recibieron en la semana {semanaOrigen} (entregado: {formatoNum(calculo.entregado)}{" "}
                  {prod(productoId)?.unidad}):
                </p>
                <ul className="space-y-0.5">
                  {calculo.reparto.map((r) => (
                    <li key={r.loteId} className="num">
                      {nombreT(r.tablaId)}: {formatoNum(r.cantidad)} {prod(productoId)?.unidad}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <FotoInput key={clave} foto={foto} setFoto={setFoto} texto="Foto de lo retirado" />
          <Button onClick={guardar}>Guardar devolución</Button>
        </div>
      </section>}

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
                  · {nombreT(d.tablaId)}
                  {d.semanaOrigen != null ? ` · de semana ${d.semanaOrigen}` : ""} · {formatoMXN(d.cantidad * d.precio)} menos al lote
                </span>
                <span className="flex gap-1">
                  <VerEvidencia foto={d.foto} title="Ver foto">
                    <ImageIcon className="size-4" />
                  </VerEvidencia>
                  {captura && <Button size="icon" variant="ghost" aria-label="Eliminar devolución" onClick={() => eliminarDevolucion(d.id)}>
                    <Trash2 />
                  </Button>}
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
