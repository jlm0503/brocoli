import type { Role } from "./types";

export const ROLES: Record<Role, { nombre: string; persona: string; descripcion: string; home: string }> = {
  admin: {
    nombre: "Administrador",
    persona: "Dueño",
    descripcion: "Define la receta maestra y ve la inversión de cada tabla.",
    home: "/ranchos",
  },
  ingeniero: {
    nombre: "Ingeniero de campo",
    persona: "Israel",
    descripcion: "Aparta tablas libres y registra lo plantado cada día.",
    home: "/planeacion",
  },
  compras: {
    nombre: "Compras",
    persona: "Vicky",
    descripcion: "Surte lo calculado para las próximas 2 semanas y registra entradas.",
    home: "/compras",
  },
};

export type NavPath = "/planeacion" | "/compras" | "/paquete" | "/ranchos";

export const NAV: { to: NavPath; label: string; roles: Role[] }[] = [
  { to: "/ranchos", label: "Estatus y costos", roles: ["admin"] },
  { to: "/planeacion", label: "Planeación y avance", roles: ["admin", "ingeniero"] },
  { to: "/compras", label: "Consolidado de compras", roles: ["admin", "compras"] },
  { to: "/paquete", label: "Paquete tecnológico", roles: ["admin"] },
];

export function puedeVer(role: Role | null, path: NavPath): boolean {
  if (!role) return false;
  return NAV.find((n) => n.to === path)?.roles.includes(role) ?? false;
}
