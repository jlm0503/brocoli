import { formatoNum } from "./calc";
import type { Producto, Rancho } from "./types";

export interface FilaCompraExport {
  productoId: string;
  ranchoId: string;
  cantidad: number;
  unidad?: string;
  estatus?: string;
}

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const esc = (x: string) => (/[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x);
const num = (n: number) => String(Math.round(n * 100) / 100);

/**
 * Excel (CSV que abre directo en Excel) de compras:
 * matriz de productos en filas y ranchos en columnas con total general,
 * más el detalle por rancho.
 */
export function exportarCompras(
  titulo: string,
  filas: FilaCompraExport[],
  productos: Producto[],
  ranchos: Rancho[],
) {
  const productoById = new Map(productos.map((p) => [p.id, p]));
  const ranchoById = new Map(ranchos.map((r) => [r.id, r]));
  const ranchoIds = [...new Set(filas.map((f) => f.ranchoId))].sort((a, b) =>
    (ranchoById.get(a)?.nombre ?? a).localeCompare(ranchoById.get(b)?.nombre ?? b),
  );
  const productoIds = [...new Set(filas.map((f) => f.productoId))].sort((a, b) => {
    const pa = productoById.get(a);
    const pb = productoById.get(b);
    return (pa?.familia ?? "").localeCompare(pb?.familia ?? "") || (pa?.nombre ?? a).localeCompare(pb?.nombre ?? b);
  });

  const celda = new Map<string, number>();
  for (const f of filas) {
    const k = `${f.productoId}|${f.ranchoId}`;
    celda.set(k, (celda.get(k) ?? 0) + f.cantidad);
  }

  const lineas: string[][] = [
    [titulo],
    [],
    ["Totales por producto y rancho"],
    ["Familia", "Producto", "Unidad", ...ranchoIds.map((id) => ranchoById.get(id)?.nombre ?? id), "Total"],
    ...productoIds.map((pid) => {
      const p = productoById.get(pid);
      const porRancho = ranchoIds.map((rid) => {
        const v = celda.get(`${pid}|${rid}`);
        return v ? num(v) : "";
      });
      const total = filas.filter((f) => f.productoId === pid).reduce((s, f) => s + f.cantidad, 0);
      return [p?.familia ?? "", p?.nombre ?? pid, p?.unidad ?? "", ...porRancho, num(total)];
    }),
    [
      "",
      "Total general",
      "",
      ...ranchoIds.map((rid) => num(filas.filter((f) => f.ranchoId === rid).reduce((s, f) => s + f.cantidad, 0))),
      num(filas.reduce((s, f) => s + f.cantidad, 0)),
    ],
    [],
    ["Detalle por rancho"],
    ["Rancho", "Familia", "Producto", "Cantidad", "Unidad", "Estatus"],
    ...[...filas]
      .sort((a, b) => {
        const ra = ranchoById.get(a.ranchoId)?.nombre ?? a.ranchoId;
        const rb = ranchoById.get(b.ranchoId)?.nombre ?? b.ranchoId;
        const pa = productoById.get(a.productoId)?.nombre ?? a.productoId;
        const pb = productoById.get(b.productoId)?.nombre ?? b.productoId;
        return ra.localeCompare(rb) || pa.localeCompare(pb);
      })
      .map((f) => {
        const p = productoById.get(f.productoId);
        return [
          ranchoById.get(f.ranchoId)?.nombre ?? f.ranchoId,
          p?.familia ?? "",
          p?.nombre ?? f.productoId,
          num(f.cantidad),
          f.unidad ?? p?.unidad ?? "",
          f.estatus ?? "",
        ];
      }),
  ];

  const csv = "\uFEFF" + lineas.map((l) => l.map(esc).join(",")).join("\r\n");
  const slug = titulo.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  descargar(new Blob([csv], { type: "text/csv;charset=utf-8" }), `compras-${slug}.csv`);
}

/** Etiqueta legible de cantidades para vistas previas. */
export const cantidadLegible = formatoNum;
