create table public.return_collection_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  event_id uuid not null references public.events(id) on delete cascade,
  item_id uuid not null references public.items(id),
  apparent_damage boolean not null default false,
  damage_notes text,
  checked_by uuid not null default auth.uid() references auth.users(id),
  checked_at timestamptz not null default now(),
  unique (event_id,item_id),
  check (not apparent_damage or nullif(trim(damage_notes),'') is not null)
);
create index return_collection_checks_org_event_idx on public.return_collection_checks (organization_id,event_id);
alter table public.return_collection_checks enable row level security;
create policy "tenant read" on public.return_collection_checks for select to authenticated using (organization_id = (select public.current_organization_id()));
create policy "tenant operator insert" on public.return_collection_checks for insert to authenticated with check (organization_id = (select public.current_organization_id()));
create policy "tenant operator delete" on public.return_collection_checks for delete to authenticated using (organization_id = (select public.current_organization_id()));
create policy "platform admin full access" on public.return_collection_checks for all to authenticated using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));
create unique index movements_one_return_collection_per_event_key on public.movements(event_id) where movement_type = 'COLETA_RETORNO';

create or replace function public.scan_return_collection_item(target_event_id uuid,scanned_code text,target_damage boolean default false,target_notes text default null)
returns public.return_collection_checks language plpgsql security definer set search_path='' as $$
declare target_item public.items; created_check public.return_collection_checks;
begin
  if exists(select 1 from public.movements where event_id=target_event_id and movement_type='COLETA_RETORNO') then raise exception 'A carga de retorno já foi fechada.' using errcode='P0001'; end if;
  select i.* into target_item from public.items i join public.movement_items mi on mi.item_id=i.id join public.movements m on m.id=mi.movement_id and m.organization_id=i.organization_id
  where m.event_id=target_event_id and m.movement_type='SAIDA' and upper(trim(scanned_code)) in (upper(i.qr_value),upper(i.internal_code))
  and (public.is_platform_admin() or exists(select 1 from public.organization_members om where om.organization_id=i.organization_id and om.user_id=auth.uid())) limit 1;
  if target_item.id is null then raise exception 'Item não pertence à saída deste evento.' using errcode='P0001'; end if;
  if target_damage and nullif(trim(target_notes),'') is null then raise exception 'Descreva o dano aparente.' using errcode='P0001'; end if;
  insert into public.return_collection_checks(organization_id,event_id,item_id,apparent_damage,damage_notes) values(target_item.organization_id,target_event_id,target_item.id,target_damage,nullif(upper(trim(target_notes)),''))
  on conflict(event_id,item_id) do update set apparent_damage=excluded.apparent_damage,damage_notes=excluded.damage_notes,checked_by=auth.uid(),checked_at=now() returning * into created_check;
  return created_check;
end $$;

