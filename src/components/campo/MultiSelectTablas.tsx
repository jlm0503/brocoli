import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface OpcionTabla {
  id: string;
  etiqueta: string;
}

/** Selector múltiple de tablas: lista vacía = todas. */
export function MultiSelectTablas({ opciones, seleccion, onChange, ariaLabel, placeholder = "Todas las tablas" }: {
  opciones: OpcionTabla[];
  seleccion: string[];
  onChange: (ids: string[]) => void;
  ariaLabel: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const alternar = (id: string) => onChange(seleccion.includes(id) ? seleccion.filter(x => x !== id) : [...seleccion, id]);
  const texto = seleccion.length === 0 ? placeholder : seleccion.length === 1 ? (opciones.find(o => o.id === seleccion[0])?.etiqueta ?? "1 tabla") : `${seleccion.length} tablas`;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" className="w-full justify-between font-normal" aria-label={ariaLabel}>
        <span className="truncate">{texto}</span><ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-72 p-2" align="start">
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {seleccion.length > 0 && <Button type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={() => onChange([])}>Quitar selección (todas)</Button>}
        {opciones.map(o => <div key={o.id} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-secondary">
          <Checkbox id={`ms-${o.id}`} checked={seleccion.includes(o.id)} onCheckedChange={() => alternar(o.id)} />
          <Label htmlFor={`ms-${o.id}`} className="flex-1 cursor-pointer text-sm font-normal">{o.etiqueta}</Label>
        </div>)}
        {!opciones.length && <p className="px-1 py-2 text-xs text-muted-foreground">Sin tablas disponibles.</p>}
      </div>
    </PopoverContent>
  </Popover>;
}
