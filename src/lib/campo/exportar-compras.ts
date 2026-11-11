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

const num = (n: number) => Math.round(n * 100) / 100;

/**
 * Excel real (.xlsx) de compras:
 * hoja 1 "Totales por rancho": productos en filas, ranchos en columnas, total general;
 * hoja 2 "Detalle por rancho": cada producto con cantidad, unidad y estatus.
 */
export async function exportarCompras(
  titulo: string,
  filas: FilaCompraExport[],
  productos: Producto[],
  ranchos: Rancho[],
) {
  const XLSX = await import("xlsx");

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

  type Celda = string | number;
  const totales: Celda[][] = [
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
  ];

  const detalle: Celda[][] = [
    [titulo],
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

  const wb = XLSX.utils.book_new();
  const wsTotales = XLSX.utils.aoa_to_sheet(totales);
  wsTotales["!cols"] = [
    { wch: 22 },
    { wch: 34 },
    { wch: 10 },
    ...ranchoIds.map(() => ({ wch: 12 })),
    { wch: 12 },
  ];
  const wsDetalle = XLSX.utils.aoa_to_sheet(detalle);
  wsDetalle["!cols"] = [{ wch: 22 }, { wch: 22 }, { wch: 34 }, { wch: 12 }, { wch: 10 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsTotales, "Totales por rancho");
  XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle por rancho");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const slug = titulo.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  descargar(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `compras-${slug}.xlsx`,
  );
}
