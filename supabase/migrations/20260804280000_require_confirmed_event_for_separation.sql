create or replace function public.require_confirmed_event_for_separation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.events e
    where e.id = new.event_id
      and e.organization_id = new.organization_id
      and e.status in ('CONFIRMADO', 'EM_ANDAMENTO')
  ) then
    raise exception 'A separação só pode começar após a confirmação do evento.' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger require_confirmed_event_before_separation
  before insert on public.separation_checks
  for each row execute function public.require_confirmed_event_for_separation();
