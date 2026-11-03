-- Fase 3: puestos nuevos (admin sigue siendo el Super Admin) y colecciones nuevas.
alter type public.app_role add value if not exists 'administrador';
alter type public.app_role add value if not exists 'autorizador';
alter type public.app_role add value if not exists 'almacen';
alter type public.app_role add value if not exists 'direccion';

create or replace function public.tiene_alguno(_user_id uuid, _roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role::text = any(_roles))
$$;

alter table public.registros drop constraint registros_coleccion_check;
alter table public.registros add constraint registros_coleccion_check check (coleccion in (
  'productos', 'recetas', 'adicionales', 'ranchos', 'tablas',
  'lotes', 'pedidos', 'tardias', 'alertas', 'recepciones', 'inventario', 'sistema',
  'cultivos', 'variedades', 'viveros', 'choferes', 'congeladoras', 'problemas', 'parametros',
  'solicitudes', 'extraordinarios', 'alertas_direccion', 'devoluciones', 'asignaciones'));

create or replace function public.puede_escribir(_user_id uuid, _coleccion text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when _coleccion in ('parametros', 'asignaciones')
      then public.tiene_alguno(_user_id, array['admin'])
    when _coleccion in ('productos', 'recetas', 'adicionales', 'ranchos', 'tablas',
                        'cultivos', 'variedades', 'viveros', 'choferes', 'congeladoras', 'problemas')
      then public.tiene_alguno(_user_id, array['admin', 'administrador'])
    when _coleccion = 'devoluciones'
      then public.tiene_alguno(_user_id, array['admin', 'almacen'])
    else public.tiene_puesto(_user_id)
  end
$$;