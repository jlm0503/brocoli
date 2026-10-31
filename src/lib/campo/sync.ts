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
