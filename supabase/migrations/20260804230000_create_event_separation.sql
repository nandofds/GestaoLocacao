create table public.separation_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  event_id uuid not null references public.events(id) on delete cascade,
  event_item_id uuid not null unique references public.event_items(id) on delete cascade,
  item_id uuid not null references public.items(id),
  checked_by uuid not null default auth.uid() references auth.users(id),
  checked_at timestamptz not null default now()
);

create index separation_checks_organization_event_idx on public.separation_checks (organization_id, event_id);
create index separation_checks_item_id_idx on public.separation_checks (item_id);
alter table public.separation_checks enable row level security;

create policy "tenant read" on public.separation_checks for select to authenticated
  using (organization_id = (select public.current_organization_id()));
create policy "tenant operator insert" on public.separation_checks for insert to authenticated
  with check (organization_id = (select public.current_organization_id()));
create policy "tenant operator delete" on public.separation_checks for delete to authenticated
  using (organization_id = (select public.current_organization_id()));
create policy "platform admin full access" on public.separation_checks for all to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));

create or replace function public.scan_separation_item(target_event_id uuid, scanned_code text)
returns public.separation_checks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_reservation public.event_items;
  created_check public.separation_checks;
begin
  select ei.* into target_reservation
  from public.event_items ei
  join public.items i on i.id = ei.item_id and i.organization_id = ei.organization_id
  join public.events e on e.id = ei.event_id and e.organization_id = ei.organization_id
  where ei.event_id = target_event_id
    and ei.item_id is not null
    and ei.active
    and e.status not in ('CANCELADO', 'CONCLUIDO')
    and upper(trim(scanned_code)) in (upper(i.qr_value), upper(i.internal_code))
  limit 1;

  if target_reservation.id is null then
    raise exception 'Equipamento não encontrado ou não reservado para este evento.' using errcode = 'P0001';
  end if;

  insert into public.separation_checks (organization_id, event_id, event_item_id, item_id)
  values (target_reservation.organization_id, target_reservation.event_id, target_reservation.id, target_reservation.item_id)
  on conflict (event_item_id) do nothing
  returning * into created_check;

  if created_check.id is null then
    raise exception 'Este equipamento já foi conferido na separação.' using errcode = 'P0001';
  end if;
  return created_check;
end $$;

revoke all on function public.scan_separation_item(uuid, text) from public;
grant execute on function public.scan_separation_item(uuid, text) to authenticated;
