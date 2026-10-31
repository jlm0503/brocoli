-- Puestos
create type public.app_role as enum ('admin', 'ingeniero', 'compras');

-- Perfiles (nombre de cada persona)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);
grant select on public.profiles to authenticated;
grant update (nombre) on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- Puestos asignados (separados del perfil)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select, insert, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.tiene_puesto(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id)
$$;

create policy "Cada quien ve su perfil; admin ve todos" on public.profiles
  for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Cada quien edita su nombre" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "Cada quien ve su puesto; admin ve todos" on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Admin asigna puestos" on public.user_roles
  for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin cambia puestos" on public.user_roles
  for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin quita puestos (no el suyo de admin)" on public.user_roles
  for delete to authenticated using (public.has_role(auth.uid(), 'admin') and not (user_id = auth.uid() and role = 'admin'));

-- Al registrarse: perfil con su nombre. La primera cuenta de la app queda como administrador;
-- las demás esperan a que el administrador les asigne puesto.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nombre, email)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'nombre'), ''), split_part(new.email, '@', 1)), coalesce(new.email, ''));
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Datos de la app: listas planas por colección (cada elemento con su id)
create table public.registros (
  coleccion text not null check (coleccion in (
    'productos', 'recetas', 'adicionales', 'ranchos', 'tablas',
    'lotes', 'pedidos', 'tardias', 'alertas', 'recepciones', 'inventario', 'sistema')),
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (coleccion, id)
);
grant select, insert, update, delete on public.registros to authenticated;
grant all on public.registros to service_role;
alter table public.registros enable row level security;

