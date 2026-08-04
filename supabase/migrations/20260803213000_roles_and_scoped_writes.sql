create type public.app_role as enum ('owner', 'manager', 'operator');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role public.app_role not null default 'operator',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.has_management_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner', 'manager')
  )
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  )
$$;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    case when not exists (select 1 from public.profiles) then 'owner'::public.app_role else 'operator'::public.app_role end
  );
  return new;
end;
$$;

create trigger create_profile_after_signup
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

insert into public.profiles (id, display_name, role)
select id, coalesce(raw_user_meta_data ->> 'display_name', split_part(email, '@', 1)),
  case when row_number() over (order by created_at, id) = 1 then 'owner'::public.app_role else 'operator'::public.app_role end
from auth.users
on conflict (id) do nothing;

create policy "users read own profile" on public.profiles
  for select to authenticated using (id = auth.uid() or public.has_management_role());
create policy "owners manage profiles" on public.profiles
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

create policy "management writes clients" on public.clients
  for all to authenticated using (public.has_management_role()) with check (public.has_management_role());
create policy "management writes categories" on public.categories
  for all to authenticated using (public.has_management_role()) with check (public.has_management_role());
create policy "management writes items" on public.items
  for all to authenticated using (public.has_management_role()) with check (public.has_management_role());
create policy "management writes supplies" on public.supplies
  for all to authenticated using (public.has_management_role()) with check (public.has_management_role());
create policy "management writes events" on public.events
  for all to authenticated using (public.has_management_role()) with check (public.has_management_role());
create policy "management writes reservations" on public.event_items
  for all to authenticated using (public.has_management_role()) with check (public.has_management_role());

create policy "operators create movements" on public.movements
  for insert to authenticated with check (true);
create policy "operators update movements" on public.movements
  for update to authenticated using (true) with check (true);
create policy "operators record movement items" on public.movement_items
  for insert to authenticated with check (true);
create policy "operators update movement items" on public.movement_items
  for update to authenticated using (true) with check (true);
create policy "operators create maintenance" on public.maintenance
  for insert to authenticated with check (true);
create policy "operators update maintenance" on public.maintenance
  for update to authenticated using (true) with check (true);

create policy "management deletes movements" on public.movements
  for delete to authenticated using (public.has_management_role());
create policy "management deletes movement items" on public.movement_items
  for delete to authenticated using (public.has_management_role());
create policy "management deletes maintenance" on public.maintenance
  for delete to authenticated using (public.has_management_role());
