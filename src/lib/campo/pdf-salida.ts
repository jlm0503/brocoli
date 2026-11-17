import { supabase } from "@/integrations/supabase/client";
import { estimadoViaje, fechaCorta, formatoNum } from "./calc";
import type { Viaje } from "./types";

async function imagenEvidencia(ruta: string): Promise<string> {
  const { data, error } = await supabase.storage.from("evidencias").download(ruta);
  if (error || !data) throw new Error("No se pudo cargar la fotografía. Inténtalo de nuevo.");
  const url = URL.createObjectURL(data);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const escala = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * escala);
    canvas.height = Math.round(img.naturalHeight * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo preparar la fotografía.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.88);
  } finally { URL.revokeObjectURL(url); }
}

export async function pdfSalida(v: Viaje): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }, camion, hoja] = await Promise.all([
    import("jspdf"), import("jspdf-autotable"),
    v.salida?.fotoCamion ? imagenEvidencia(v.salida.fotoCamion) : Promise.resolve(null),
    v.foto ? imagenEvidencia(v.foto) : Promise.resolve(null),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const margen = 16;
  const ancho = doc.internal.pageSize.getWidth() - margen * 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("Ultra Farms de México", margen, 22);
  doc.setFontSize(13);
  doc.text("SALIDA DE COSECHA", margen, 32);
  doc.setFontSize(10);
  const s = v.salida;
  autoTable(doc, {
    startY: 40, margin: margen, theme: "grid",
    body: [
      ["Folio", v.folio], ["Fecha y hora de salida", `${fechaCorta(v.fecha)} ${v.fecha.slice(0, 4)} · ${v.hora}`],
      ["Placas", s?.placas ?? "No registrado"], ["Destino", s?.destino ?? "No registrado"],
      ["Nombre del chofer", s?.choferNombre ?? "No registrado"],
      ["Cumple los requisitos", s ? s.cumpleRequisitos ? "Sí cumple" : "No cumple" : "No registrado"],
      ["Registrado por", v.por], ["Observaciones", s?.observaciones || "Sin observaciones"],
      ...(v.motivoCerrado ? [["Motivo de lote cerrado", v.motivoCerrado]] : []),
    ], styles: { fontSize: 10, cellPadding: 3 }, columnStyles: { 0: { cellWidth: 55, fontStyle: "bold" } },
  });
  const finalY = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 40;
  const est = estimadoViaje(v);
  autoTable(doc, {
    startY: finalY() + 8, margin: margen, theme: "grid",
    head: [["Rancho / tabla / lote", "Ha", ...(v.kgSalida ? [] : ["Bins"]), v.kgSalida ? "Kilos de salida" : "Kilos estimados"]],
    body: v.loteIds.map((id) => {
      const tabla = s?.tablas.find((t) => t.loteId === id);
      return [tabla?.nombre ?? id, tabla ? formatoNum(tabla.ha) : "—", ...(v.kgSalida ? [] : [formatoNum(est.porLote[id]?.bins ?? 0)]), formatoNum(est.porLote[id]?.kg ?? 0)];
    }),
    foot: [["Total", "", ...(v.kgSalida ? [] : [formatoNum(est.bins)]), formatoNum(est.kg)]],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [47, 93, 58] }, footStyles: { fillColor: [47, 93, 58] },
  });
  let y = finalY() + 10;
  for (const [titulo, imagen] of [["Fotografía del camión", camion], ["Hoja de embarque", hoja]] as const) {
    if (!imagen) continue;
    const props = doc.getImageProperties(imagen);
    const alto = Math.min(80, ancho * props.height / props.width);
    const anchoFoto = alto * props.width / props.height;
    if (y + alto + 15 > doc.internal.pageSize.getHeight() - margen) { doc.addPage(); y = 22; }
    doc.setFontSize(11);
    doc.text(titulo, margen, y);
    doc.addImage(imagen, "JPEG", margen + (ancho - anchoFoto) / 2, y + 5, anchoFoto, alto);
    y += alto + 15;
  }
  doc.setProperties({ title: `Salida de cosecha ${v.folio}`, author: "Ultra Farms de México" });
  return doc.output("blob");
}

export async function entregarPdfSalida(blob: Blob, folio: string, compartir = false): Promise<void> {
  const nombre = `Salida-${folio}.pdf`.replace(/[\\/:*?"<>|]/g, "-");
  const file = new File([blob], nombre, { type: "application/pdf" });
  if (compartir && navigator.share && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: `Salida de cosecha ${folio}` }); return; }
    catch (error) { if ((error as DOMException).name === "AbortError") return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}