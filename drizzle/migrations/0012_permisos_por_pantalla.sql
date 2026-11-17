CREATE TABLE public.permisos_pantalla (
  user_id uuid NOT NULL,
  pantalla text NOT NULL,
  ver boolean NOT NULL DEFAULT false,
  capturar boolean NOT NULL DEFAULT false,
  editar boolean NOT NULL DEFAULT false,
  borrar boolean NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, pantalla)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permisos_pantalla TO authenticated;
GRANT ALL ON public.permisos_pantalla TO service_role;
ALTER TABLE public.permisos_pantalla ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cada quien ve sus permisos; admin todos" ON public.permisos_pantalla FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin asigna permisos" ON public.permisos_pantalla FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin cambia permisos" ON public.permisos_pantalla FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin quita permisos" ON public.permisos_pantalla FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.pantallas_de(_coleccion text) RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
SELECT CASE
 WHEN _coleccion IN ('productos','ranchos','tablas','cultivos','variedades','viveros','choferes','congeladoras','problemas') THEN ARRAY['/catalogos']
 WHEN _coleccion = 'parametros' THEN ARRAY['/parametros']
 WHEN _coleccion IN ('recetas','adicionales') THEN ARRAY['/paquete']
 WHEN _coleccion IN ('lotes','tardias') THEN ARRAY['/planeacion']
 WHEN _coleccion = 'alertas' THEN ARRAY['/planeacion','/alertas']
 WHEN _coleccion = 'pedidos' THEN ARRAY['/planeacion','/llegadas','/compras']
 WHEN _coleccion = 'solicitudes' THEN ARRAY['/planeacion','/solicitudes','/llegadas']
 WHEN _coleccion = 'recepciones' THEN ARRAY['/compras','/llegadas']
 WHEN _coleccion = 'extraordinarios' THEN ARRAY['/extraordinarios','/compras']
 WHEN _coleccion IN ('aplicaciones_campo','continuaciones_aplicacion') THEN ARRAY['/aplicaciones']
 WHEN _coleccion = 'devoluciones' THEN ARRAY['/devoluciones','/aplicaciones']
 WHEN _coleccion = 'viajes' THEN ARRAY['/cosecha']
 WHEN _coleccion = 'liquidaciones' THEN ARRAY['/liquidacion']
 WHEN _coleccion IN ('gastos','repartos') THEN ARRAY['/gastos']
 WHEN _coleccion = 'alertas_direccion' THEN ARRAY['/direccion','/extraordinarios']
 WHEN _coleccion = 'ciclos' THEN ARRAY['/historicos']
 ELSE ARRAY[]::text[] END;
$$;

