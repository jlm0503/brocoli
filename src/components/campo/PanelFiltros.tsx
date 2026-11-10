import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function PanelMulti({ nombre, opciones, valor, cambiar, buscable = false }: { nombre: string; opciones: { id: string; nombre: string }[]; valor: string[]; cambiar: (ids: string[]) => void; buscable?: boolean }) {
  const [busqueda, setBusqueda] = useState("");
  const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-MX");
  const visibles = opciones.filter((o) => !buscable || normalizar(o.nombre).includes(normalizar(busqueda.trim())));
  return <Popover><PopoverTrigger asChild><Button variant="outline" className="justify-between" aria-label={`Filtrar ${nombre}`}><span>{nombre}: {valor.length ? `${valor.length} seleccionados` : "Todos"}</span><ChevronDown className="size-4" /></Button></PopoverTrigger>
    <PopoverContent align="start" className="w-72 max-w-[calc(100vw-2rem)] p-2">{buscable && <Input type="search" aria-label={`Buscar ${nombre.toLowerCase()}`} placeholder={`Buscar ${nombre.toLowerCase()}…`} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="mb-2" />}<Button variant="ghost" size="sm" onClick={() => { cambiar([]); setBusqueda(""); }}>Todos</Button><div className="max-h-72 overflow-y-auto">{visibles.map((o) => <label key={o.id} className="flex items-start gap-2 rounded-md p-2 text-sm hover:bg-muted"><Checkbox className="mt-0.5" aria-label={o.nombre} checked={valor.includes(o.id)} onCheckedChange={(v) => cambiar(v === true ? [...new Set([...valor, o.id])] : valor.filter((id) => id !== o.id))} /><span className="min-w-0 break-words">{o.nombre}</span></label>)}{!visibles.length && <p className="p-2 text-sm text-muted-foreground">Sin coincidencias.</p>}</div></PopoverContent>
  </Popover>;
}