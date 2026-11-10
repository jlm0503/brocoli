import { LayoutGrid, List, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PanelMulti } from "@/components/campo/PanelFiltros";
import { ESTATUS_TABLA_LABEL, filasSuperficieTablas, totalesSuperficieTablas, fechaCorta, fechaPlantacionLote, fechaCosechaLote, formatoNum, formatoMXN, nombreCultivo, type FilaSuperficieTabla } from "@/lib/campo/calc";
import { Stat } from "@/components/campo/AppShell";
import { useCampo } from "@/lib/campo/store";
import { useFiltro } from "@/lib/campo/filtro";
import type { Tabla } from "@/lib/campo/types";

export type FilaTabla = FilaSuperficieTabla;

export function useFilasTablas(tablas: Tabla[], estados: string[]) {
  const { lotes, semanaActual } = useCampo();
  const { pasaCultivo } = useFiltro();
  return filasSuperficieTablas(tablas, lotes, semanaActual, pasaCultivo).filter((f) => !estados.length || estados.includes(f.estatus));
}

export function TotalesTablas({ tablas, filas, estados }: { tablas: Tabla[]; filas: FilaTabla[]; estados: string[] }) {
  const t = totalesSuperficieTablas(tablas, filas, estados);
  return <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6" aria-label="Totales de hectáreas">
    <Stat compact label="Total de hectáreas del rancho" value={`${formatoNum(t.total)} ha`} />
    <Stat compact label="Total planeadas" value={`${formatoNum(t.planeadas)} ha`} tone="soil" />
    <Stat compact label="Total plantadas" value={`${formatoNum(t.plantadas)} ha`} />
    <Stat compact label="Total en cosecha" value={`${formatoNum(t.cosecha)} ha`} tone="soil" />
    <Stat compact label="Total disponible" value={`${formatoNum(t.disponibles)} ha`} />
    <Stat compact label="Total de la selección" value={`${formatoNum(t.seleccion)} ha`} tone="primary" />
  </div>;
}

export function ControlesListado({ vista, cambiarVista, estados, cambiarEstados }: { vista: string; cambiarVista: (v: string) => void; estados: string[]; cambiarEstados: (v: string[]) => void }) {
  return <div className="flex flex-wrap items-center gap-3">
    <ToggleGroup type="single" value={vista} onValueChange={(v) => { if (v) cambiarVista(v); }} variant="outline" aria-label="Vista de tablas">
      <ToggleGroupItem value="cuadros" aria-label="Ver cuadros" className="gap-2"><LayoutGrid className="size-4" />Cuadros</ToggleGroupItem>
      <ToggleGroupItem value="lista" aria-label="Ver listado" className="gap-2"><List className="size-4" />Listado</ToggleGroupItem>
    </ToggleGroup>
    <PanelMulti nombre="Estatus" opciones={Object.entries(ESTATUS_TABLA_LABEL).map(([id, nombre]) => ({ id, nombre }))} valor={estados} cambiar={cambiarEstados} />
  </div>;
}

export function ListadoTablas({ filas, abrir, costo }: { filas: FilaTabla[]; abrir: (t: Tabla) => void; costo?: (f: FilaTabla) => number }) {
  const { ranchos, cultivos } = useCampo();
  return <div className="overflow-x-auto" aria-label="Listado de tablas"><table className="w-full text-sm">
    <thead className="bg-muted text-left"><tr>{["Rancho", "Tabla · lote", "Cultivo", "Fecha de plantación", "Fecha de cosecha", "Estatus", "Ha", ...(costo ? ["Costo acumulado"] : []), ""].map((h, i) => <th key={i} className="whitespace-nowrap p-3">{h}</th>)}</tr></thead>
    <tbody>{filas.map((f) => <tr key={`${f.tabla.id}-${f.lote?.id ?? "libre"}`} className="border-b border-border">
      <td className="whitespace-nowrap p-3">{ranchos.find((r) => r.id === f.tabla.ranchoId)?.nombre ?? "—"}</td>
      <td className="p-3"><strong>{f.tabla.nombre}</strong>{f.lote && <span className="block text-xs text-muted-foreground">{f.lote.folioProgramacion || f.lote.codigo}</span>}</td>
      <td className="p-3">{f.lote ? nombreCultivo(cultivos, f.lote.cultivo) : "—"}</td>
      <td className="whitespace-nowrap p-3">{f.lote ? <>{fechaCorta(fechaPlantacionLote(f.lote))}{!f.lote.avances.length && <span className="block text-xs text-muted-foreground">Planeada</span>}</> : "—"}</td>
      <td className="whitespace-nowrap p-3">{f.lote ? <>{fechaCorta(fechaCosechaLote(f.lote))}{!f.lote.fechaCosecha && <span className="block text-xs text-muted-foreground">Estimada</span>}</> : "—"}</td>
      <td className="p-3"><Badge variant={f.estatus}>{ESTATUS_TABLA_LABEL[f.estatus]}</Badge></td>
      <td className="whitespace-nowrap p-3 text-right font-mono">{formatoNum(f.ha)}</td>
      {costo && <td className="whitespace-nowrap p-3 text-right font-mono">{formatoMXN(costo(f))}</td>}
      <td className="p-3"><Button variant="ghost" size="icon" title={`Ver detalle de ${f.tabla.nombre}`} aria-label={`Ver detalle de ${f.tabla.nombre}`} onClick={() => abrir(f.tabla)}><Eye className="size-4" /></Button></td>
    </tr>)}{!filas.length && <tr><td colSpan={costo ? 9 : 8} className="p-4 text-muted-foreground">No hay tablas con los filtros seleccionados.</td></tr>}</tbody>
    <tfoot><tr className="border-t border-border bg-muted font-semibold"><td colSpan={6} className="p-3">Total de la selección</td><td className="whitespace-nowrap p-3 text-right font-mono">{formatoNum(totalesSuperficieTablas([], filas, []).seleccion)} ha</td><td colSpan={costo ? 2 : 1} /></tr></tfoot>
  </table></div>;
}