CREATE OR REPLACE FUNCTION public.tiene_permiso(_user_id uuid, _coleccion text, _accion text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
SELECT EXISTS (SELECT 1 FROM public.permisos_pantalla p WHERE p.user_id=_user_id AND p.ver AND p.pantalla = ANY(public.pantallas_de(_coleccion))
 AND CASE _accion WHEN 'capturar' THEN p.capturar WHEN 'editar' THEN p.editar WHEN 'borrar' THEN p.borrar WHEN 'escribir' THEN (p.capturar OR p.editar) ELSE true END);
$$;

CREATE OR REPLACE FUNCTION public.ve_pantalla(_user_id uuid, _pantallas text[]) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
SELECT EXISTS (SELECT 1 FROM public.permisos_pantalla WHERE user_id=_user_id AND ver AND pantalla = ANY(_pantallas));
$$;

CREATE OR REPLACE FUNCTION public.personalizado(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id) AND EXISTS (SELECT 1 FROM public.permisos_pantalla WHERE user_id=_user_id AND ver);
$$;

CREATE OR REPLACE FUNCTION public.tiene_puesto(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id) OR EXISTS (SELECT 1 FROM public.permisos_pantalla WHERE user_id=_user_id AND ver);
$$;

CREATE OR REPLACE FUNCTION public.puede_escribir(_user_id uuid, _coleccion text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
SELECT CASE
WHEN public.has_role(_user_id,'admin') THEN true
WHEN public.personalizado(_user_id) THEN public.tiene_permiso(_user_id,_coleccion,'escribir')
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
$function$;

CREATE OR REPLACE FUNCTION public.todos_ranchos(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
SELECT public.tiene_alguno(_user_id, ARRAY['admin','administrador','compras','almacen','autorizador','direccion'])
 OR EXISTS (SELECT 1 FROM public.registros r WHERE r.coleccion='asignaciones' AND r.id=_user_id::text AND coalesce((r.data->>'todos')::boolean,false));
$$;

CREATE OR REPLACE FUNCTION public.rancho_permitido(_user_id uuid, _rancho text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
SELECT public.todos_ranchos(_user_id) OR
(EXISTS (SELECT 1 FROM public.registros r WHERE r.coleccion='asignaciones' AND r.id=_user_id::text AND coalesce(r.data->'ranchoIds','[]'::jsonb) ? _rancho));
$function$;

CREATE OR REPLACE FUNCTION public.registro_en_ranchos(_user_id uuid, _coleccion text, _id text, _data jsonb)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE x jsonb; rid text; lid text; n integer := 0;
BEGIN
IF _coleccion='asignaciones' AND _id=_user_id::text THEN RETURN true; END IF;
IF public.todos_ranchos(_user_id) THEN RETURN true; END IF;
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
$function$;

-- Custom users: generic checks by screen permission; date corrections and closing lots stay Super Admin only.
CREATE OR REPLACE FUNCTION public.proteger_personalizado() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid:=auth.uid(); c text;
BEGIN
IF uid IS NULL OR NOT public.personalizado(uid) THEN IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END IF;
IF TG_OP='DELETE' THEN
 IF public.tiene_permiso(uid,OLD.coleccion,'borrar') THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'No tienes permiso para borrar en esta pantalla.';
END IF;
c:=NEW.coleccion;
IF TG_OP='UPDATE' AND (NEW.coleccion<>OLD.coleccion OR NEW.id<>OLD.id) THEN RAISE EXCEPTION 'No se puede cambiar la identidad de un registro.'; END IF;
IF TG_OP='INSERT' AND NOT public.tiene_permiso(uid,c,'capturar') THEN RAISE EXCEPTION 'No tienes permiso para capturar en esta pantalla.'; END IF;
IF TG_OP='UPDATE' AND NOT public.tiene_permiso(uid,c,'escribir') THEN RAISE EXCEPTION 'No tienes permiso para editar en esta pantalla.'; END IF;
IF c='viajes' AND TG_OP='UPDATE' AND NOT public.tiene_permiso(uid,c,'editar') THEN RAISE EXCEPTION 'No tienes permiso para editar viajes.'; END IF;
IF c='lotes' THEN
 IF TG_OP='UPDATE' AND ((OLD.data->'cerrado') IS DISTINCT FROM (NEW.data->'cerrado') OR (OLD.data->'cosechaTerminada') IS DISTINCT FROM (NEW.data->'cosechaTerminada') OR (OLD.data->'finalizado') IS DISTINCT FROM (NEW.data->'finalizado')) THEN RAISE EXCEPTION 'Solo el Super Admin cierra la cosecha o ciclo.'; END IF;
 IF TG_OP='INSERT' AND (coalesce((NEW.data->>'cerrado')::boolean,false) OR NEW.data ? 'cosechaTerminada') THEN RAISE EXCEPTION 'Campo no crea ciclos cerrados.'; END IF;
END IF;
RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.proteger_captura_por_puesto_v2() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
IF auth.uid() IS NOT NULL AND public.personalizado(auth.uid()) THEN RETURN public.proteger_personalizado_paso(TG_OP, OLD, NEW); END IF;
RETURN NULL;
END $$;
DROP FUNCTION public.proteger_captura_por_puesto_v2();
