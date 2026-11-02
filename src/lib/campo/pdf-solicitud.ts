/**
 * PDF de la solicitud de planta. Se arma en el navegador (jsPDF se carga solo al usarse).
 */
import { fechaCorta, folioSolicitud, formatoNum, totalesSolicitud } from "./calc";
import type { SolicitudPlanta } from "./types";

// Colores de marca impresos en el PDF (papel, no pantalla).
const VERDE: [number, number, number] = [47, 93, 58];
const TINTA: [number, number, number] = [33, 37, 30];
const GRIS: [number, number, number] = [110, 112, 104];

function fechaLarga(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  return `${d} de ${meses[m! - 1]} de ${y}`;
}

export async function pdfSolicitud(s: SolicitudPlanta): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const M = 16;

  // Encabezado con marca
  doc.setFillColor(...VERDE);
  doc.roundedRect(M, 14, 16, 16, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("UF", M + 8, 24.2, { align: "center" });
  doc.setTextColor(...TINTA);
  doc.setFontSize(13);
  doc.text("Ultra Farms de México", M + 20, 20.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRIS);
  doc.text("Control de campo", M + 20, 26);

  doc.setTextColor(...TINTA);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("SOLICITUD DE PLANTA", W - M, 20, { align: "right" });
  doc.setFontSize(11);
  doc.setTextColor(...VERDE);
  doc.text(folioSolicitud(s.folio), W - M, 26, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRIS);
  doc.setFontSize(9);
  doc.text(fechaLarga(s.fecha), W - M, 31, { align: "right" });

  doc.setDrawColor(...VERDE);
  doc.setLineWidth(0.6);
  doc.line(M, 36, W - M, 36);

  // Vivero
  let y = 44;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...GRIS);
  doc.text("VIVERO", M, y);
  doc.setTextColor(...TINTA);
  doc.setFontSize(12);
  doc.text(s.vivero.nombre, M, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const contacto = [
    s.vivero.contacto && `Contacto: ${s.vivero.contacto}`,
    s.vivero.telefono && `Tel. ${s.vivero.telefono}`,
    s.vivero.correo,
  ].filter(Boolean) as string[];
  if (contacto.length) doc.text(contacto.join("   ·   "), M, y + 11.5);
  y += 20;

  // Detalle
  const tot = totalesSolicitud(s);
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [
      [
        "Rancho",
        "Tabla",
        "Lote",
        "Variedad",
        "Ha",
        "Plantas",
        "Sem. plantación",
        "Entrega requerida",
      ],
    ],
    body: s.lineas.map((l) => [
      l.rancho,
      l.tabla,
      l.lote,
      l.variedad,
      formatoNum(l.ha),
      formatoNum(l.plantas),
      String(l.semanaPlantacion),
      fechaCorta(l.fechaEntrega),
    ]),
    foot: [["Total", "", "", "", formatoNum(tot.ha), formatoNum(tot.plantas), "", ""]],
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2.2, textColor: TINTA },
    headStyles: { fillColor: VERDE, textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: [236, 233, 222], textColor: TINTA, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 246, 240] },
    columnStyles: { 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "center" } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Observaciones
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...GRIS);
  doc.text("OBSERVACIONES", M, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TINTA);
  doc.setFontSize(9.5);
  const obs = doc.splitTextToSize(s.observaciones || "Sin observaciones.", W - 2 * M) as string[];
  doc.text(obs, M, y + 5.5);
  y += 10 + obs.length * 4.5;

  // Firmas
  y = Math.max(y + 18, 200);
  const col = (W - 2 * M - 20) / 2;
  doc.setDrawColor(...GRIS);
  doc.setLineWidth(0.3);
  doc.line(M, y, M + col, y);
  doc.line(M + col + 20, y, W - M, y);
  doc.setFontSize(9);
  doc.text(s.ingeniero, M + col / 2, y + 5, { align: "center" });
  doc.setTextColor(...GRIS);
  doc.text("Ingeniero solicitante", M + col / 2, y + 9.5, { align: "center" });
  doc.text("Firma de autorización", M + col + 20 + col / 2, y + 5, { align: "center" });

  return doc.output("blob");
}

export const nombreArchivo = (s: SolicitudPlanta) =>
  `${folioSolicitud(s.folio)} ${s.vivero.nombre}.pdf`.replace(/[\\/:*?"<>|]/g, "");

function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Entrega el PDF ya armado. Se llama directo desde el botón (sin esperar nada antes) para que
 * el teléfono no pierda el toque: en celular abre el menú de compartir (Guardar en Archivos,
 * WhatsApp, correo) y la app no se cierra; en computadora lo descarga.
 * Regresa `true` si se compartió.
 */
export async function entregarPdf(
  blob: Blob,
  s: SolicitudPlanta,
  preferirCompartir = false,
): Promise<boolean> {
  const nombre = nombreArchivo(s);
  const file = new File([blob], nombre, { type: "application/pdf" });
  const tactil = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if ((tactil || preferirCompartir) && nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: `Solicitud de planta ${folioSolicitud(s.folio)}` });
      return true;
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return false;
    }
  }
  descargarBlob(blob, nombre);
  return false;
}
