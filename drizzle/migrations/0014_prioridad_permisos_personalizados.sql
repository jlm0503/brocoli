CREATE OR REPLACE FUNCTION public.personalizado(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
SELECT NOT public.has_role(_user_id,'admin') AND EXISTS (SELECT 1 FROM public.permisos_pantalla WHERE user_id=_user_id);
$$;
CREATE OR REPLACE FUNCTION public.todos_ranchos(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
SELECT public.has_role(_user_id,'admin')
 OR (NOT public.personalizado(_user_id) AND public.tiene_alguno(_user_id, ARRAY['administrador','compras','almacen','autorizador','direccion']))
 OR EXISTS (SELECT 1 FROM public.registros r WHERE r.coleccion='asignaciones' AND r.id=_user_id::text AND coalesce((r.data->>'todos')::boolean,false));
$$;