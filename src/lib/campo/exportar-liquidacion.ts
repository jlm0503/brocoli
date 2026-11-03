import { fechaCorta, formatoMXN, formatoNum, porTablaViajes, type ResumenPago } from "./calc";
import type { Chofer, Lote, Tabla } from "./types";

interface Nombres {
  tablas: Tabla[];
  lotes: Lote[];
  choferes: Chofer[];
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

const tablasViaje = (loteIds: string[], n: Nombres) =>
  loteIds
    .map((id) => {
      const l = n.lotes.find((x) => x.id === id);
      const t = n.tablas.find((x) => x.id === l?.tablaId);
      return `${t?.nombre ?? "?"} ${l?.codigo ?? ""}`.trim();
    })
    .join(", ");

function filasViajes(r: ResumenPago, n: Nombres): string[][] {
  return r.viajes.map((v) => [
    v.folio,
    v.fecha,
    n.choferes.find((c) => c.id === v.choferId)?.nombre ?? "",
    tablasViaje(v.loteIds, n),
    v.evaluacion ? String(v.evaluacion.kgBrutos) : "",
    v.evaluacion ? String(v.evaluacion.kgPagables) : "",
    v.evaluacion ? String(v.evaluacion.importeBruto) : "",
    v.evaluacion ? String(v.evaluacion.descuento) : "",
    v.evaluacion ? String(v.evaluacion.importeNeto) : "Sin evaluar",
  ]);
}

const ENCABEZADO = ["Folio", "Fecha", "Chofer", "Tablas", "Kg brutos", "Kg pagables", "Importe bruto", "Descuento planta", "Importe neto"];
const nombreArchivo = (r: ResumenPago, ext: string) => `liquidacion-${r.jueves}-al-${r.fin}.${ext}`;

/** Excel: archivo CSV (se abre directo en Excel) con el desglose por viaje y por tabla. */
export function exportarExcel(r: ResumenPago, n: Nombres, pagado?: number) {
  const esc = (x: string) => (/[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x);
  const lineas = [
    [`Liquidación semanal ${r.jueves} al ${r.fin}`],
    [],
    ENCABEZADO,
    ...filasViajes(r, n),
    [],
    ["Totales", "", "", "", String(r.kgBrutos), String(r.kgPagables), String(r.importeBruto), String(r.descuentos), String(r.importeNeto)],
    ["Pagado", "", "", "", "", "", "", "", pagado === undefined ? "" : String(pagado)],
    [],
    ["Tabla", "Kg brutos", "Kg pagables", "Importe bruto"],
    ...porTablaViajes(r.viajes).map((f) => [
      n.tablas.find((t) => t.id === f.tablaId)?.nombre ?? f.tablaId,
      String(f.kgBrutos),
      String(f.kgPagables),
      String(f.importe),
    ]),
  ];
  const csv = "\uFEFF" + lineas.map((l) => l.map(esc).join(",")).join("\r\n");
  descargar(new Blob([csv], { type: "text/csv;charset=utf-8" }), nombreArchivo(r, "csv"));
}

export async function exportarPdf(r: ResumenPago, n: Nombres, pagado?: number) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text("Ultra Farms de México · Liquidación semanal", 14, 16);
  doc.setFontSize(10);
  doc.text(`Semana de pago: jueves ${fechaCorta(r.jueves)} a miércoles ${fechaCorta(r.fin)}`, 14, 23);
  autoTable(doc, {
    startY: 28,
    head: [ENCABEZADO],
    body: filasViajes(r, n).map((f) => f.map((x, i) => (i >= 4 && i <= 5 && x ? formatoNum(Number(x)) : i >= 6 && x && x !== "Sin evaluar" ? formatoMXN(Number(x)) : x))),
    foot: [["Totales", "", "", "", formatoNum(r.kgBrutos), formatoNum(r.kgPagables), formatoMXN(r.importeBruto), formatoMXN(r.descuentos), formatoMXN(r.importeNeto)]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [46, 94, 52] },
    footStyles: { fillColor: [235, 230, 218], textColor: 20 },
  });
  const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  autoTable(doc, {
    startY: y,
    head: [["Tabla", "Kg brutos", "Kg pagables", "Importe bruto"]],
    body: porTablaViajes(r.viajes).map((f) => [
      n.tablas.find((t) => t.id === f.tablaId)?.nombre ?? f.tablaId,
      formatoNum(f.kgBrutos),
      formatoNum(f.kgPagables),
      formatoMXN(f.importe),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [46, 94, 52] },
  });
  if (pagado !== undefined) {
    const y2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.text(`Pagado: ${formatoMXN(pagado)} · Diferencia: ${formatoMXN(pagado - r.importeNeto)}`, 14, y2);
  }
  descargar(doc.output("blob"), nombreArchivo(r, "pdf"));
}
