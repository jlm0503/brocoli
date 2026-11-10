import { type Context, createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { useFase3 } from "@/lib/campo/fase3";
import { useCampo } from "@/lib/campo/store";
import { tablaDisponible } from "@/lib/campo/calc";
import type { Cultivo, Lote } from "@/lib/campo/types";

/**
 * Filtro de pantallas por rancho y cultivo. Es solo de vista (de este dispositivo):
 * nunca cambia datos. Vacío = todos.
 */
interface FiltroValue {
  ranchoIds: string[];
  cultivos: Cultivo[];
  setRanchoIds: (ids: string[]) => void;
  setCultivos: (cs: Cultivo[]) => void;
}

// Misma instancia entre recargas en caliente para no dejar pantallas con un contexto viejo.
const gFiltro = globalThis as unknown as Record<string, Context<FiltroValue | null>>;
const Ctx: Context<FiltroValue | null> = gFiltro["__campoFiltro__"] ?? (gFiltro["__campoFiltro__"] = createContext<FiltroValue | null>(null));
const CLAVE = "campo-filtro";

export function FiltroProvider({ children }: { children: ReactNode }) {
  const [ranchoIds, setRanchoIds] = useState<string[]>([]);
  const [cultivos, setCultivos] = useState<Cultivo[]>([]);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    try {
      const g = JSON.parse(localStorage.getItem(CLAVE) ?? "{}") as { r?: string[]; c?: Cultivo[] };
      if (Array.isArray(g.r)) setRanchoIds(g.r);
      if (Array.isArray(g.c)) setCultivos(g.c);
    } catch {
      /* filtro dañado: se ignora */
    }
    setListo(true);
  }, []);
  useEffect(() => {
    if (listo) localStorage.setItem(CLAVE, JSON.stringify({ r: ranchoIds, c: cultivos }));
  }, [listo, ranchoIds, cultivos]);

  const value = useMemo(() => ({ ranchoIds, cultivos, setRanchoIds, setCultivos }), [ranchoIds, cultivos]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFiltroEstado(): FiltroValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFiltroEstado debe usarse dentro de FiltroProvider");
  return v;
}

/** Ranchos y lotes que pasan el filtro (y, para ingenieros, solo sus ranchos asignados). */
export function useFiltro() {
  const { ranchoIds, cultivos } = useFiltroEstado();
  const { ranchos, lotes } = useCampo();
  const { ranchosVisibles } = useFase3();

  const pasaRancho = useCallback(
    (id: string) =>
      (!ranchosVisibles || ranchosVisibles.includes(id)) && (ranchoIds.length === 0 || ranchoIds.includes(id)),
    [ranchosVisibles, ranchoIds],
  );
  const pasaCultivo = useCallback(
    (c: Cultivo | undefined) => cultivos.length === 0 || (c !== undefined && cultivos.includes(c)),
    [cultivos],
  );
  const pasaLote = useCallback(
    (l: Pick<Lote, "ranchoId" | "cultivo"> | undefined) => !!l && pasaRancho(l.ranchoId) && pasaCultivo(l.cultivo),
    [pasaRancho, pasaCultivo],
  );
  const pasaLoteId = useCallback(
    (loteId: string) => pasaLote(lotes.find((l) => l.id === loteId)),
    [lotes, pasaLote],
  );
  /**
   * Tabla con filtro de cultivo: pasa si tiene un lote vigente de ese cultivo.
   * Con `libres`, también pasan las tablas sin lotes vigentes (para poder planearlas).
   */
  const pasaTabla = useCallback(
    (t: { id: string; ranchoId: string; archivada?: boolean | undefined }, opciones?: { libres?: boolean }) => {
      if (!tablaDisponible(t)) return false;
      if (!pasaRancho(t.ranchoId)) return false;
      if (cultivos.length === 0) return true;
      const vigentes = lotes.filter((l) => l.tablaId === t.id && !l.cancelado && !l.cerrado);
      if (vigentes.length === 0) return !!opciones?.libres;
      return vigentes.some((l) => cultivos.includes(l.cultivo));
    },
    [pasaRancho, cultivos, lotes],
  );

  const ranchosFiltrados = useMemo(() => ranchos.filter((r) => pasaRancho(r.id)), [ranchos, pasaRancho]);
  const activo = ranchoIds.length > 0 || cultivos.length > 0;

  return { ranchos: ranchosFiltrados, pasaRancho, pasaCultivo, pasaLote, pasaLoteId, pasaTabla, activo };
}
