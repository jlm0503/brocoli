-- Fase 6: puesto de Encargado de rancho (capturista de gastos) y gastos comunes por rancho y cultivo.
alter type public.app_role add value if not exists 'encargado';

alter table public.registros drop constraint registros_coleccion_check;
alter table public.registros add constraint registros_coleccion_check check (coleccion in (
  'productos', 'recetas', 'adicionales', 'ranchos', 'tablas',
  'lotes', 'pedidos', 'tardias', 'alertas', 'recepciones', 'inventario', 'sistema',
  'cultivos', 'variedades', 'viveros', 'choferes', 'congeladoras', 'problemas', 'parametros',
  'solicitudes', 'extraordinarios', 'alertas_direccion', 'devoluciones', 'asignaciones',
  'viajes', 'liquidaciones', 'ciclos', 'gastos', 'repartos'));

create or replace function public.puede_escribir(_user_id uuid, _coleccion text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when _coleccion in ('parametros', 'asignaciones', 'viajes', 'liquidaciones', 'ciclos')
      then public.tiene_alguno(_user_id, array['admin'])
    when _coleccion in ('gastos', 'repartos')
      then public.tiene_alguno(_user_id, array['admin', 'encargado'])
    when _coleccion in ('productos', 'recetas', 'adicionales', 'ranchos', 'tablas',
                        'cultivos', 'variedades', 'viveros', 'choferes', 'congeladoras',
                        'problemas')
      then public.tiene_alguno(_user_id, array['admin', 'administrador'])
    when _coleccion = 'devoluciones'
      then public.tiene_alguno(_user_id, array['admin', 'almacen'])
    else public.tiene_puesto(_user_id)
  end
$$;

-- Los importes de gastos comunes solo los ve quien los captura y el Super Admin.
drop policy "Con puesto se ven los datos" on public.registros;
create policy "Con puesto se ven los datos" on public.registros
  for select to authenticated using (
    public.tiene_puesto(auth.uid())
    and coleccion not in ('gastos', 'repartos')
  );
create policy "Gastos comunes: solo Super Admin y Encargado" on public.registros
  for select to authenticated using (
    coleccion in ('gastos', 'repartos')
    and public.tiene_alguno(auth.uid(), array['admin', 'encargado'])
  );
