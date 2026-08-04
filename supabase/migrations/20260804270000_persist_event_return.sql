create table public.return_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  event_id uuid not null references public.events(id) on delete cascade,
  item_id uuid not null references public.items(id),
  condition public.item_condition not null,
  defect_description text,
  checked_by uuid not null default auth.uid() references auth.users(id),
  checked_at timestamptz not null default now(),
  unique (event_id, item_id),
  check (condition <> 'DANIFICADO' or nullif(trim(defect_description), '') is not null)
);
create index return_checks_organization_event_idx on public.return_checks (organization_id, event_id);
alter table public.return_checks enable row level security;
create policy "tenant read" on public.return_checks for select to authenticated using (organization_id = (select public.current_organization_id()));
create policy "tenant operator insert" on public.return_checks for insert to authenticated with check (organization_id = (select public.current_organization_id()));
create policy "tenant operator delete" on public.return_checks for delete to authenticated using (organization_id = (select public.current_organization_id()));
create policy "platform admin full access" on public.return_checks for all to authenticated using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));

alter table public.movements add constraint movements_received_by_collaborator_fk
  foreign key (organization_id, received_by) references public.collaborators (organization_id, id);
create unique index movements_one_return_per_event_key on public.movements (event_id) where movement_type = 'RETORNO';

create or replace function public.scan_return_item(target_event_id uuid, scanned_code text, returned_condition public.item_condition, target_defect text default null)
returns public.return_checks language plpgsql security definer set search_path = '' as $$
declare target_item public.items; target_organization_id uuid; created_check public.return_checks;
begin
  select organization_id into target_organization_id from public.events where id = target_event_id;
  if target_organization_id is null or (not public.is_platform_admin() and not exists (select 1 from public.organization_members where organization_id = target_organization_id and user_id = auth.uid())) then raise exception 'Evento não encontrado ou sem permissão.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.movements where event_id = target_event_id and movement_type = 'RETORNO') then raise exception 'O retorno deste evento já foi finalizado.' using errcode = 'P0001'; end if;
  select i.* into target_item from public.items i
  join public.movement_items mi on mi.item_id = i.id
  join public.movements m on m.id = mi.movement_id and m.organization_id = i.organization_id
  where m.event_id = target_event_id and m.movement_type = 'SAIDA'
    and upper(trim(scanned_code)) in (upper(i.qr_value), upper(i.internal_code)) limit 1;
  if target_item.id is null then raise exception 'Equipamento não encontrado entre os itens que saíram para este evento.' using errcode = 'P0001'; end if;
  if returned_condition = 'DANIFICADO' and nullif(trim(target_defect), '') is null then raise exception 'Descreva o defeito do equipamento danificado.' using errcode = 'P0001'; end if;
  insert into public.return_checks (organization_id, event_id, item_id, condition, defect_description)
  values (target_item.organization_id, target_event_id, target_item.id, returned_condition, nullif(upper(trim(target_defect)), ''))
  on conflict (event_id, item_id) do nothing returning * into created_check;
  if created_check.id is null then raise exception 'Este equipamento já foi conferido no retorno.' using errcode = 'P0001'; end if;
  return created_check;
end $$;

create or replace function public.finalize_event_return(target_event_id uuid, responsible_collaborator_id uuid, target_notes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target_event public.events; expected_items integer; checked_items integer; created_movement_id uuid;
begin
  select * into target_event from public.events where id = target_event_id;
  if target_event.id is null then raise exception 'Evento não encontrado.' using errcode = 'P0001'; end if;
  if not public.is_platform_admin() and not exists (select 1 from public.organization_members where organization_id = target_event.organization_id and user_id = auth.uid()) then raise exception 'Usuário sem permissão para este evento.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.movements where event_id = target_event_id and movement_type = 'SAIDA') then raise exception 'Este evento não possui saída registrada.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.movements where event_id = target_event_id and movement_type = 'RETORNO') then raise exception 'O retorno deste evento já foi finalizado.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.collaborators c where c.id = responsible_collaborator_id and c.organization_id = target_event.organization_id and c.active) then raise exception 'Selecione um colaborador ativo da empresa do evento.' using errcode = 'P0001'; end if;
  select count(*) into expected_items from public.movement_items mi join public.movements m on m.id = mi.movement_id where m.event_id = target_event_id and m.movement_type = 'SAIDA';
  select count(*) into checked_items from public.return_checks where event_id = target_event_id;
  if expected_items = 0 or expected_items <> checked_items then raise exception 'Confira todos os itens antes de finalizar o retorno.' using errcode = 'P0001'; end if;
  insert into public.movements (organization_id,event_id,movement_type,received_by,notes,confirmation,created_by)
  values (target_event.organization_id,target_event_id,'RETORNO',responsible_collaborator_id,nullif(upper(trim(target_notes)),''),'RETORNO AO GALPÃO CONFIRMADO',auth.uid()) returning id into created_movement_id;
  insert into public.movement_items (organization_id,movement_id,item_id,condition)
  select organization_id,created_movement_id,item_id,condition from public.return_checks where event_id = target_event_id;
  update public.items i set condition = rc.condition from public.return_checks rc where rc.event_id = target_event_id and rc.item_id = i.id;
  insert into public.maintenance (organization_id,item_id,origin_event_id,defect_description,urgency)
  select organization_id,item_id,event_id,defect_description,'NORMAL' from public.return_checks where event_id = target_event_id and condition = 'DANIFICADO';
  return created_movement_id;
end $$;

create or replace function public.prevent_return_check_change_after_finalization()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare target_event_id uuid;
begin
  target_event_id := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
  if exists (select 1 from public.movements where event_id = target_event_id and movement_type = 'RETORNO') then raise exception 'A conferência não pode ser alterada após finalizar o retorno.' using errcode = 'P0001'; end if;
  if tg_op = 'DELETE' then return old; end if; return new;
end $$;
create trigger lock_return_checks_after_finalization before insert or update or delete on public.return_checks for each row execute function public.prevent_return_check_change_after_finalization();

revoke all on function public.scan_return_item(uuid,text,public.item_condition,text) from public;
revoke all on function public.finalize_event_return(uuid,uuid,text) from public;
grant execute on function public.scan_return_item(uuid,text,public.item_condition,text) to authenticated;
grant execute on function public.finalize_event_return(uuid,uuid,text) to authenticated;
