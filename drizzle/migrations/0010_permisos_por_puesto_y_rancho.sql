CREATE OR REPLACE FUNCTION public.puede_escribir(_user_id uuid, _coleccion text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT CASE
WHEN public.has_role(_user_id,'admin') THEN true
WHEN _coleccion IN ('productos','ranchos','tablas','cultivos','variedades','viveros','choferes','congeladoras','problemas') THEN public.tiene_alguno(_user_id,ARRAY['administrador'])
WHEN _coleccion IN ('lotes','tardias','alertas') THEN public.tiene_alguno(_user_id,ARRAY['ingeniero'])
WHEN _coleccion = 'pedidos' THEN public.tiene_alguno(_user_id,ARRAY['ingeniero','almacen','encargado'])
WHEN _coleccion = 'solicitudes' THEN public.tiene_alguno(_user_id,ARRAY['ingeniero','almacen','encargado'])
WHEN _coleccion = 'recepciones' THEN public.tiene_alguno(_user_id,ARRAY['compras','almacen','encargado'])
WHEN _coleccion = 'extraordinarios' THEN public.tiene_alguno(_user_id,ARRAY['ingeniero','autorizador','compras'])
WHEN _coleccion = 'aplicaciones_campo' THEN public.tiene_alguno(_user_id,ARRAY['ingeniero','encargado','administrador'])
WHEN _coleccion = 'continuaciones_aplicacion' THEN public.tiene_alguno(_user_id,ARRAY['ingeniero','administrador'])
WHEN _coleccion = 'devoluciones' THEN public.tiene_alguno(_user_id,ARRAY['almacen','ingeniero','administrador'])
WHEN _coleccion = 'viajes' THEN public.tiene_alguno(_user_id,ARRAY['ingeniero','encargado'])
WHEN _coleccion IN ('gastos','repartos') THEN public.tiene_alguno(_user_id,ARRAY['encargado','administrador'])
WHEN _coleccion = 'alertas_direccion' THEN public.tiene_alguno(_user_id,ARRAY['ingeniero','autorizador','direccion'])
ELSE false END;
$$;

CREATE OR REPLACE FUNCTION public.rancho_permitido(_user_id uuid, _rancho text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT public.tiene_alguno(_user_id, ARRAY['admin','administrador','compras','almacen','autorizador','direccion']) OR
(EXISTS (SELECT 1 FROM public.registros r WHERE r.coleccion='asignaciones' AND r.id=_user_id::text AND coalesce(r.data->'ranchoIds','[]'::jsonb) ? _rancho));
$$;

CREATE OR REPLACE FUNCTION public.registro_en_ranchos(_user_id uuid, _coleccion text, _id text, _data jsonb) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE x jsonb; rid text; lid text; n integer := 0;
BEGIN
IF public.tiene_alguno(_user_id,ARRAY['admin','administrador','compras','almacen','autorizador','direccion']) THEN RETURN true; END IF;
IF NOT public.tiene_puesto(_user_id) THEN RETURN false; END IF;
IF _coleccion='asignaciones' THEN RETURN _id=_user_id::text; END IF;
IF _coleccion='ranchos' THEN RETURN public.rancho_permitido(_user_id,_id); END IF;
IF _coleccion IN ('solicitudes','viajes') THEN
 IF _coleccion='solicitudes' THEN
  FOR x IN SELECT value FROM jsonb_array_elements(coalesce(_data->'lineas','[]'::jsonb)) LOOP
   n:=n+1; IF NOT public.rancho_permitido(_user_id,x->>'ranchoId') THEN RETURN false; END IF;
  END LOOP;
 ELSE
  FOR lid IN SELECT jsonb_array_elements_text(coalesce(_data->'loteIds','[]'::jsonb)) LOOP
   n:=n+1; SELECT data->>'ranchoId' INTO rid FROM public.registros WHERE coleccion='lotes' AND id=lid;
   IF rid IS NULL OR NOT public.rancho_permitido(_user_id,rid) THEN RETURN false; END IF;
  END LOOP;
 END IF;
 RETURN n>0;
END IF;
IF _coleccion='recepciones' THEN
 SELECT data->>'ranchoId' INTO rid FROM public.registros WHERE coleccion='lotes' AND id=split_part(_id,'|',1);
 RETURN rid IS NOT NULL AND public.rancho_permitido(_user_id,rid);
END IF;
IF _data ? 'ranchoId' THEN RETURN public.rancho_permitido(_user_id,_data->>'ranchoId'); END IF;
IF _coleccion='continuaciones_aplicacion' THEN
 lid:=CASE WHEN split_part(_id,'|',1) IN ('prep','extra') THEN split_part(_id,'|',3) ELSE split_part(_id,'|',1) END;
 SELECT data->>'ranchoId' INTO rid FROM public.registros WHERE coleccion='lotes' AND id=lid;
 RETURN rid IS NOT NULL AND public.rancho_permitido(_user_id,rid);
END IF;
IF _coleccion='adicionales' THEN RETURN false; END IF;
RETURN _coleccion IN ('productos','recetas','cultivos','variedades','viveros','choferes','congeladoras','problemas','parametros','sistema');
END;
$$;

ALTER POLICY "Con puesto se ven los datos" ON public.registros USING (public.tiene_puesto(auth.uid()) AND coleccion NOT IN ('gastos','repartos') AND public.registro_en_ranchos(auth.uid(),coleccion,id,data));
ALTER POLICY "Gastos comunes: solo Super Admin y Encargado" ON public.registros USING (coleccion IN ('gastos','repartos') AND public.tiene_alguno(auth.uid(),ARRAY['admin','encargado','administrador','almacen']) AND public.registro_en_ranchos(auth.uid(),coleccion,id,data));
ALTER POLICY "Escribir según puesto" ON public.registros WITH CHECK (public.puede_escribir(auth.uid(),coleccion) AND public.registro_en_ranchos(auth.uid(),coleccion,id,data));
ALTER POLICY "Actualizar según puesto" ON public.registros USING (public.puede_escribir(auth.uid(),coleccion) AND public.registro_en_ranchos(auth.uid(),coleccion,id,data)) WITH CHECK (public.puede_escribir(auth.uid(),coleccion) AND public.registro_en_ranchos(auth.uid(),coleccion,id,data));
ALTER POLICY "Borrar según puesto" ON public.registros USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.proteger_viajes_campo() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
IF auth.uid() IS NULL OR public.has_role(auth.uid(),'admin') THEN IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END IF;
IF TG_OP='DELETE' THEN IF OLD.coleccion='viajes' THEN RAISE EXCEPTION 'Solo el Super Admin elimina viajes.'; END IF; RETURN OLD; END IF;
IF NEW.coleccion='viajes' OR (TG_OP='UPDATE' AND OLD.coleccion='viajes') THEN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Solo el Super Admin modifica viajes registrados.'; END IF;
 IF NOT public.tiene_alguno(auth.uid(),ARRAY['ingeniero','encargado']) OR NEW.data->>'status' IS DISTINCT FROM 'transito' OR (NEW.data ? 'evaluacion' AND NEW.data->'evaluacion'<>'null'::jsonb) THEN RAISE EXCEPTION 'Campo solo registra salidas en tránsito sin evaluación.'; END IF;
END IF;
RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.proteger_captura_por_puesto() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); c text; a jsonb; b jsonb; receptor boolean; ingeniero boolean; comprador boolean; autorizador boolean;
BEGIN
IF uid IS NULL OR public.has_role(uid,'admin') THEN IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END IF;
IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Tu puesto no elimina registros.'; END IF;
c:=NEW.coleccion;
IF TG_OP='UPDATE' AND (NEW.coleccion<>OLD.coleccion OR NEW.id<>OLD.id) THEN RAISE EXCEPTION 'No se puede cambiar la identidad de un registro.'; END IF;
receptor:=public.tiene_alguno(uid,ARRAY['almacen','encargado']); ingeniero:=public.has_role(uid,'ingeniero'); comprador:=public.has_role(uid,'compras'); autorizador:=public.has_role(uid,'autorizador');
IF c='lotes' THEN
 IF TG_OP='UPDATE' AND ((OLD.data->'cerrado') IS DISTINCT FROM (NEW.data->'cerrado') OR (OLD.data->'cosechaTerminada') IS DISTINCT FROM (NEW.data->'cosechaTerminada') OR (OLD.data->'finalizado') IS DISTINCT FROM (NEW.data->'finalizado')) THEN RAISE EXCEPTION 'Solo el Super Admin cierra la cosecha o ciclo.'; END IF;
 IF TG_OP='INSERT' AND (coalesce((NEW.data->>'cerrado')::boolean,false) OR NEW.data ? 'cosechaTerminada') THEN RAISE EXCEPTION 'Campo no crea ciclos cerrados.'; END IF;
END IF;
IF c='pedidos' THEN
 IF TG_OP='INSERT' THEN
  IF NOT ingeniero OR NEW.data->>'status' IS DISTINCT FROM 'pendiente' OR NEW.data ? 'cantidadesRecibidas' OR NEW.data ? 'fechaEntrega' OR NEW.data ? 'foto' THEN RAISE EXCEPTION 'Solo Ingeniería genera pedidos pendientes sin recepción.'; END IF;
 ELSE
  IF ingeniero AND (NEW.data-ARRAY['status','cantidadesRecibidas','foto','fechaEntrega']) IS DISTINCT FROM (OLD.data-ARRAY['status','cantidadesRecibidas','foto','fechaEntrega']) THEN
   IF (NEW.data->'cantidadesRecibidas') IS DISTINCT FROM (OLD.data->'cantidadesRecibidas') OR (NEW.data->'foto') IS DISTINCT FROM (OLD.data->'foto') OR (NEW.data->'fechaEntrega') IS DISTINCT FROM (OLD.data->'fechaEntrega') OR NEW.data->>'status'='entregado' AND OLD.data->>'status'<>'entregado' THEN RAISE EXCEPTION 'Ingeniería no confirma entregas.'; END IF;
  ELSIF receptor THEN
   IF (NEW.data-ARRAY['status','cantidadesRecibidas','foto','fechaEntrega']) IS DISTINCT FROM (OLD.data-ARRAY['status','cantidadesRecibidas','foto','fechaEntrega']) OR NEW.data->>'status' NOT IN ('pendiente','entregado') THEN RAISE EXCEPTION 'Recepción no modifica lo solicitado.'; END IF;
  ELSIF NOT ingeniero OR (NEW.data->'cantidadesRecibidas') IS DISTINCT FROM (OLD.data->'cantidadesRecibidas') OR (NEW.data->'foto') IS DISTINCT FROM (OLD.data->'foto') OR (NEW.data->'fechaEntrega') IS DISTINCT FROM (OLD.data->'fechaEntrega') OR NEW.data->>'status' NOT IN ('pendiente','cancelado') THEN RAISE EXCEPTION 'Tu puesto no confirma entregas.'; END IF;
 END IF;
END IF;
IF c='recepciones' AND NOT receptor THEN
 IF NOT comprador OR NEW.data->>'status' NOT IN ('pendiente','comprado','cancelado') THEN RAISE EXCEPTION 'Compras no confirma recepción en rancho.'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (NEW.data-'status') IS DISTINCT FROM (OLD.data-'status') THEN RAISE EXCEPTION 'Compras no modifica cantidades ni evidencias recibidas.'; END IF;
 ELSIF (NEW.data-'status')<>'{}'::jsonb THEN RAISE EXCEPTION 'Compras solo registra el estado de compra.'; END IF;
END IF;
IF c='solicitudes' THEN
 IF TG_OP='INSERT' THEN
  IF NOT ingeniero OR NEW.data->>'status' IS DISTINCT FROM 'generada' OR NEW.data ? 'entregas' OR NEW.data ? 'recepcion' OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(NEW.data->'lineas','[]'::jsonb)) x WHERE x ? 'plantasRecibidas') THEN RAISE EXCEPTION 'Ingeniería solo genera solicitudes sin recepción.'; END IF;
 ELSE
  a:=OLD.data-ARRAY['status','entregas','recepcion']; b:=NEW.data-ARRAY['status','entregas','recepcion'];
  SELECT jsonb_set(a,'{lineas}',coalesce(jsonb_agg(x-'plantasRecibidas'),'[]'::jsonb)) INTO a FROM jsonb_array_elements(coalesce(a->'lineas','[]'::jsonb)) x;
  SELECT jsonb_set(b,'{lineas}',coalesce(jsonb_agg(x-'plantasRecibidas'),'[]'::jsonb)) INTO b FROM jsonb_array_elements(coalesce(b->'lineas','[]'::jsonb)) x;
  IF receptor AND a=b THEN
   IF NEW.data->>'status' NOT IN ('parcial','recibida') THEN RAISE EXCEPTION 'Recepción solo confirma planta recibida.'; END IF;
  ELSIF ingeniero THEN
   IF (NEW.data->'entregas') IS DISTINCT FROM (OLD.data->'entregas') OR (NEW.data->'recepcion') IS DISTINCT FROM (OLD.data->'recepcion') OR NEW.data->>'status' NOT IN ('generada','enviada','cancelada') OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(NEW.data->'lineas','[]'::jsonb)) x WHERE x ? 'plantasRecibidas') THEN RAISE EXCEPTION 'Ingeniería no confirma recepción de planta.'; END IF;
  ELSE RAISE EXCEPTION 'Recepción no modifica lo solicitado.'; END IF;
 END IF;