create or replace function public.puede_escribir(_user_id uuid, _coleccion text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when _coleccion in ('productos', 'recetas', 'adicionales', 'ranchos', 'tablas')
      then public.has_role(_user_id, 'admin')
    else public.tiene_puesto(_user_id)
  end
$$;

create policy "Con puesto se ven los datos" on public.registros
  for select to authenticated using (public.tiene_puesto(auth.uid()));
create policy "Escribir según puesto" on public.registros
  for insert to authenticated with check (public.puede_escribir(auth.uid(), coleccion));
create policy "Actualizar según puesto" on public.registros
  for update to authenticated using (public.puede_escribir(auth.uid(), coleccion))
  with check (public.puede_escribir(auth.uid(), coleccion));
create policy "Borrar según puesto" on public.registros
  for delete to authenticated using (public.puede_escribir(auth.uid(), coleccion));

-- Solo el administrador corrige fechas de plantación o de cosecha ya registradas.
create or replace function public.proteger_fechas_lote()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a jsonb;
  b jsonb;
begin
  new.updated_at := now();
  if new.coleccion <> 'lotes' or auth.uid() is null or public.has_role(auth.uid(), 'admin') then
    return new;
  end if;
  if (old.data->>'fechaCosecha') is distinct from (new.data->>'fechaCosecha')
     and jsonb_array_length(coalesce(old.data->'avances', '[]'::jsonb)) > 0 then
    raise exception 'Solo el administrador puede corregir fechas.';
  end if;
  for a in select value from jsonb_array_elements(coalesce(old.data->'avances', '[]'::jsonb)) loop
    select x.value into b from jsonb_array_elements(coalesce(new.data->'avances', '[]'::jsonb)) x
      where x.value->>'id' = a->>'id';
    if b is null or (b->>'fecha') is distinct from (a->>'fecha') then
      raise exception 'Solo el administrador puede corregir fechas.';
    end if;
  end loop;
  return new;
end $$;

create trigger registros_proteger_fechas
  before update on public.registros
  for each row execute function public.proteger_fechas_lote();

alter publication supabase_realtime add table public.registros;

-- Fotos de evidencia (bucket privado "evidencias")
create policy "Con puesto se suben evidencias" on storage.objects
  for insert to authenticated with check (bucket_id = 'evidencias' and public.tiene_puesto(auth.uid()));
create policy "Con puesto se ven evidencias" on storage.objects
  for select to authenticated using (bucket_id = 'evidencias' and public.tiene_puesto(auth.uid()));

-- Catálogo inicial: productos, paquete tecnológico y semana de arranque
insert into public.registros (coleccion, id, data) values
('productos', 'goal', '{"id":"goal","codigo":"HER-001","nombre":"GOAL 2XL","familia":"Herbicida","unidad":"L","precio":580}'::jsonb),
('productos', 'dualgold', '{"id":"dualgold","codigo":"HER-002","nombre":"Dual Gold","familia":"Herbicida","unidad":"L","precio":1250}'::jsonb),
('productos', 'cintilla', '{"id":"cintilla","codigo":"RIE-001","nombre":"Cintilla","familia":"Riego","unidad":"rollo","precio":3461.54}'::jsonb),
('productos', 'silifosca', '{"id":"silifosca","codigo":"SUE-001","nombre":"Silifosca","familia":"Suelo","unidad":"kg","precio":21.78}'::jsonb),
('productos', 'oneact', '{"id":"oneact","codigo":"BIO-001","nombre":"ONE Activation","familia":"Bioestimulante","unidad":"L","precio":270}'::jsonb),
('productos', 'onedef', '{"id":"onedef","codigo":"BIO-002","nombre":"ONE Defesne","familia":"Bioestimulante","unidad":"L","precio":560}'::jsonb),
('productos', 'map', '{"id":"map","codigo":"FER-001","nombre":"MAP","familia":"Fertilizante","unidad":"kg","precio":28.17}'::jsonb),
('productos', 'fosfo', '{"id":"fosfo","codigo":"FER-002","nombre":"Fosfonitrato","familia":"Fertilizante","unidad":"kg","precio":13.13}'::jsonb),
('productos', 'sulmag', '{"id":"sulmag","codigo":"FER-003","nombre":"Sulmag","familia":"Fertilizante","unidad":"kg","precio":7.9}'::jsonb),
('productos', 'nca', '{"id":"nca","codigo":"FER-004","nombre":"N CA","familia":"Fertilizante","unidad":"kg","precio":10.5}'::jsonb),
('productos', 'nk', '{"id":"nk","codigo":"FER-005","nombre":"N K","familia":"Fertilizante","unidad":"kg","precio":26}'::jsonb),
('productos', 'sferroso', '{"id":"sferroso","codigo":"MIC-001","nombre":"Sulfato Ferroso","familia":"Micronutriente","unidad":"kg","precio":11.1}'::jsonb),
('productos', 'szinc', '{"id":"szinc","codigo":"MIC-002","nombre":"Sulfato de Zinc","familia":"Micronutriente","unidad":"kg","precio":33.3}'::jsonb),
('productos', 'starkop', '{"id":"starkop","codigo":"FUN-001","nombre":"Starkop (Plasmodiofora)","familia":"Fungicida","unidad":"L","precio":180}'::jsonb),
('productos', 'oneneem', '{"id":"oneneem","codigo":"INS-001","nombre":"ONE Neem","familia":"Insecticida","unidad":"L","precio":120}'::jsonb),
('productos', 'xentari', '{"id":"xentari","codigo":"INS-002","nombre":"Xentari (BT)","familia":"Insecticida","unidad":"kg","precio":1188.26}'::jsonb),
('productos', 'massada', '{"id":"massada","codigo":"INS-003","nombre":"Massada 1000 (Novaluron)","familia":"Insecticida","unidad":"L","precio":1040}'::jsonb),
('productos', 'obug1', '{"id":"obug1","codigo":"INS-004","nombre":"O. Bug 1","familia":"Insecticida","unidad":"L","precio":270}'::jsonb),
('productos', 'obug2', '{"id":"obug2","codigo":"INS-005","nombre":"O. Bug 2","familia":"Insecticida","unidad":"L","precio":270}'::jsonb),
('productos', 'tracer', '{"id":"tracer","codigo":"INS-006","nombre":"Tracer","familia":"Insecticida","unidad":"kg","precio":8620}'::jsonb),
('productos', 'avaunt', '{"id":"avaunt","codigo":"INS-007","nombre":"Avaunt","familia":"Insecticida","unidad":"L","precio":2088}'::jsonb),
('productos', 'incipio', '{"id":"incipio","codigo":"INS-008","nombre":"Incipio","familia":"Insecticida","unidad":"L","precio":7480}'::jsonb),
('productos', 'toretto', '{"id":"toretto","codigo":"INS-009","nombre":"Toretto","familia":"Insecticida","unidad":"L","precio":3392.25}'::jsonb),
('productos', 'proclaim', '{"id":"proclaim","codigo":"INS-010","nombre":"Proclaim Opti","familia":"Insecticida","unidad":"kg","precio":3498}'::jsonb),
('productos', 'movento', '{"id":"movento","codigo":"INS-011","nombre":"Movento","familia":"Insecticida","unidad":"L","precio":3652}'::jsonb),
('productos', 'exalt', '{"id":"exalt","codigo":"INS-012","nombre":"Exalt","familia":"Insecticida","unidad":"L","precio":2685.84}'::jsonb),
('productos', 'breakthru', '{"id":"breakthru","codigo":"COA-001","nombre":"Break Thru","familia":"Coadyuvante","unidad":"L","precio":743.2}'::jsonb),
('productos', 'inexa', '{"id":"inexa","codigo":"COA-002","nombre":"IneX-A","familia":"Coadyuvante","unidad":"L","precio":120}'::jsonb),
('recetas', 'brocoli', '{"dosis":{"0":{"oneact":20,"onedef":2,"oneneem":6,"map":10,"fosfo":52},"1":{"onedef":2,"oneneem":6,"map":10,"fosfo":52},"2":{"onedef":2,"oneneem":6,"map":10,"sulmag":15,"fosfo":52},"3":{"xentari":0.5,"breakthru":0.25,"massada":0.2,"obug1":2,"obug2":2,"sferroso":5,"szinc":5,"sulmag":15,"fosfo":52},"4":{"obug1":2,"obug2":2,"breakthru":0.3,"tracer":0.05,"sferroso":5,"szinc":5,"sulmag":15,"fosfo":52,"starkop":5},"5":{"obug1":2,"obug2":2,"breakthru":0.55,"avaunt":0.3,"sferroso":5,"szinc":5,"sulmag":15,"fosfo":52},"6":{"obug1":2,"obug2":2,"breakthru":0.55,"incipio":0.2,"toretto":0.08,"sulmag":15,"fosfo":52,"nca":20,"nk":30,"starkop":2},"7":{"proclaim":0.2,"movento":0.3,"breakthru":0.25,"sulmag":15,"fosfo":52,"nca":20,"nk":30,"starkop":2},"8":{"avaunt":0.25,"toretto":0.08,"breakthru":0.25,"sferroso":5,"szinc":5,"sulmag":15,"fosfo":52,"nca":20,"nk":30},"9":{"exalt":0.25,"inexa":0.35,"movento":0.3,"fosfo":52,"nca":20,"nk":30,"starkop":2},"10":{"tracer":0.07,"breakthru":0.25,"nca":20,"nk":30,"starkop":2},"11":{"exalt":0.25,"breakthru":0.25,"starkop":2},"12":{},"-2":{"goal":1,"dualgold":1,"cintilla":2,"silifosca":300},"-1":{}}}'::jsonb),
('recetas', 'coliflor', '{"dosis":{}}'::jsonb),
('sistema', 'semana', '{"semana":44}'::jsonb)
on conflict do nothing;