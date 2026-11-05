import { CONCEPTOS_GASTO, formatoMXN, formatoNum, nombreConceptoGasto, type EstadoResultados, type FilaResultados } from "./calc";
import type { CultivoCat, Rancho } from "./types";

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

const nombre = (id: string, lista: { id: string; nombre: string }[]) => lista.find((x) => x.id === id)?.nombre ?? id;

/** Columnas del estado de resultados: concepto → etiqueta. */
const COLUMNAS = ["Ingreso", "Insumos", "Planta", ...CONCEPTOS_GASTO.map((c) => c.nombre), "No asignado", "Utilidad directa", "Utilidad real", "Utilidad real / ha", "Retorno"];

function celdas(f: Pick<FilaResultados, "ingreso" | "insumos" | "planta" | "porConcepto" | "noAsignado" | "utilidadDirecta" | "utilidadReal" | "utilidadRealHa" | "retornoReal">): string[] {
  return [
    String(f.ingreso),
    String(f.insumos),
    String(f.planta),
    ...CONCEPTOS_GASTO.map((c) => String(f.porConcepto[c.id] ?? 0)),
    String(f.noAsignado),
    String(f.utilidadDirecta),
    String(f.utilidadReal),
    String(f.utilidadRealHa),
    f.retornoReal === null ? "" : String(f.retornoReal),
  ];
}

const archivo = (desde: number, hasta: number, ext: string) => `resultados-semana-${desde}-a-${hasta}.${ext}`;

/** Excel: CSV con el estado de resultados por rancho y cultivo. */
export function exportarResultadosExcel(t: EstadoResultados, n: { ranchos: Rancho[]; cultivos: CultivoCat[] }) {
  const esc = (x: string) => (/[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x);
  const lineas = [
    [`Estado de resultados · semanas ${t.desde} a ${t.hasta}`],
    [],
    ["Rancho", "Cultivo", "ha", ...COLUMNAS],
    ...t.filas.map((f) => [nombre(f.ranchoId, n.ranchos), nombre(f.cultivo, n.cultivos), String(f.ha), ...celdas(f)]),
    [],
    ["Totales", "", String(t.totales.ha), ...celdas(t.totales)],
  ];
  const csv = "\uFEFF" + lineas.map((l) => l.map(esc).join(",")).join("\r\n");
  descargar(new Blob([csv], { type: "text/csv;charset=utf-8" }), archivo(t.desde, t.hasta, "csv"));
}

/** PDF con el estado de resultados por rancho y cultivo. */
export async function exportarResultadosPdf(t: EstadoResultados, n: { ranchos: Rancho[]; cultivos: CultivoCat[] }) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text("Ultra Farms de México · Estado de resultados", 14, 16);
  doc.setFontSize(10);
  doc.text(`Semanas ${t.desde} a ${t.hasta}`, 14, 23);
  autoTable(doc, {
    startY: 28,
    head: [["Rancho", "Cultivo", "ha", ...COLUMNAS]],
    body: t.filas.map((f) => [nombre(f.ranchoId, n.ranchos), nombre(f.cultivo, n.cultivos), formatoNum(f.ha), ...celdas(f).map((x) => (x && x !== "" && Number.isFinite(Number(x)) ? formatoMXN(Number(x)) : x))]),
    foot: [["Totales", "", formatoNum(t.totales.ha), ...celdas(t.totales).map((x) => (x && x !== "" && Number.isFinite(Number(x)) ? formatoMXN(Number(x)) : x))]],
    styles: { fontSize: 6 },
    headStyles: { fillColor: [46, 94, 52] },
    footStyles: { fillColor: [235, 230, 218], textColor: 20 },
  });
  const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  const usos = CONCEPTOS_GASTO.filter((c) => (t.totales.porConcepto[c.id] ?? 0) > 0);
  if (usos.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Concepto", "Monto"]],
      body: usos.map((c) => [c.nombre, formatoMXN(t.totales.porConcepto[c.id] ?? 0)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [46, 94, 52] },
    });
  }
  const y2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.text(
    `Utilidad directa ${formatoMXN(t.totales.utilidadDirecta)} · Gastos comunes ${formatoMXN(t.totales.gastosComunes)} · No asignado ${formatoMXN(
      t.totales.noAsignado,
    )} · Utilidad real ${formatoMXN(t.totales.utilidadReal)} (${formatoMXN(t.totales.utilidadRealHa)} por ha)`,
    14,
    y2,
  );
  doc.text(`Conceptos: ${CONCEPTOS_GASTO.map((c) => nombreConceptoGasto(c.id)).join(", ")}`, 14, y2 + 6);
  descargar(doc.output("blob"), archivo(t.desde, t.hasta, "pdf"));
}
