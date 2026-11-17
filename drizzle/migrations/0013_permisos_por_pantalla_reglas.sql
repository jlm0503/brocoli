DO $do$
DECLARE d text;
BEGIN
d := pg_get_functiondef('public.proteger_captura_por_puesto'::regproc);
d := replace(d, 'IF uid IS NULL OR public.has_role(uid,''admin'') THEN', 'IF uid IS NULL OR public.has_role(uid,''admin'') OR public.personalizado(uid) THEN');
EXECUTE d;
d := pg_get_functiondef('public.proteger_viajes_campo'::regproc);
d := replace(d, 'IF auth.uid() IS NULL OR public.has_role(auth.uid(),''admin'') THEN', 'IF auth.uid() IS NULL OR public.has_role(auth.uid(),''admin'') OR public.personalizado(auth.uid()) THEN');
EXECUTE d;
END
$do$;

CREATE TRIGGER registros_permisos_personalizados BEFORE INSERT OR DELETE OR UPDATE ON public.registros FOR EACH ROW EXECUTE FUNCTION public.proteger_personalizado();

CREATE POLICY "Gastos comunes con permiso de pantalla" ON public.registros FOR SELECT TO authenticated
USING (coleccion = ANY (ARRAY['gastos','repartos']) AND public.personalizado(auth.uid()) AND public.ve_pantalla(auth.uid(), ARRAY['/gastos','/resultados']) AND public.registro_en_ranchos(auth.uid(), coleccion, id, data));

CREATE POLICY "Borrar con permiso de pantalla" ON public.registros FOR DELETE TO authenticated
USING (public.personalizado(auth.uid()) AND public.tiene_permiso(auth.uid(), coleccion, 'borrar') AND public.registro_en_ranchos(auth.uid(), coleccion, id, data));
