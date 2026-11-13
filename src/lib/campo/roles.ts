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
    home: "/ranchos",
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

const CAPTURA: Partial<Record<NavPath, Role[]>> = {
  "/aplicaciones": ["ingeniero", "encargado", "administrador"],
  "/planeacion": ["ingeniero"], "/solicitudes": ["ingeniero"],
  "/llegadas": ["almacen", "encargado"], "/extraordinarios": ["ingeniero", "autorizador"],
  "/cosecha": ["ingeniero", "encargado"], "/compras": ["compras"],
  "/devoluciones": ["almacen"], "/gastos": ["encargado", "administrador"],
  "/catalogos": ["administrador"],
};

/** Consulta nunca concede captura; varios puestos suman permisos. */
export function puedeCapturar(roles: Role[], path: NavPath): boolean {
  return puedeVer(roles, path) && (roles.includes("admin") || tiene(roles, ...(CAPTURA[path] ?? [])));
}

export function puedeResolverSobrantes(roles: Role[]): boolean {
  return tiene(roles, "admin", "ingeniero", "administrador");
}

/** null = todos; [] = ninguno, incluso mientras se cargan las asignaciones. */
export function alcanceRanchos(roles: Role[], asignados: string[]): string[] | null {
  if (!roles.length) return [];
  return roles.some(r => r !== "ingeniero" && r !== "encargado") ? null : asignados;
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

export function puedeOperacionCampo(roles: Role[], operacion: string): boolean {
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
export function puestoPrincipal(roles: Role[]): Role | null {
  for (const r of ORDEN_PUESTOS) if (roles.includes(r)) return r;
  return null;
}
