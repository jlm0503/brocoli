import type { NavPath } from "./roles";

/** Orden y grupos del menú y de la tabla de permisos. Pantallas fuera de esta lista no se muestran. */
export const GRUPOS: { id: string; label: string; paths: NavPath[] }[] = [
  { id: "planeacion", label: "Planeación", paths: ["/planeacion", "/solicitudes"] },
  { id: "operacion", label: "Operación Campo", paths: ["/aplicaciones", "/paquete", "/cosecha", "/gastos"] },
  { id: "insumos", label: "Insumos", paths: ["/llegadas", "/extraordinarios", "/compras", "/devoluciones"] },
  { id: "administrativo", label: "Administrativo", paths: ["/cuenta-planta", "/consumo", "/rendimiento"] },
  { id: "directivo", label: "Directivo", paths: ["/liquidacion", "/resultados", "/historicos"] },
  { id: "configuracion", label: "Configuración", paths: ["/parametros", "/catalogos", "/usuarios"] },
];

export function agruparPantallas<T extends { to: NavPath }>(items: T[]) {
  return GRUPOS.map((g) => ({
    id: g.id,
    label: g.label,
    items: g.paths.flatMap((p) => items.filter((i) => i.to === p)),
  })).filter((g) => g.items.length > 0);
}
