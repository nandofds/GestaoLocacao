create extension if not exists btree_gist;
create extension if not exists pgcrypto;

create or replace function public.booking_window(
  departure_at timestamptz,
  return_at timestamptz,
  buffer interval
)
returns tstzrange
language sql
immutable
parallel safe
as $$
  select tstzrange(
    departure_at,
    ((return_at at time zone 'UTC') + buffer) at time zone 'UTC',
    '[)'
  )
$$;

create type public.item_condition as enum ('OTIMO', 'BOM', 'REGULAR', 'DANIFICADO', 'EXTRAVIADO', 'BAIXADO');
create type public.movement_type as enum ('SAIDA', 'RETORNO');
create type public.maintenance_status as enum ('AGUARDANDO_ANALISE', 'EM_ANALISE', 'AGUARDANDO_PECA', 'EM_CONSERTO', 'AGUARDANDO_TESTE', 'CONCLUIDA', 'SEM_REPARO');

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  person_type text not null check (person_type in ('PF', 'PJ')),
  tax_id text, phone text, whatsapp text, email text, address text,
  contact_name text, notes text,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  internal_code text not null unique,
  qr_value text not null unique,
  category_id uuid not null references public.categories(id),
  description text not null,
  brand text, model text, serial_number text, storage_location text,
  purchased_at date, purchase_value numeric(12,2),
  condition public.item_condition not null default 'BOM',
  photo_path text, last_maintenance_at timestamptz,
  next_preventive_maintenance_at timestamptz, notes text,
  created_at timestamptz not null default now()
);

create table public.supplies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references public.categories(id),
  unit text not null,
  current_balance numeric(12,3) not null default 0 check (current_balance >= 0),
  minimum_stock numeric(12,3) not null default 0 check (minimum_stock >= 0),
  unit_cost numeric(12,2) not null default 0
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  name text not null, event_type text not null,
  assembly_at timestamptz not null, starts_at timestamptz not null,
  ends_at timestamptz not null, disassembly_at timestamptz not null,
  venue text, address text, local_contact text,
  value numeric(12,2), additional_costs numeric(12,2), notes text,
  status text not null default 'PLANEJADO',
  check (assembly_at <= starts_at and starts_at <= ends_at and ends_at <= disassembly_at)
);

create table public.event_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  item_id uuid references public.items(id),
  supply_id uuid references public.supplies(id),
  quantity numeric(12,3),
  planned_departure_at timestamptz not null,
  planned_return_at timestamptz not null,
  logistics_buffer interval not null default interval '4 hours',
  check ((item_id is not null and supply_id is null and quantity is null) or
         (item_id is null and supply_id is not null and quantity > 0)),
  check (planned_departure_at < planned_return_at)
);

alter table public.event_items add constraint no_item_booking_overlap
  exclude using gist (
    item_id with =,
    public.booking_window(planned_departure_at, planned_return_at, logistics_buffer) with &&
  ) where (item_id is not null);

create table public.movements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  movement_type public.movement_type not null,
  occurred_at timestamptz not null default now(),
  delivered_by uuid, received_by uuid, notes text, confirmation text
);

create table public.movement_items (
  movement_id uuid not null references public.movements(id) on delete cascade,
  item_id uuid not null references public.items(id),
  condition public.item_condition not null,
  photo_path text,
  primary key (movement_id, item_id)
);

create table public.maintenance (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id),
  origin_event_id uuid references public.events(id),
  defect_description text not null, urgency text not null default 'NORMAL',
  opened_at timestamptz not null default now(), expected_completion_at timestamptz,
  result text, status public.maintenance_status not null default 'AGUARDANDO_ANALISE',
  tested_and_released_at timestamptz
);

create or replace function public.item_current_status(target_item_id uuid)
returns text language sql stable security invoker as $$
  select case
    when i.condition in ('EXTRAVIADO', 'BAIXADO') then i.condition::text
    when exists (select 1 from public.maintenance m where m.item_id = i.id and m.tested_and_released_at is null) then 'EM_MANUTENCAO'
    when exists (
      select 1 from public.movement_items mi
      join public.movements mo on mo.id = mi.movement_id
      where mi.item_id = i.id and mo.movement_type = 'SAIDA'
      and not exists (
        select 1 from public.movement_items ri join public.movements ro on ro.id = ri.movement_id
        where ri.item_id = i.id and ro.event_id = mo.event_id and ro.movement_type = 'RETORNO' and ro.occurred_at > mo.occurred_at
      )
    ) then 'EM_USO'
    else 'DISPONIVEL'
  end from public.items i where i.id = target_item_id
$$;

alter table public.clients enable row level security;
alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.supplies enable row level security;
alter table public.events enable row level security;
alter table public.event_items enable row level security;
alter table public.movements enable row level security;
alter table public.movement_items enable row level security;
alter table public.maintenance enable row level security;

create policy "authenticated users read clients" on public.clients for select to authenticated using (true);
create policy "authenticated users read inventory" on public.items for select to authenticated using (true);
create policy "authenticated users read categories" on public.categories for select to authenticated using (true);
create policy "authenticated users read supplies" on public.supplies for select to authenticated using (true);
create policy "authenticated users read events" on public.events for select to authenticated using (true);
create policy "authenticated users read reservations" on public.event_items for select to authenticated using (true);
create policy "authenticated users read movements" on public.movements for select to authenticated using (true);
create policy "authenticated users read movement items" on public.movement_items for select to authenticated using (true);
create policy "authenticated users read maintenance" on public.maintenance for select to authenticated using (true);
