import type { Role } from "./types";

export const ROLES: Record<
  Role,
  { nombre: string; persona: string; descripcion: string; home: string }
> = {
  admin: {
    nombre: "Administrador",
    persona: "Dueño",
    descripcion: "Define la receta, los adicionales por tabla y ve la inversión de cada lote.",
    home: "/ranchos",
  },
  ingeniero: {
    nombre: "Ingeniero de campo",
    persona: "Israel",
    descripcion: "Planea lotes, registra lo plantado cada día y ve sus pendientes.",
    home: "/planeacion",
  },
  compras: {
    nombre: "Compras",
    persona: "Vicky",
    descripcion:
      "Surte pedidos de planeación, lo de esta semana y compra para dentro de 2 semanas.",
    home: "/compras",
  },
};

export type NavPath =
  | "/planeacion"
  | "/compras"
  | "/paquete"
  | "/ranchos"
  | "/catalogos"
  | "/alertas"
  | "/usuarios"
  | "/parametros"
  | "/solicitudes"
  | "/cuenta-planta"
  | "/llegadas";

export const NAV: { to: NavPath; label: string; roles: Role[] }[] = [
  { to: "/ranchos", label: "Estatus y costos", roles: ["admin"] },
  { to: "/planeacion", label: "Planeación y avance", roles: ["admin", "ingeniero"] },
  { to: "/solicitudes", label: "Solicitudes de planta", roles: ["admin", "ingeniero"] },
  { to: "/llegadas", label: "Lo que llega al rancho", roles: ["admin", "ingeniero"] },
  { to: "/compras", label: "Compras y entregas", roles: ["admin", "compras"] },
  { to: "/cuenta-planta", label: "Cuenta de planta", roles: ["admin"] },
  { to: "/alertas", label: "Alertas y reportes", roles: ["admin"] },
  { to: "/paquete", label: "Paquete tecnológico", roles: ["admin"] },
  { to: "/catalogos", label: "Catálogos", roles: ["admin"] },
  { to: "/parametros", label: "Parámetros", roles: ["admin"] },
  { to: "/usuarios", label: "Usuarios y puestos", roles: ["admin"] },
];

export function puedeVer(role: Role | null, path: NavPath): boolean {
  if (!role) return false;
  return NAV.find((n) => n.to === path)?.roles.includes(role) ?? false;
}

/** Solo el administrador corrige fechas de plantación y cosecha ya registradas. */
export function puedeCorregirFechas(role: Role | null): boolean {
  return role === "admin";
}

/** Si alguien tiene varios puestos, entra con el de más alcance. Sin puesto = espera aprobación. */
export function puestoPrincipal(roles: Role[]): Role | null {
  for (const r of ["admin", "ingeniero", "compras"] as const) if (roles.includes(r)) return r;
  return null;
}
