import { GRUPOS } from "./navegacion";
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
  "encargado",
];

export const ROLES: Record<
  Role,
  { nombre: string; persona: string; descripcion: string; home: string }
> = {
  admin: {
    nombre: "Super Admin",
    persona: "Jimena",
    descripcion: "Todo: parámetros, usuarios, corregir fechas, costos y utilidades.",
    home: "/planeacion",
  },
  administrador: {
    nombre: "Administrador",
    persona: "",
    descripcion: "Captura catálogos, aplicaciones y gastos; consulta operaciones, costos y resultados.",
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
    descripcion: "Planea, solicita planta y extraordinarios, registra aplicaciones y salidas; consulta solo sus ranchos asignados.",
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
    descripcion: "Confirma llegadas y registra devoluciones; consulta compras, gastos, consumos e históricos.",
    home: "/devoluciones",
  },
  direccion: {
    nombre: "Dirección",
    persona: "",
    descripcion: "Consulta el panel de campo, costos, consumos y alertas, sin utilidad real.",
    home: "/panel",
  },
  personalizado: {
    nombre: "Acceso personalizado",
    persona: "",
    descripcion: "Pantallas y permisos asignados uno por uno por el Super Admin.",
    home: "/",
  },
  encargado: {
    nombre: "Encargado de rancho",
    persona: "",
    descripcion: "Registra avances de aplicaciones, llegadas, salidas y gastos de sus ranchos asignados; consulta planeación e históricos.",
    home: "/gastos",
  },
};

export type NavPath =
  | "/aplicaciones"
  | "/panel"
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
  | "/rendimiento"
  | "/historicos"
  | "/consumo"
  | "/gastos"
  | "/resultados";

export const NAV: { to: NavPath; label: string; roles: Role[] }[] = [
  { to: "/aplicaciones", label: "Aplicaciones en rancho", roles: ["admin", "ingeniero", "encargado", "administrador"] },
  { to: "/panel", label: "Panel de Dirección", roles: ["admin", "direccion"] },
  { to: "/ranchos", label: "Estatus y costos", roles: ["admin", "ingeniero", "administrador"] },
  { to: "/planeacion", label: "Planeación y avance", roles: ["admin", "ingeniero", "encargado", "administrador"] },
  { to: "/solicitudes", label: "Solicitudes de planta", roles: ["admin", "ingeniero", "encargado", "administrador"] },
  { to: "/llegadas", label: "Lo que llega al rancho", roles: ["admin", "ingeniero", "encargado", "compras", "almacen", "administrador"] },
  { to: "/extraordinarios", label: "Extraordinarios", roles: ["admin", "autorizador", "ingeniero", "administrador"] },
  { to: "/cosecha", label: "Cosecha", roles: ["admin", "ingeniero", "encargado", "administrador"] },
  { to: "/liquidacion", label: "Liquidación semanal", roles: ["admin", "administrador"] },
  { to: "/rendimiento", label: "Rendimiento y calidad", roles: ["admin", "ingeniero"] },
  { to: "/historicos", label: "Cierre e históricos", roles: ["admin", "ingeniero", "encargado", "almacen", "administrador"] },
  { to: "/consumo", label: "Consumo por tabla", roles: ["admin", "ingeniero", "encargado", "almacen", "administrador"] },
  { to: "/gastos", label: "Gastos de rancho", roles: ["admin", "encargado", "almacen", "administrador"] },
  { to: "/resultados", label: "Estado de resultados", roles: ["admin", "administrador"] },
  { to: "/compras", label: "Compras y entregas", roles: ["admin", "compras", "almacen", "administrador"] },
  { to: "/devoluciones", label: "Devoluciones", roles: ["admin", "almacen", "administrador"] },
  { to: "/alertas", label: "Alertas y reportes", roles: ["admin", "administrador", "almacen"] },
  { to: "/direccion", label: "Alertas a Dirección", roles: ["admin", "direccion"] },
  { to: "/cuenta-planta", label: "Cuenta de planta", roles: ["admin", "ingeniero", "administrador"] },
  { to: "/paquete", label: "Paquete tecnológico", roles: ["admin", "ingeniero", "encargado", "compras", "almacen", "administrador"] },
  { to: "/catalogos", label: "Catálogos", roles: ["admin", "administrador"] },
  { to: "/parametros", label: "Parámetros", roles: ["admin"] },
  { to: "/usuarios", label: "Usuarios y permisos", roles: ["admin"] },
];

