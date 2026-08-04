create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;

-- O usuário mais antigo da instalação torna-se o administrador inicial.
insert into public.platform_admins (user_id)
select id from public.profiles order by created_at, id limit 1
on conflict do nothing;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()))
$$;

create policy "platform admins read own grant" on public.platform_admins
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.current_organization_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.active_organization_id from public.profiles p
  where p.id = (select auth.uid()) and (
    public.is_platform_admin() or exists (
      select 1 from public.organization_members om
      where om.organization_id = p.active_organization_id and om.user_id = p.id
    )
  )
$$;

create or replace function public.switch_organization(target_organization_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() and not exists (
    select 1 from public.organization_members
    where organization_id = target_organization_id and user_id = (select auth.uid())
  ) then raise exception 'Usuário não pertence a esta empresa'; end if;
  if not exists (select 1 from public.organizations where id = target_organization_id) then
    raise exception 'Empresa não encontrada';
  end if;
  update public.profiles set active_organization_id = target_organization_id
  where id = (select auth.uid());
end $$;

create or replace function public.create_organization(organization_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Apenas o administrador geral pode criar empresas';
  end if;
  if nullif(trim(organization_name), '') is null then raise exception 'Informe o nome da empresa'; end if;
  insert into public.organizations (name, slug)
  values (trim(organization_name), lower(regexp_replace(trim(organization_name), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 8))
  returning id into new_id;
  return new_id;
end $$;

create policy "platform admin manages organizations" on public.organizations for all to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));
create policy "platform admin manages memberships" on public.organization_members for all to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));
create policy "platform admin reads profiles" on public.profiles for select to authenticated
  using ((select public.is_platform_admin()));

do $$
declare table_name text;
begin
  foreach table_name in array array['clients','categories','items','supplies','events','event_items','movements','movement_items','maintenance'] loop
    execute format('create policy "platform admin full access" on public.%I for all to authenticated using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()))', table_name);
  end loop;
end $$;

revoke all on function public.create_organization(text) from public;
grant execute on function public.create_organization(text) to authenticated;

