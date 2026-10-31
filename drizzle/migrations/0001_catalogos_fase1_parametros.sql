-- Nuevos catálogos de la Fase 1: cultivos, variedades, viveros, choferes, congeladoras,
-- problemas de calidad y parámetros con fecha de vigencia. Solo el administrador los cambia.
alter table public.registros drop constraint registros_coleccion_check;
alter table public.registros add constraint registros_coleccion_check check (coleccion in (
  'productos', 'recetas', 'adicionales', 'ranchos', 'tablas',
  'lotes', 'pedidos', 'tardias', 'alertas', 'recepciones', 'inventario', 'sistema',
  'cultivos', 'variedades', 'viveros', 'choferes', 'congeladoras', 'problemas', 'parametros'));

create or replace function public.puede_escribir(_user_id uuid, _coleccion text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when _coleccion in ('productos', 'recetas', 'adicionales', 'ranchos', 'tablas',
                        'cultivos', 'variedades', 'viveros', 'choferes', 'congeladoras',
                        'problemas', 'parametros')
      then public.has_role(_user_id, 'admin')
    else public.tiene_puesto(_user_id)
  end
$$;

-- Valores de arranque (no pisa lo que ya exista)
insert into public.registros (coleccion, id, data) values
('cultivos', 'brocoli', '{"id":"brocoli","nombre":"Brócoli"}'::jsonb),
('cultivos', 'coliflor', '{"id":"coliflor","nombre":"Coliflor"}'::jsonb),
('cultivos', 'fresa', '{"id":"fresa","nombre":"Fresa"}'::jsonb),
('cultivos', 'frambuesa', '{"id":"frambuesa","nombre":"Frambuesa"}'::jsonb),
('cultivos', 'zarzamora', '{"id":"zarzamora","nombre":"Zarzamora"}'::jsonb),
('cultivos', 'maiz', '{"id":"maiz","nombre":"Maíz"}'::jsonb),
('variedades', 'diamante', '{"id":"diamante","nombre":"Diamante","cultivo":"brocoli","cicloDias":70}'::jsonb),
('variedades', 'tlaloc', '{"id":"tlaloc","nombre":"Tlaloc","cultivo":"brocoli","cicloDias":84}'::jsonb),
('variedades', 'altamira', '{"id":"altamira","nombre":"Altamira","cultivo":"coliflor","cicloDias":95}'::jsonb),
('congeladoras', 'principal', '{"id":"principal","nombre":"Congeladora"}'::jsonb),
('problemas', 'floracion', '{"id":"floracion","nombre":"Floración / grano abierto"}'::jsonb),
('problemas', 'amarillamiento', '{"id":"amarillamiento","nombre":"Amarillamiento"}'::jsonb),
('problemas', 'tallo-hueco', '{"id":"tallo-hueco","nombre":"Tallo hueco"}'::jsonb),
('problemas', 'plaga', '{"id":"plaga","nombre":"Daño por plaga"}'::jsonb),
('problemas', 'pudricion', '{"id":"pudricion","nombre":"Pudrición / hongo"}'::jsonb),
('problemas', 'golpe', '{"id":"golpe","nombre":"Golpe / daño mecánico"}'::jsonb),
('problemas', 'tamano', '{"id":"tamano","nombre":"Tamaño fuera de especificación"}'::jsonb),
('problemas', 'deforme', '{"id":"deforme","nombre":"Cabeza deforme"}'::jsonb),
('problemas', 'otros', '{"id":"otros","nombre":"Otros"}'::jsonb),
('parametros', 'plantasPorHa-2026-01-01', '{"id":"plantasPorHa-2026-01-01","clave":"plantasPorHa","valor":60000,"desde":"2026-01-01"}'::jsonb),
('parametros', 'costoPlantaHa-2026-01-01', '{"id":"costoPlantaHa-2026-01-01","clave":"costoPlantaHa","valor":16200,"desde":"2026-01-01"}'::jsonb),
('parametros', 'precioKg-2026-01-01', '{"id":"precioKg-2026-01-01","clave":"precioKg","valor":10.5,"desde":"2026-01-01"}'::jsonb),
('parametros', 'descuentoViaje-2026-01-01', '{"id":"descuentoViaje-2026-01-01","clave":"descuentoViaje","valor":10000,"desde":"2026-01-01"}'::jsonb),
('parametros', 'metaKgHa-2026-01-01', '{"id":"metaKgHa-2026-01-01","clave":"metaKgHa","valor":16000,"desde":"2026-01-01"}'::jsonb),
('parametros', 'rollosCintaHa-2026-01-01', '{"id":"rollosCintaHa-2026-01-01","clave":"rollosCintaHa","valor":2.1,"desde":"2026-01-01"}'::jsonb),
('parametros', 'mermaMax-2026-01-01', '{"id":"mermaMax-2026-01-01","clave":"mermaMax","valor":15,"desde":"2026-01-01"}'::jsonb),
('parametros', 'diasSinEvaluacion-2026-01-01', '{"id":"diasSinEvaluacion-2026-01-01","clave":"diasSinEvaluacion","valor":3,"desde":"2026-01-01"}'::jsonb)
on conflict (coleccion, id) do nothing;