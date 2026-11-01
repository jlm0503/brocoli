/**
 * Guardado de los datos de la app: cada lista se guarda como filas (colección, id, datos).
 * Se comparan por referencia contra lo último guardado, así solo viajan los elementos que cambiaron.
 */

export const COLECCIONES = [
  "productos",
  "recetas",
  "adicionales",
  "ranchos",
  "tablas",
  "lotes",
  "pedidos",
  "tardias",
  "alertas",
  "recepciones",
  "inventario",
  "cultivos",
  "variedades",
  "viveros",
  "choferes",
  "congeladoras",
  "problemas",
  "parametros",
  "solicitudes",
] as const;
export type Coleccion = (typeof COLECCIONES)[number];

export type Mapa = Record<string, unknown>;

export function porId<T extends { id: string }>(xs: T[]): Record<string, T> {
  return Object.fromEntries(xs.map((x) => [x.id, x]));
}

/** Qué hay que guardar y qué borrar para pasar de `antes` a `ahora`. */
export function diferencias(antes: Mapa, ahora: Mapa): { guardar: [string, unknown][]; borrar: string[] } {
  const guardar: [string, unknown][] = [];
  for (const [id, v] of Object.entries(ahora)) if (!(id in antes) || antes[id] !== v) guardar.push([id, v]);
  const borrar = Object.keys(antes).filter((id) => !(id in ahora));
  return { guardar, borrar };
}

/** Cambio que llegó de otra persona y que la pantalla quizá aún no refleja. */
export interface CambioRemoto {
  /** `undefined` = se borró. */
  data: unknown;
  llegada: number;
}

/** Tiempo máximo que se espera a que la pantalla refleje un cambio remoto. */
export const ESPERA_REMOTO_MS = 5000;

/**
 * Lo guardado (`antes`) ajustado con los cambios remotos pendientes: mientras la pantalla no refleje
 * un cambio que llegó de otra persona, ese registro no se guarda ni se borra. Así un cambio remoto que
 * llega entre dos pintadas nunca se toma como "borrado aquí". Quita de `pendientes` los ya reflejados.
 */
export function conciliarRemotos(
  antes: Mapa,
  ahora: Mapa,
  pendientes: Map<string, CambioRemoto>,
  ahoraMs: number,
): Mapa {
  if (pendientes.size === 0) return antes;
  const base = { ...antes };
  for (const [id, cambio] of [...pendientes]) {
    const reflejado = cambio.data === undefined ? !(id in ahora) : ahora[id] === cambio.data;
    if (reflejado || ahoraMs - cambio.llegada > ESPERA_REMOTO_MS) {
      pendientes.delete(id);
      if (!reflejado) continue;
    }
    if (id in ahora) base[id] = ahora[id];
    else delete base[id];
  }
  return base;
}
