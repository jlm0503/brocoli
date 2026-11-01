-- Fase 2: solicitudes de planta (PDF y recepción). Las escribe cualquier persona con puesto.
alter table public.registros drop constraint registros_coleccion_check;
alter table public.registros add constraint registros_coleccion_check check (coleccion in (
  'productos', 'recetas', 'adicionales', 'ranchos', 'tablas',
  'lotes', 'pedidos', 'tardias', 'alertas', 'recepciones', 'inventario', 'sistema',
  'cultivos', 'variedades', 'viveros', 'choferes', 'congeladoras', 'problemas', 'parametros',
  'solicitudes'));