-- Fase 4: viajes de cosecha (salida + evaluación) y liquidaciones semanales.
alter table public.registros drop constraint registros_coleccion_check;
alter table public.registros add constraint registros_coleccion_check check (coleccion in (
  'productos', 'recetas', 'adicionales', 'ranchos', 'tablas',
  'lotes', 'pedidos', 'tardias', 'alertas', 'recepciones', 'inventario', 'sistema',
  'cultivos', 'variedades', 'viveros', 'choferes', 'congeladoras', 'problemas', 'parametros',
  'solicitudes', 'extraordinarios', 'alertas_direccion', 'devoluciones', 'asignaciones',
  'viajes', 'liquidaciones'));

create or replace function public.puede_escribir(_user_id uuid, _coleccion text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when _coleccion in ('parametros', 'asignaciones', 'viajes', 'liquidaciones')
      then public.tiene_alguno(_user_id, array['admin'])
    when _coleccion in ('productos', 'recetas', 'adicionales', 'ranchos', 'tablas',
                        'cultivos', 'variedades', 'viveros', 'choferes', 'congeladoras', 'problemas')
      then public.tiene_alguno(_user_id, array['admin', 'administrador'])
    when _coleccion = 'devoluciones'
      then public.tiene_alguno(_user_id, array['admin', 'almacen'])
    else public.tiene_puesto(_user_id)
  end
$$;