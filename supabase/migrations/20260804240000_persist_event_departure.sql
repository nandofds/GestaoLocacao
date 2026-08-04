alter table public.movements add column receiver_name text;
alter table public.movements add column created_by uuid default auth.uid() references auth.users(id);
alter table public.movements add constraint movements_delivered_by_collaborator_fk
  foreign key (organization_id, delivered_by) references public.collaborators (organization_id, id);

create unique index movements_one_departure_per_event_key
  on public.movements (event_id)
  where movement_type = 'SAIDA';

create or replace function public.finalize_event_departure(
  target_event_id uuid,
  responsible_collaborator_id uuid,
  target_receiver_name text,
  target_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_event public.events;
  expected_items integer;
  checked_items integer;
  created_movement_id uuid;
begin
  select * into target_event from public.events
  where id = target_event_id and status not in ('CANCELADO', 'CONCLUIDO');
  if target_event.id is null then raise exception 'Evento não encontrado ou indisponível para saída.' using errcode = 'P0001'; end if;
  if nullif(trim(target_receiver_name), '') is null then raise exception 'Informe quem recebeu os equipamentos.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.collaborators c where c.id = responsible_collaborator_id and c.organization_id = target_event.organization_id and c.active) then raise exception 'Selecione um colaborador ativo da empresa do evento.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.movements m where m.event_id = target_event_id and m.movement_type = 'SAIDA') then raise exception 'A saída deste evento já foi registrada.' using errcode = 'P0001'; end if;

  select count(*) into expected_items from public.event_items ei where ei.event_id = target_event_id and ei.item_id is not null and ei.active;
  select count(*) into checked_items from public.separation_checks sc join public.event_items ei on ei.id = sc.event_item_id where sc.event_id = target_event_id and ei.active;
  if expected_items = 0 then raise exception 'O evento não possui equipamentos reservados.' using errcode = 'P0001'; end if;
  if checked_items <> expected_items then raise exception 'A separação precisa estar completa antes da saída.' using errcode = 'P0001'; end if;

  insert into public.movements (organization_id, event_id, movement_type, delivered_by, receiver_name, notes, confirmation, created_by)
  values (target_event.organization_id, target_event.id, 'SAIDA', responsible_collaborator_id, upper(trim(target_receiver_name)), nullif(upper(trim(target_notes)), ''), 'SAÍDA CONFIRMADA', auth.uid())
  returning id into created_movement_id;

  insert into public.movement_items (organization_id, movement_id, item_id, condition)
  select target_event.organization_id, created_movement_id, sc.item_id, i.condition
  from public.separation_checks sc join public.items i on i.id = sc.item_id
  where sc.event_id = target_event_id;
  return created_movement_id;
end $$;

revoke all on function public.finalize_event_departure(uuid, uuid, text, text) from public;
grant execute on function public.finalize_event_departure(uuid, uuid, text, text) to authenticated;