export type Accion = "ver" | "capturar" | "editar" | "borrar";
export type Nivel = Record<Accion, boolean>;
export type PermisosPantalla = Partial<Record<NavPath, Nivel>>;
/** Puestos de la persona; con `permisos`, el acceso es personalizado por pantalla. */
export type Acceso = readonly Role[] & { permisos?: PermisosPantalla; todosRanchos?: boolean };

export const ACCIONES: { id: Accion; label: string }[] = [
  { id: "ver", label: "Ver" },
  { id: "capturar", label: "Capturar" },
  { id: "editar", label: "Editar" },
  { id: "borrar", label: "Borrar" },
];

export function accesoPersonalizado(permisos: PermisosPantalla, todosRanchos = false): Acceso {
  return Object.assign(["personalizado"] as Role[], { permisos, todosRanchos });
}

/** Las casillas asignadas prevalecen sobre puestos antiguos, incluso si todas están desmarcadas. */
export function resolverAcceso(roles: readonly Role[], permisos: PermisosPantalla, todosRanchos = false): Acceso {
  if (roles.includes("admin") || Object.keys(permisos).length === 0) return roles;
  return accesoPersonalizado(permisos, todosRanchos);
}

/** Sin "Ver" no hay ninguna otra acción en esa pantalla. */
export function normalizarNivel(n: Partial<Nivel>): Nivel {
  const ver = !!n.ver;
  return { ver, capturar: ver && !!n.capturar, editar: ver && !!n.editar, borrar: ver && !!n.borrar };
}

function verLegacy(roles: readonly Role[], path: NavPath): boolean {
  const n = NAV.find((x) => x.to === path);
  return !!n && roles.some((r) => n.roles.includes(r));
}

/** Super Admin todo; personalizado según su casilla; puestos anteriores según su matriz. */
export function permite(a: Acceso, path: NavPath, accion: Accion): boolean {
  if (!NAV.some((n) => n.to === path)) return false;
  if (a.includes("admin")) return true;
  if (a.permisos) {
    const n = a.permisos[path];
    return !!n?.ver && !!n[accion];
  }
  if (!verLegacy(a, path)) return false;
  return accion === "ver" || tiene(a, ...(CAPTURA[path] ?? []));
}

/** Se ve la pantalla si cualquiera de los puestos de la persona la tiene. */
export function puedeVer(roles: Acceso, path: NavPath): boolean {
  return permite(roles, path, "ver");
}

/** Equivalencia de puestos anteriores para acceso personalizado. */
const EQUIVALE: Partial<Record<Role, [NavPath, Accion]>> = {
  ingeniero: ["/extraordinarios", "capturar"],
  autorizador: ["/extraordinarios", "editar"],
  compras: ["/compras", "capturar"],
};

export function tiene(roles: Acceso, ...cuales: Role[]): boolean {
  if (roles.permisos && !roles.includes("admin")) {
    return cuales.some((r) => { const e = EQUIVALE[r]; return !!e && permite(roles, e[0], e[1]); });
  }
  return roles.some((r) => cuales.includes(r));
}

const CAPTURA: Partial<Record<NavPath, Role[]>> = {
  "/aplicaciones": ["ingeniero", "encargado", "administrador"],
  "/planeacion": ["ingeniero"], "/solicitudes": ["ingeniero"],
  "/llegadas": ["almacen", "encargado"], "/extraordinarios": ["ingeniero", "autorizador"],
  "/cosecha": ["ingeniero", "encargado"], "/compras": ["compras"],
  "/devoluciones": ["almacen"], "/gastos": ["encargado", "administrador"],
  "/catalogos": ["administrador"],
};

