-- Multi-tenancy por empresa ativa. "clients" são os clientes finais da empresa.
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'operator',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

alter table public.profiles add column active_organization_id uuid references public.organizations(id);
create index organization_members_user_id_idx on public.organization_members (user_id, organization_id);
create index profiles_active_organization_id_idx on public.profiles (active_organization_id);

create or replace function public.current_organization_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.active_organization_id from public.profiles p
  where p.id = (select auth.uid()) and exists (
    select 1 from public.organization_members om
    where om.organization_id = p.active_organization_id and om.user_id = p.id
  )
$$;

alter table public.clients add column organization_id uuid references public.organizations(id);
alter table public.categories add column organization_id uuid references public.organizations(id);
alter table public.items add column organization_id uuid references public.organizations(id);
alter table public.supplies add column organization_id uuid references public.organizations(id);
alter table public.events add column organization_id uuid references public.organizations(id);
alter table public.event_items add column organization_id uuid references public.organizations(id);
alter table public.movements add column organization_id uuid references public.organizations(id);
alter table public.movement_items add column organization_id uuid references public.organizations(id);
alter table public.maintenance add column organization_id uuid references public.organizations(id);

-- Migra todos os dados e usuários atuais para uma empresa inicial.
do $$
declare legacy_id uuid;
begin
  insert into public.organizations (name, slug)
  values ('Empresa principal', 'empresa-principal-' || substr(gen_random_uuid()::text, 1, 8))
  returning id into legacy_id;
  insert into public.organization_members (organization_id, user_id, role)
    select legacy_id, id, role from public.profiles on conflict do nothing;
  update public.profiles set active_organization_id = legacy_id where active_organization_id is null;
  update public.clients set organization_id = legacy_id where organization_id is null;
  update public.categories set organization_id = legacy_id where organization_id is null;
  update public.items set organization_id = legacy_id where organization_id is null;
  update public.supplies set organization_id = legacy_id where organization_id is null;
  update public.events set organization_id = legacy_id where organization_id is null;
  update public.event_items set organization_id = legacy_id where organization_id is null;
  update public.movements set organization_id = legacy_id where organization_id is null;
  update public.movement_items set organization_id = legacy_id where organization_id is null;
  update public.maintenance set organization_id = legacy_id where organization_id is null;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array['clients','categories','items','supplies','events','event_items','movements','movement_items','maintenance'] loop
    execute format('alter table public.%I alter column organization_id set not null', table_name);
    execute format('alter table public.%I alter column organization_id set default public.current_organization_id()', table_name);
    execute format('create index %I on public.%I (organization_id)', table_name || '_organization_id_idx', table_name);
  end loop;
end $$;

alter table public.categories drop constraint categories_name_key;
alter table public.items drop constraint items_internal_code_key;
alter table public.items drop constraint items_qr_value_key;
alter table public.categories add constraint categories_organization_name_key unique (organization_id, name);
alter table public.items add constraint items_organization_internal_code_key unique (organization_id, internal_code);
alter table public.items add constraint items_organization_qr_value_key unique (organization_id, qr_value);

-- Garante também no banco que relações nunca cruzem empresas.
alter table public.clients add constraint clients_organization_id_id_key unique (organization_id, id);
alter table public.categories add constraint categories_organization_id_id_key unique (organization_id, id);
alter table public.items add constraint items_organization_id_id_key unique (organization_id, id);
alter table public.supplies add constraint supplies_organization_id_id_key unique (organization_id, id);
alter table public.events add constraint events_organization_id_id_key unique (organization_id, id);
alter table public.movements add constraint movements_organization_id_id_key unique (organization_id, id);
alter table public.items add constraint items_tenant_category_fk foreign key (organization_id, category_id) references public.categories (organization_id, id);
alter table public.supplies add constraint supplies_tenant_category_fk foreign key (organization_id, category_id) references public.categories (organization_id, id);
alter table public.events add constraint events_tenant_client_fk foreign key (organization_id, client_id) references public.clients (organization_id, id);
alter table public.event_items add constraint event_items_tenant_event_fk foreign key (organization_id, event_id) references public.events (organization_id, id);
alter table public.event_items add constraint event_items_tenant_item_fk foreign key (organization_id, item_id) references public.items (organization_id, id);
alter table public.event_items add constraint event_items_tenant_supply_fk foreign key (organization_id, supply_id) references public.supplies (organization_id, id);
alter table public.movements add constraint movements_tenant_event_fk foreign key (organization_id, event_id) references public.events (organization_id, id);
alter table public.movement_items add constraint movement_items_tenant_movement_fk foreign key (organization_id, movement_id) references public.movements (organization_id, id);
alter table public.movement_items add constraint movement_items_tenant_item_fk foreign key (organization_id, item_id) references public.items (organization_id, id);
alter table public.maintenance add constraint maintenance_tenant_item_fk foreign key (organization_id, item_id) references public.items (organization_id, id);
alter table public.maintenance add constraint maintenance_tenant_event_fk foreign key (organization_id, origin_event_id) references public.events (organization_id, id);

