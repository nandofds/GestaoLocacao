create or replace function public.prevent_separation_change_after_departure()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare target_event_id uuid;
begin
  target_event_id := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
  if exists (
    select 1 from public.movements m
    where m.event_id = target_event_id
      and m.movement_type = 'SAIDA'
  ) then
    raise exception 'A separação não pode ser alterada após a saída.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger lock_separation_after_departure
  before insert or update or delete on public.separation_checks
  for each row execute function public.prevent_separation_change_after_departure();