/** Consulta nunca concede captura; varios puestos suman permisos. Editar también guarda cambios. */
export function puedeCapturar(roles: Acceso, path: NavPath): boolean {
  return permite(roles, path, "capturar") || (!!roles.permisos && permite(roles, path, "editar"));
}

export function puedeResolverSobrantes(roles: Acceso): boolean {
  if (roles.permisos && !roles.includes("admin")) return puedeCapturar(roles, "/aplicaciones");
  return tiene(roles, "admin", "ingeniero", "administrador");
}

/** null = todos; [] = ninguno, incluso mientras se cargan las asignaciones. */
export function alcanceRanchos(roles: Acceso, asignados: string[]): string[] | null {
  if (!roles.length) return [];
  if (roles.includes("admin")) return null;
  if (roles.permisos) return roles.todosRanchos ? null : asignados;
  return roles.some(r => r !== "ingeniero" && r !== "encargado") ? null : asignados;
}

/** Pantalla de inicio: la del puesto o la primera pantalla autorizada. */
export function inicioDe(roles: Acceso): string {
  const p = puestoPrincipal(roles);
  if (p && p !== "personalizado") return ROLES[p].home;
  const orden = GRUPOS.flatMap((g) => g.paths);
  return orden.find((to) => puedeVer(roles, to)) ?? "/";
}

export const OPERACIONES_CAMPO: Record<string, NavPath> = {
  guardarParametro: "/parametros", eliminarParametro: "/parametros",
  agregarSimple: "/catalogos", renombrarSimple: "/catalogos", eliminarSimple: "/catalogos",
  agregarVariedad: "/catalogos", editarDiasVariedad: "/catalogos", eliminarVariedad: "/catalogos",
  setPrecio: "/catalogos", agregarProducto: "/catalogos", editarProducto: "/catalogos",
  agregarRancho: "/catalogos", eliminarRancho: "/catalogos", agregarTabla: "/catalogos",
  eliminarTabla: "/catalogos", reactivarTabla: "/catalogos",
  setDosis: "/paquete", eliminarProductoPaquete: "/paquete", guardarAdicional: "/paquete", eliminarAdicional: "/paquete",
  planearLote: "/planeacion", registrarPlantacion: "/planeacion", cancelarLote: "/planeacion", registrarAvance: "/planeacion",
  generarSolicitud: "/solicitudes", marcarSolicitudEnviada: "/solicitudes", cancelarSolicitud: "/solicitudes",
  recibirPlanta: "/llegadas", entregarPedido: "/llegadas", reabrirPedido: "/llegadas", recibir: "/llegadas",
  marcar: "/compras", resolverAlerta: "/alertas", terminarCosecha: "/historicos", marcarCerrado: "/historicos",
  corregirFechas: "/parametros",
};

export function puedeOperacionCampo(roles: Acceso, operacion: string): boolean {
  const path = OPERACIONES_CAMPO[operacion];
  return !!path && puedeCapturar(roles, path);
}

/** Solo el Super Admin corrige fechas de plantación y cosecha ya registradas. */
export function puedeCorregirFechas(role: Role | null): boolean {
  return role === "admin";
}

/**
 * Permisos de captura de cosecha (Fase 4), configurables por puesto.
 * Ingeniero y Super Admin registran salidas; solo el Super Admin evalúa.
 */
export const PERMISOS_COSECHA: Record<"viajes" | "evaluaciones", Role[]> = {
  viajes: ["admin", "ingeniero", "encargado"],
  evaluaciones: ["admin"],
};

/** Si alguien tiene varios puestos, entra con el de más alcance. Sin puesto = espera aprobación. */
export function puestoPrincipal(roles: readonly Role[]): Role | null {
  for (const r of ORDEN_PUESTOS) if (roles.includes(r)) return r;
  return roles.includes("personalizado") ? "personalizado" : null;
}
