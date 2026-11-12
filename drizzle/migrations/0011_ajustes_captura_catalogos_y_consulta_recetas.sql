ALTER POLICY "Borrar según puesto" ON public.registros USING ((public.has_role(auth.uid(),'admin') OR (coleccion IN ('productos','ranchos','tablas','cultivos','variedades','viveros','choferes','congeladoras','problemas') AND public.has_role(auth.uid(),'administrador')) OR (coleccion IN ('gastos','repartos') AND public.tiene_alguno(auth.uid(),ARRAY['encargado','administrador'])) OR (coleccion='devoluciones' AND public.has_role(auth.uid(),'almacen'))) AND public.registro_en_ranchos(auth.uid(),coleccion,id,data));
CREATE OR REPLACE FUNCTION public.proteger_captura_por_puesto() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); c text; a jsonb; b jsonb; receptor boolean; ingeniero boolean; comprador boolean; autorizador boolean;
BEGIN
IF uid IS NULL OR public.has_role(uid,'admin') THEN IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END IF;
IF TG_OP='DELETE' THEN
 IF (OLD.coleccion IN ('productos','ranchos','tablas','cultivos','variedades','viveros','choferes','congeladoras','problemas') AND public.has_role(uid,'administrador')) OR (OLD.coleccion IN ('gastos','repartos') AND public.tiene_alguno(uid,ARRAY['encargado','administrador'])) OR (OLD.coleccion='devoluciones' AND public.has_role(uid,'almacen')) THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'Tu puesto no elimina registros.';
END IF;
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
  IF ingeniero AND NOT receptor THEN
   IF (NEW.data->'cantidadesRecibidas') IS DISTINCT FROM (OLD.data->'cantidadesRecibidas') OR (NEW.data->'foto') IS DISTINCT FROM (OLD.data->'foto') OR (NEW.data->'fechaEntrega') IS DISTINCT FROM (OLD.data->'fechaEntrega') OR NEW.data->>'status'='entregado' AND OLD.data->>'status'<>'entregado' THEN RAISE EXCEPTION 'Ingeniería no confirma entregas.'; END IF;
  ELSIF receptor THEN
   IF (NEW.data-ARRAY['status','cantidadesRecibidas','foto','fechaEntrega']) IS DISTINCT FROM (OLD.data-ARRAY['status','cantidadesRecibidas','foto','fechaEntrega']) OR NEW.data->>'status' NOT IN ('pendiente','entregado') THEN RAISE EXCEPTION 'Recepción no modifica lo solicitado.'; END IF;
  ELSE RAISE EXCEPTION 'Tu puesto no modifica pedidos.'; END IF;
 END IF;
END IF;
IF c='recepciones' AND NOT receptor THEN
 IF NOT comprador OR NEW.data->>'status' NOT IN ('pendiente','comprado','cancelado') THEN RAISE EXCEPTION 'Compras no confirma recepción en rancho.'; END IF;
 IF TG_OP='UPDATE' THEN IF (NEW.data-'status') IS DISTINCT FROM (OLD.data-'status') THEN RAISE EXCEPTION 'Compras no modifica cantidades ni evidencias recibidas.'; END IF;
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
ALTER POLICY "Con puesto se ven los datos" ON public.registros USING (public.tiene_puesto(auth.uid()) AND coleccion NOT IN ('gastos','repartos') AND (coleccion='adicionales' OR public.registro_en_ranchos(auth.uid(),coleccion,id,data)));