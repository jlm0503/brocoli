import type { Role } from "./types";

/** Orden de alcance: con varios puestos, la pantalla de inicio es la del primero. */
export const ORDEN_PUESTOS: Role[] = [
  "admin",
  "administrador",
  "autorizador",
  "direccion",
  "ingeniero",
  "compras",
  "almacen",
];

export const ROLES: Record<
  Role,
  { nombre: string; persona: string; descripcion: string; home: string }
> = {
  admin: {
    nombre: "Super Admin",
    persona: "Jimena",
    descripcion: "Todo: parámetros, usuarios, corregir fechas, costos y utilidades.",
    home: "/ranchos",
  },
  administrador: {
    nombre: "Administrador",
    persona: "",
    descripcion: "Catálogos, receta, adicionales, ubicación de tablas y reportes.",
    home: "/catalogos",
  },
  autorizador: {
    nombre: "Autorizador",
    persona: "Jimena",
    descripcion: "Autoriza, cambia o rechaza las solicitudes extraordinarias.",
    home: "/extraordinarios",
  },
  ingeniero: {
    nombre: "Ingeniero de campo",
    persona: "Israel",
    descripcion: "Planea lotes, registra lo plantado, pide extraordinarios y reporta mejoras.",
    home: "/planeacion",
  },
  compras: {
    nombre: "Compras",
    persona: "Vicky",
    descripcion:
      "Surte pedidos de planeación, lo de esta semana, compra para N+2 y surte extraordinarios autorizados.",
    home: "/compras",
  },
  almacen: {
    nombre: "Almacén general",
    persona: "Oscar",
    descripcion: "Reubicaciones, recolecciones y devoluciones semanales de lo no consumido.",
    home: "/devoluciones",
  },
  direccion: {
    nombre: "Dirección",
    persona: "",
    descripcion: "Recibe las alertas de incumplimiento y el reporte mensual.",
    home: "/direccion",
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
  | "/llegadas"
  | "/extraordinarios"
  | "/direccion"
  | "/devoluciones"
  | "/cosecha"
  | "/liquidacion"
  | "/rendimiento";

export const NAV: { to: NavPath; label: string; roles: Role[] }[] = [
  { to: "/ranchos", label: "Estatus y costos", roles: ["admin", "administrador"] },
  { to: "/planeacion", label: "Planeación y avance", roles: ["admin", "ingeniero"] },
  { to: "/solicitudes", label: "Solicitudes de planta", roles: ["admin", "ingeniero"] },
  { to: "/llegadas", label: "Lo que llega al rancho", roles: ["admin", "ingeniero"] },
  { to: "/extraordinarios", label: "Extraordinarios", roles: ["admin", "autorizador", "ingeniero"] },
  { to: "/cosecha", label: "Cosecha", roles: ["admin", "ingeniero"] },
  { to: "/liquidacion", label: "Liquidación semanal", roles: ["admin"] },
  { to: "/rendimiento", label: "Rendimiento y calidad", roles: ["admin", "ingeniero"] },
  { to: "/compras", label: "Compras y entregas", roles: ["admin", "compras"] },
  { to: "/devoluciones", label: "Devoluciones", roles: ["admin", "almacen"] },
  { to: "/alertas", label: "Alertas y reportes", roles: ["admin", "administrador", "almacen"] },
  { to: "/direccion", label: "Alertas a Dirección", roles: ["admin", "direccion"] },
  { to: "/cuenta-planta", label: "Cuenta de planta", roles: ["admin"] },
  { to: "/paquete", label: "Paquete tecnológico", roles: ["admin", "administrador"] },
  { to: "/catalogos", label: "Catálogos", roles: ["admin", "administrador"] },
  { to: "/parametros", label: "Parámetros", roles: ["admin"] },
  { to: "/usuarios", label: "Usuarios y puestos", roles: ["admin"] },
];

/** Se ve la pantalla si cualquiera de los puestos de la persona la tiene. */
export function puedeVer(roles: Role[], path: NavPath): boolean {
  const n = NAV.find((x) => x.to === path);
  return !!n && roles.some((r) => n.roles.includes(r));
}

export function tiene(roles: Role[], ...cuales: Role[]): boolean {
  return roles.some((r) => cuales.includes(r));
}

/** Solo el Super Admin corrige fechas de plantación y cosecha ya registradas. */
export function puedeCorregirFechas(role: Role | null): boolean {
  return role === "admin";
}

/**
 * Permisos de captura de cosecha (Fase 4), configurables por puesto.
 * Por ahora solo el Super Admin captura viajes y evaluaciones.
 */
export const PERMISOS_COSECHA: Record<"viajes" | "evaluaciones", Role[]> = {
  viajes: ["admin"],
  evaluaciones: ["admin"],
};

/** Si alguien tiene varios puestos, entra con el de más alcance. Sin puesto = espera aprobación. */
export function puestoPrincipal(roles: Role[]): Role | null {
  for (const r of ORDEN_PUESTOS) if (roles.includes(r)) return r;
  return null;
}
