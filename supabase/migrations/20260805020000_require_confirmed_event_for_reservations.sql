create or replace function public.require_confirmed_event_for_reservation()
returns trigger language plpgsql security invoker set search_path='' as $$
declare target_status text;
begin
  select status into target_status from public.events where id=new.event_id and organization_id=new.organization_id;
  if new.active and target_status not in ('CONFIRMADO','EM_ANDAMENTO') then raise exception 'Confirme o evento antes de selecionar equipamentos.' using errcode='P0001'; end if;
  return new;
end $$;
create trigger require_confirmed_event_before_reservation before insert or update of active,event_id on public.event_items for each row execute function public.require_confirmed_event_for_reservation();
create or replace function public.sync_event_reservations_active()
returns trigger language plpgsql security invoker set search_path='' as $$
begin update public.event_items set active=new.status in ('CONFIRMADO','EM_ANDAMENTO') where event_id=new.id;return new;end $$;
