-- O administrador da plataforma pode alternar para qualquer empresa, mas os
-- dados operacionais continuam sempre limitados à empresa ativa.
create or replace function public.has_management_role()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.organization_members om
    where om.organization_id = public.current_organization_id()
      and om.user_id = (select auth.uid())
      and om.role in ('owner', 'manager')
  )
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.organization_members om
    where om.organization_id = public.current_organization_id()
      and om.user_id = (select auth.uid())
      and om.role = 'owner'
  )
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'clients', 'categories', 'items', 'supplies', 'events', 'event_items',
    'movements', 'movement_items', 'maintenance'
  ] loop
    execute format(
      'drop policy if exists "platform admin full access" on public.%I',
      table_name
    );
  end loop;
end $$;