END IF;
IF c='extraordinarios' THEN
 IF TG_OP='INSERT' THEN IF NOT ingeniero OR NEW.data->>'status' IS DISTINCT FROM 'por_autorizar' OR NEW.data ? 'autorizacion' OR NEW.data ? 'surtido' OR NEW.data ? 'reparto' THEN RAISE EXCEPTION 'Ingeniería solo solicita extraordinarios.'; END IF;
 ELSE
  IF autorizador AND (NEW.data-ARRAY['status','autorizacion','lineas','reparto'])=(OLD.data-ARRAY['status','autorizacion','lineas','reparto']) AND OLD.data->>'status'='por_autorizar' AND NEW.data->>'status' IN ('autorizada','rechazada') THEN NULL;
  ELSIF comprador AND (NEW.data-ARRAY['status','surtido','reparto'])=(OLD.data-ARRAY['status','surtido','reparto']) AND OLD.data->>'status'='autorizada' AND NEW.data->>'status'='surtida' THEN NULL;
  ELSIF ingeniero AND (NEW.data-'mejora')=(OLD.data-'mejora') THEN NULL;
  ELSE RAISE EXCEPTION 'Tu puesto no realiza esta acción de extraordinarios.'; END IF;
 END IF;
END IF;
IF c='devoluciones' AND NOT public.has_role(uid,'almacen') THEN
 IF TG_OP<>'INSERT' OR NOT public.tiene_alguno(uid,ARRAY['ingeniero','administrador']) OR coalesce(NEW.data->>'fuenteKey','')='' THEN RAISE EXCEPTION 'Solo Almacén captura devoluciones generales; Campo devuelve sobrantes de su fuente.'; END IF;
END IF;
IF c='alertas' AND (TG_OP<>'INSERT' OR NEW.data->>'status' IS DISTINCT FROM 'abierta') THEN RAISE EXCEPTION 'Solo el Super Admin resuelve alertas.'; END IF;
IF c='alertas_direccion' AND NOT public.has_role(uid,'direccion') THEN
 IF TG_OP<>'INSERT' OR NEW.data->>'status' IS DISTINCT FROM 'abierta' THEN RAISE EXCEPTION 'Tu puesto no cierra avisos de Dirección.'; END IF;
END IF;
RETURN NEW;
END;
$$;
CREATE TRIGGER registros_captura_por_puesto BEFORE INSERT OR UPDATE OR DELETE ON public.registros FOR EACH ROW EXECUTE FUNCTION public.proteger_captura_por_puesto();