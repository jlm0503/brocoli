CREATE OR REPLACE FUNCTION public.puede_escribir(_user_id uuid, _coleccion text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
select case
when _coleccion in ('parametros','asignaciones','viajes','liquidaciones','ciclos') then public.tiene_alguno(_user_id,array['admin'])
when _coleccion in ('gastos','repartos') then public.tiene_alguno(_user_id,array['admin','encargado'])
when _coleccion in ('productos','recetas','adicionales','ranchos','tablas','cultivos','variedades','viveros','choferes','congeladoras','problemas') then public.tiene_alguno(_user_id,array['admin','administrador'])
when _coleccion in ('aplicaciones_campo','continuaciones_aplicacion') then public.tiene_alguno(_user_id,array['admin','administrador','ingeniero'])
when _coleccion = 'devoluciones' then public.tiene_alguno(_user_id,array['admin','almacen','administrador','ingeniero'])
else public.tiene_puesto(_user_id) end
$$;