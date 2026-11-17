/** PDF de la lista de aplicaciones por tabla (jsPDF se carga solo al usarse). */
export interface GrupoPdf { titulo: string; filas: { producto: string; tipo: string; dosis: string; ha: string; programado: string; recibido: string; devuelto: string; consumido: string }[] }

export async function pdfAplicaciones(titulo: string, subtitulo: string, grupos: GrupoPdf[]): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  doc.setFontSize(14); doc.setTextColor(47, 93, 58); doc.text(titulo, 14, 16);
  doc.setFontSize(9); doc.setTextColor(110, 112, 104); doc.text(subtitulo, 14, 22);
  let y = 28;
  for (const g of grupos) {
    autoTable(doc, {
      startY: y,
      head: [[{ content: g.titulo, colSpan: 8, styles: { fillColor: [47, 93, 58], textColor: 255 } }], ["Producto", "Tipo", "Dosis/ha", "Ha", "Programado", "Recibido", "Devuelto", "Consumido"]],
      body: g.filas.map(f => [f.producto, f.tipo, f.dosis, f.ha, f.programado, f.recibido, f.devuelto, f.consumido]),
      styles: { fontSize: 8, cellPadding: 1.2 },
      headStyles: { fillColor: [230, 226, 214], textColor: [33, 37, 30] },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right", fontStyle: "bold" } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  }
  return doc.output("blob");
}

export async function entregarPdfAplicaciones(blob: Blob, nombre: string) {
  const file = new File([blob], nombre, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (matchMedia("(pointer: coarse)").matches && nav.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: nombre }); return; } catch (e) { if ((e as DOMException).name === "AbortError") return; }
  }
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = nombre; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
