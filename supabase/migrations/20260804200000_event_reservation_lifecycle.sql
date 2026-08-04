alter table public.event_items add column active boolean not null default true;

alter table public.event_items drop constraint no_item_booking_overlap;
alter table public.event_items add constraint no_item_booking_overlap
  exclude using gist (
    item_id with =,
    public.booking_window(planned_departure_at, planned_return_at, logistics_buffer) with &&
  ) where (item_id is not null and active);

create unique index event_items_event_item_key
  on public.event_items (event_id, item_id)
  where item_id is not null;

create or replace function public.sync_event_reservations_active()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  update public.event_items
  set active = new.status not in ('CANCELADO', 'CONCLUIDO')
  where event_id = new.id;
  return new;
end $$;

create trigger sync_event_reservations_after_status
  after update of status on public.events
  for each row when (old.status is distinct from new.status)
  execute function public.sync_event_reservations_active();

create index event_items_active_window_idx
  on public.event_items (organization_id, item_id, planned_departure_at, planned_return_at)
  where active and item_id is not null;
