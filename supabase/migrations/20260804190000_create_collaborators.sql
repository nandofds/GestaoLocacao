create table public.collaborators (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id()
    references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  cpf text,
  phone text,
  job_role text not null check (length(trim(job_role)) > 0),
  employment_type text not null default 'FREELANCER'
    check (employment_type in ('CLT', 'PJ', 'FREELANCER', 'DIARISTA', 'OUTRO')),
  availability text,
  skills text[] not null default '{}',
  daily_rate numeric(12,2) not null default 0 check (daily_rate >= 0),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);

create index collaborators_organization_id_idx
  on public.collaborators (organization_id);
create index collaborators_job_role_idx
  on public.collaborators (organization_id, job_role);
create unique index collaborators_organization_cpf_key
  on public.collaborators (organization_id, cpf)
  where cpf is not null;

alter table public.collaborators enable row level security;

create policy "tenant read" on public.collaborators
  for select to authenticated
  using (organization_id = (select public.current_organization_id()));

create policy "tenant management write" on public.collaborators
  for all to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and (select public.has_management_role())
  )
  with check (
    organization_id = (select public.current_organization_id())
    and (select public.has_management_role())
  );

create policy "platform admin full access" on public.collaborators
  for all to authenticated
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));

revoke all on public.collaborators from anon;
grant select, insert, update, delete on public.collaborators to authenticated;