create or replace function public.finalize_return_collection(target_event_id uuid,responsible_collaborator_id uuid,target_notes text default null,allow_incomplete boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare target_event public.events; expected integer; checked integer; created_id uuid;
begin
  select * into target_event from public.events where id=target_event_id;
  if target_event.id is null then raise exception 'Evento não encontrado.' using errcode='P0001'; end if;
  if not public.is_platform_admin() and not exists(select 1 from public.organization_members where organization_id=target_event.organization_id and user_id=auth.uid()) then raise exception 'Usuário sem permissão.' using errcode='P0001'; end if;
  if exists(select 1 from public.movements where event_id=target_event_id and movement_type='COLETA_RETORNO') then raise exception 'A carga de retorno já foi fechada.' using errcode='P0001'; end if;
  if not exists(select 1 from public.collaborators where id=responsible_collaborator_id and organization_id=target_event.organization_id and active) then raise exception 'Selecione um colaborador ativo.' using errcode='P0001'; end if;
  select count(*) into expected from public.movement_items mi join public.movements m on m.id=mi.movement_id where m.event_id=target_event_id and m.movement_type='SAIDA';
  select count(*) into checked from public.return_collection_checks where event_id=target_event_id;
  if expected<>checked and (not allow_incomplete or nullif(trim(target_notes),'') is null) then raise exception 'Carga incompleta exige justificativa.' using errcode='P0001'; end if;
  insert into public.movements(organization_id,event_id,movement_type,delivered_by,notes,confirmation,created_by) values(target_event.organization_id,target_event_id,'COLETA_RETORNO',responsible_collaborator_id,nullif(upper(trim(target_notes)),''),case when expected=checked then 'CARGA COMPLETA' else 'CARGA INCOMPLETA JUSTIFICADA' end,auth.uid()) returning id into created_id;
  insert into public.movement_items(organization_id,movement_id,item_id,condition) select c.organization_id,created_id,c.item_id,case when c.apparent_damage then 'DANIFICADO'::public.item_condition else i.condition end from public.return_collection_checks c join public.items i on i.id=c.item_id where c.event_id=target_event_id;
  return created_id;
end $$;

revoke all on function public.scan_return_collection_item(uuid,text,boolean,text) from public;
revoke all on function public.finalize_return_collection(uuid,uuid,text,boolean) from public;
grant execute on function public.scan_return_collection_item(uuid,text,boolean,text) to authenticated;
grant execute on function public.finalize_return_collection(uuid,uuid,text,boolean) to authenticated;

create or replace function public.scan_return_item(target_event_id uuid,scanned_code text,returned_condition public.item_condition,target_defect text default null)
returns public.return_checks language plpgsql security definer set search_path='' as $$
declare target_item public.items; created_check public.return_checks;
begin
  if not exists(select 1 from public.movements where event_id=target_event_id and movement_type='COLETA_RETORNO') then raise exception 'Feche a coleta no evento antes do recebimento no galpão.' using errcode='P0001'; end if;
  select i.* into target_item from public.items i join public.movement_items mi on mi.item_id=i.id join public.movements m on m.id=mi.movement_id and m.organization_id=i.organization_id where m.event_id=target_event_id and m.movement_type='COLETA_RETORNO' and upper(trim(scanned_code)) in (upper(i.qr_value),upper(i.internal_code)) limit 1;
  if target_item.id is null then raise exception 'Item não consta na carga fechada no evento.' using errcode='P0001'; end if;
  if returned_condition='DANIFICADO' and nullif(trim(target_defect),'') is null then raise exception 'Descreva o defeito.' using errcode='P0001'; end if;
  insert into public.return_checks(organization_id,event_id,item_id,condition,defect_description) values(target_item.organization_id,target_event_id,target_item.id,returned_condition,nullif(upper(trim(target_defect)),'')) on conflict(event_id,item_id) do nothing returning * into created_check;
  if created_check.id is null then raise exception 'Este equipamento já foi conferido no retorno.' using errcode='P0001'; end if; return created_check;
end $$;

create or replace function public.finalize_event_return(target_event_id uuid,responsible_collaborator_id uuid,target_notes text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare target_event public.events; expected integer; checked integer; created_id uuid;
begin
  select * into target_event from public.events where id=target_event_id;
  if target_event.id is null then raise exception 'Evento não encontrado.' using errcode='P0001'; end if;
  if not public.is_platform_admin() and not exists(select 1 from public.organization_members where organization_id=target_event.organization_id and user_id=auth.uid()) then raise exception 'Usuário sem permissão.' using errcode='P0001'; end if;
  if not exists(select 1 from public.movements where event_id=target_event_id and movement_type='COLETA_RETORNO') then raise exception 'Feche a coleta no evento antes do recebimento.' using errcode='P0001'; end if;
  if exists(select 1 from public.movements where event_id=target_event_id and movement_type='RETORNO') then raise exception 'O retorno já foi finalizado.' using errcode='P0001'; end if;
  if not exists(select 1 from public.collaborators where id=responsible_collaborator_id and organization_id=target_event.organization_id and active) then raise exception 'Selecione um colaborador ativo.' using errcode='P0001'; end if;
  select count(*) into expected from public.movement_items mi join public.movements m on m.id=mi.movement_id where m.event_id=target_event_id and m.movement_type='COLETA_RETORNO';
  select count(*) into checked from public.return_checks where event_id=target_event_id;
  if expected=0 or expected<>checked then raise exception 'Confira todos os itens da carga antes de finalizar.' using errcode='P0001'; end if;
  insert into public.movements(organization_id,event_id,movement_type,received_by,notes,confirmation,created_by) values(target_event.organization_id,target_event_id,'RETORNO',responsible_collaborator_id,nullif(upper(trim(target_notes)),''),'RETORNO AO GALPÃO CONFIRMADO',auth.uid()) returning id into created_id;
  insert into public.movement_items(organization_id,movement_id,item_id,condition) select organization_id,created_id,item_id,condition from public.return_checks where event_id=target_event_id;
  update public.items i set condition=r.condition from public.return_checks r where r.event_id=target_event_id and r.item_id=i.id;
  insert into public.maintenance(organization_id,item_id,origin_event_id,defect_description,urgency) select organization_id,item_id,event_id,defect_description,'NORMAL' from public.return_checks where event_id=target_event_id and condition='DANIFICADO';
  return created_id;
end $$;
