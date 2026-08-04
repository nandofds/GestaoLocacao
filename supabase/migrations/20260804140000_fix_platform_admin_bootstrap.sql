-- Garante que a primeira conta da instalação receba o papel de administrador
-- da plataforma, inclusive quando ela for criada depois das migrations.
insert into public.platform_admins (user_id)
select id
from public.profiles
where not exists (select 1 from public.platform_admins)
order by created_at, id
limit 1
on conflict do nothing;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_org_id uuid;
  org_name text;
begin
  org_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'organization_name'), ''),
    'Minha empresa'
  );

  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    'owner'
  );

  insert into public.organizations (name, slug)
  values (
    org_name,
    lower(regexp_replace(org_name, '[^a-zA-Z0-9]+', '-', 'g'))
      || '-' || substr(new.id::text, 1, 8)
  )
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  update public.profiles
  set active_organization_id = new_org_id
  where id = new.id;

  -- Serializa cadastros simultâneos para que apenas a primeira conta receba
  -- automaticamente o acesso geral. Outros administradores são concedidos
  -- explicitamente depois.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('lume-platform-admin-bootstrap', 0)
  );

  insert into public.platform_admins (user_id)
  select new.id
  where not exists (select 1 from public.platform_admins)
  on conflict do nothing;

  return new;
end;
$$;
