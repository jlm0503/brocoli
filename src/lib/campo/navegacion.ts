import { NAV, type NavPath } from "./roles";

const DIRECCION: readonly NavPath[] = [
  "/panel",
  "/ranchos",
  "/liquidacion",
  "/historicos",
  "/rendimiento",
];

/** Organización visual compartida; conserva el acceso independiente de cada pantalla. */
export function agruparPantallas(items: typeof NAV) {
  const direccion = DIRECCION.flatMap((path) => items.filter((item) => item.to === path));
  const otras = items.filter((item) => !DIRECCION.includes(item.to));
  return [
    { id: "direccion", label: "Dirección", items: direccion },
    { id: "otras", label: "Otras pantallas", items: otras },
  ].filter((grupo) => grupo.items.length > 0);
}