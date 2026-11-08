import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function PanelMulti({ nombre, opciones, valor, cambiar }: { nombre: string; opciones: { id: string; nombre: string }[]; valor: string[]; cambiar: (ids: string[]) => void }) {
  return <Popover><PopoverTrigger asChild><Button variant="outline" className="justify-between" aria-label={`Filtrar ${nombre}`}><span>{nombre}: {valor.length ? `${valor.length} seleccionados` : "Todos"}</span><ChevronDown className="size-4" /></Button></PopoverTrigger>
    <PopoverContent align="start" className="w-72 p-2"><Button variant="ghost" size="sm" onClick={() => cambiar([])}>Todos</Button><div className="max-h-72 overflow-y-auto">{opciones.map((o) => <label key={o.id} className="flex items-start gap-2 rounded-md p-2 text-sm hover:bg-muted"><Checkbox className="mt-0.5" aria-label={o.nombre} checked={valor.includes(o.id)} onCheckedChange={(v) => cambiar(v === true ? [...valor, o.id] : valor.filter((id) => id !== o.id))} /><span className="min-w-0 break-words">{o.nombre}</span></label>)}</div></PopoverContent>
  </Popover>;
}