-- Índices das FKs mais usadas (Postgres não os cria automaticamente).
create index events_client_id_idx on public.events (client_id);
create index event_items_event_id_idx on public.event_items (event_id);
create index event_items_item_id_idx on public.event_items (item_id) where item_id is not null;
create index event_items_supply_id_idx on public.event_items (supply_id) where supply_id is not null;
create index movements_event_id_idx on public.movements (event_id);
create index movement_items_item_id_idx on public.movement_items (item_id);
create index maintenance_item_id_idx on public.maintenance (item_id);

create or replace function public.has_management_role()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_members om
    where om.organization_id = public.current_organization_id()
      and om.user_id = (select auth.uid()) and om.role in ('owner', 'manager'))
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_members om
    where om.organization_id = public.current_organization_id()
      and om.user_id = (select auth.uid()) and om.role = 'owner')
$$;

create or replace function public.switch_organization(target_organization_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.organization_members
    where organization_id = target_organization_id and user_id = (select auth.uid())) then
    raise exception 'Usuário não pertence a esta empresa';
  end if;
  update public.profiles set active_organization_id = target_organization_id
  where id = (select auth.uid());
end $$;

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare new_org_id uuid; org_name text;
begin
  org_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'organization_name'), ''), 'Minha empresa');
  insert into public.profiles (id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)), 'owner');
  insert into public.organizations (name, slug)
  values (org_name, lower(regexp_replace(org_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(new.id::text, 1, 8))
  returning id into new_org_id;
  insert into public.organization_members values (new_org_id, new.id, 'owner', now());
  update public.profiles set active_organization_id = new_org_id where id = new.id;
  return new;
end $$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

-- Remove as políticas antigas, que permitiam acesso global a qualquer autenticado.
do $$
declare policy_row record;
begin
  for policy_row in select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in
      ('clients','categories','items','supplies','events','event_items','movements','movement_items','maintenance','profiles')
  loop
    execute format('drop policy %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end $$;

create policy "members read active organization" on public.organizations for select to authenticated
  using (id = (select public.current_organization_id()));
create policy "owners update active organization" on public.organizations for update to authenticated
  using (id = (select public.current_organization_id()) and (select public.is_owner()))
  with check (id = (select public.current_organization_id()) and (select public.is_owner()));
create policy "members read active memberships" on public.organization_members for select to authenticated
  using (organization_id = (select public.current_organization_id()));
create policy "owners manage active memberships" on public.organization_members for all to authenticated
  using (organization_id = (select public.current_organization_id()) and (select public.is_owner()))
  with check (organization_id = (select public.current_organization_id()) and (select public.is_owner()));
create policy "members read active profiles" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or exists (select 1 from public.organization_members om
    where om.organization_id = (select public.current_organization_id()) and om.user_id = profiles.id));

-- SELECT e escrita administrativa, sempre limitados à empresa ativa.
do $$
declare table_name text;
begin
  foreach table_name in array array['clients','categories','items','supplies','events','event_items'] loop
    execute format('create policy "tenant read" on public.%I for select to authenticated using (organization_id = (select public.current_organization_id()))', table_name);
    execute format('create policy "tenant management write" on public.%I for all to authenticated using (organization_id = (select public.current_organization_id()) and (select public.has_management_role())) with check (organization_id = (select public.current_organization_id()) and (select public.has_management_role()))', table_name);
  end loop;
  foreach table_name in array array['movements','movement_items','maintenance'] loop
    execute format('create policy "tenant read" on public.%I for select to authenticated using (organization_id = (select public.current_organization_id()))', table_name);
    execute format('create policy "tenant operator insert" on public.%I for insert to authenticated with check (organization_id = (select public.current_organization_id()))', table_name);
    execute format('create policy "tenant operator update" on public.%I for update to authenticated using (organization_id = (select public.current_organization_id())) with check (organization_id = (select public.current_organization_id()))', table_name);
    execute format('create policy "tenant management delete" on public.%I for delete to authenticated using (organization_id = (select public.current_organization_id()) and (select public.has_management_role()))', table_name);
  end loop;
end $$;

revoke all on function public.switch_organization(uuid) from public;
grant execute on function public.switch_organization(uuid) to authenticated;
