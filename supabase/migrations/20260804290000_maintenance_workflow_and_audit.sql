alter table public.maintenance add column responsible_id uuid;
alter table public.maintenance add column total_cost numeric(12,2) not null default 0 check (total_cost >= 0);
alter table public.maintenance add column technical_notes text;
alter table public.maintenance add column updated_at timestamptz not null default now();
alter table public.maintenance add constraint maintenance_responsible_collaborator_fk
  foreign key (organization_id, responsible_id) references public.collaborators (organization_id, id);
alter table public.maintenance add constraint maintenance_urgency_check
  check (urgency in ('BAIXA','NORMAL','ALTA','CRITICA')) not valid;

create table public.maintenance_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  maintenance_id uuid not null references public.maintenance(id) on delete cascade,
  from_status public.maintenance_status,
  to_status public.maintenance_status not null,
  responsible_id uuid,
  total_cost numeric(12,2) not null default 0,
  notes text,
  changed_by uuid default auth.uid() references auth.users(id),
  changed_at timestamptz not null default now()
);
create index maintenance_history_order_idx on public.maintenance_history (maintenance_id, changed_at desc);
alter table public.maintenance_history enable row level security;
create policy "tenant read" on public.maintenance_history for select to authenticated using (organization_id = (select public.current_organization_id()));
create policy "platform admin full access" on public.maintenance_history for all to authenticated using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));

insert into public.maintenance_history (organization_id,maintenance_id,to_status,responsible_id,total_cost,notes,changed_by,changed_at)
select organization_id,id,status,responsible_id,total_cost,'ORDEM DE MANUTENÇÃO ABERTA',null,opened_at from public.maintenance;

create or replace function public.audit_maintenance_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  insert into public.maintenance_history (organization_id,maintenance_id,from_status,to_status,responsible_id,total_cost,notes,changed_by)
  values (new.organization_id,new.id,old.status,new.status,new.responsible_id,new.total_cost,new.technical_notes,auth.uid());
  return new;
end $$;
create trigger audit_maintenance_before_update before update on public.maintenance for each row execute function public.audit_maintenance_update();

create or replace function public.update_maintenance_work_order(
  target_maintenance_id uuid,
  target_status public.maintenance_status,
  target_urgency text,
  target_responsible_id uuid,
  target_cost numeric,
  target_result text,
  target_notes text,
  target_release_condition public.item_condition default 'BOM'
)
returns void language plpgsql security definer set search_path = '' as $$
declare work_order public.maintenance;
begin
  select * into work_order from public.maintenance where id = target_maintenance_id;
  if work_order.id is null then raise exception 'Ordem de manutenção não encontrada.' using errcode = 'P0001'; end if;
  if not public.is_platform_admin() and not exists (select 1 from public.organization_members where organization_id = work_order.organization_id and user_id = auth.uid()) then raise exception 'Usuário sem permissão para esta ordem.' using errcode = 'P0001'; end if;
  if target_urgency not in ('BAIXA','NORMAL','ALTA','CRITICA') then raise exception 'Urgência inválida.' using errcode = 'P0001'; end if;
  if target_responsible_id is not null and not exists (select 1 from public.collaborators where id = target_responsible_id and organization_id = work_order.organization_id and active) then raise exception 'Responsável técnico inválido.' using errcode = 'P0001'; end if;
  if target_status in ('CONCLUIDA','SEM_REPARO') and nullif(trim(target_result),'') is null then raise exception 'Informe o resultado antes de encerrar a manutenção.' using errcode = 'P0001'; end if;
  if target_status = 'CONCLUIDA' and target_release_condition not in ('OTIMO','BOM','REGULAR') then raise exception 'Condição de liberação inválida.' using errcode = 'P0001'; end if;

  update public.maintenance set status=target_status,urgency=target_urgency,responsible_id=target_responsible_id,total_cost=coalesce(target_cost,0),result=nullif(upper(trim(target_result)),''),technical_notes=nullif(upper(trim(target_notes)),''),tested_and_released_at=case when target_status in ('CONCLUIDA','SEM_REPARO') then now() else null end where id=target_maintenance_id;
  if target_status = 'CONCLUIDA' then update public.items set condition=target_release_condition,last_maintenance_at=now() where id=work_order.item_id;
  elsif target_status = 'SEM_REPARO' then update public.items set condition='BAIXADO',last_maintenance_at=now() where id=work_order.item_id;
  end if;
end $$;

revoke all on function public.update_maintenance_work_order(uuid,public.maintenance_status,text,uuid,numeric,text,text,public.item_condition) from public;
grant execute on function public.update_maintenance_work_order(uuid,public.maintenance_status,text,uuid,numeric,text,text,public.item_condition) to authenticated;
