update public.supplies
set name = upper(trim(name)),
    unit = upper(trim(unit));

create unique index supplies_organization_normalized_name_key
  on public.supplies (organization_id, upper(trim(name)));
