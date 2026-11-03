import { ChevronDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFase3 } from "@/lib/campo/fase3";
import { useFiltroEstado } from "@/lib/campo/filtro";
import { useCampo } from "@/lib/campo/store";
import type { Cultivo } from "@/lib/campo/types";

function Multi<T extends string>({
  etiqueta,
  todos,
  opciones,
  valor,
  onChange,
}: {
  etiqueta: string;
  todos: string;
  opciones: { id: T; nombre: string }[];
  valor: T[];
  onChange: (v: T[]) => void;
}) {
  const elegidas = opciones.filter((o) => valor.includes(o.id));
  const texto =
    elegidas.length === 0 ? todos : elegidas.length <= 2 ? elegidas.map((o) => o.nombre).join(", ") : `${elegidas.length} elegidos`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="justify-between gap-2" aria-label={`Filtrar por ${etiqueta}`}>
          <span className="text-muted-foreground">{etiqueta}:</span>
          <span className="max-w-40 truncate font-medium">{texto}</span>
          <ChevronDown className="size-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-2">
        <button
          type="button"
          className="mb-1 w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
          onClick={() => onChange([])}
        >
          {todos}
        </button>
        {opciones.map((o) => (
          <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
            <Checkbox
              checked={valor.includes(o.id)}
              onCheckedChange={(c) => onChange(c ? [...valor, o.id] : valor.filter((x) => x !== o.id))}
            />
            {o.nombre}
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** Filtros por rancho y cultivo; aplican a todas las pantallas que los muestran. */
export function FiltroBar() {
  const { ranchos, cultivos } = useCampo();
  const { ranchosVisibles } = useFase3();
  const { ranchoIds, setRanchoIds, cultivos: elegidos, setCultivos } = useFiltroEstado();
  const misRanchos = ranchos.filter((r) => !ranchosVisibles || ranchosVisibles.includes(r.id));
  const activo = ranchoIds.length > 0 || elegidos.length > 0;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {misRanchos.length > 1 && (
        <Multi
          etiqueta="Rancho"
          todos="Todos los ranchos"
          opciones={misRanchos.map((r) => ({ id: r.id, nombre: r.nombre }))}
          valor={ranchoIds.filter((id) => misRanchos.some((r) => r.id === id))}
          onChange={setRanchoIds}
        />
      )}
      <Multi<Cultivo>
        etiqueta="Cultivo"
        todos="Todos los cultivos"
        opciones={cultivos.map((c) => ({ id: c.id, nombre: c.nombre }))}
        valor={elegidos}
        onChange={setCultivos}
      />
      {activo && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setRanchoIds([]);
            setCultivos([]);
          }}
        >
          <X /> Quitar filtros
        </Button>
      )}
    </div>
  );
}
