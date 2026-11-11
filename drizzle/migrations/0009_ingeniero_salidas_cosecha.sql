CREATE OR REPLACE FUNCTION public.puede_escribir(_user_id uuid, _coleccion text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
select case
when _coleccion = 'viajes' then public.tiene_alguno(_user_id,array['admin','ingeniero'])
when _coleccion in ('parametros','asignaciones','liquidaciones','ciclos') then public.tiene_alguno(_user_id,array['admin'])
when _coleccion in ('gastos','repartos') then public.tiene_alguno(_user_id,array['admin','encargado'])
when _coleccion in ('productos','recetas','adicionales','ranchos','tablas','cultivos','variedades','viveros','choferes','congeladoras','problemas') then public.tiene_alguno(_user_id,array['admin','administrador'])
when _coleccion in ('aplicaciones_campo','continuaciones_aplicacion') then public.tiene_alguno(_user_id,array['admin','administrador','ingeniero'])
when _coleccion = 'devoluciones' then public.tiene_alguno(_user_id,array['admin','almacen','administrador','ingeniero'])
else public.tiene_puesto(_user_id) end
$$;
CREATE OR REPLACE FUNCTION public.proteger_viajes_campo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.coleccion = 'viajes' THEN RAISE EXCEPTION 'Solo el Super Admin elimina viajes.'; END IF;
    RETURN OLD;
  END IF;
  IF NEW.coleccion = 'viajes' OR (TG_OP = 'UPDATE' AND OLD.coleccion = 'viajes') THEN
    IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Solo el Super Admin modifica viajes registrados.'; END IF;
    IF NOT public.has_role(auth.uid(), 'ingeniero'::public.app_role)
      OR NEW.data->>'status' IS DISTINCT FROM 'transito'
      OR (NEW.data ? 'evaluacion' AND NEW.data->'evaluacion' <> 'null'::jsonb)
    THEN RAISE EXCEPTION 'El Ingeniero solo registra salidas sin evaluación.'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER proteger_viajes_campo BEFORE INSERT OR UPDATE OR DELETE ON public.registros
FOR EACH ROW EXECUTE FUNCTION public.proteger_viajes_campo();