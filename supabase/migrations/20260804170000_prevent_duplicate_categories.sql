-- Consolida categorias equivalentes dentro da mesma empresa e impede novas
-- duplicidades sem diferenciar maiúsculas/minúsculas ou espaços nas pontas.
create temporary table category_merge on commit drop as
select id as duplicate_id, canonical_id
from (
  select
    id,
    first_value(id) over (
      partition by organization_id, upper(trim(name))
      order by id::text
    ) as canonical_id,
    row_number() over (
      partition by organization_id, upper(trim(name))
      order by id::text
    ) as position
  from public.categories
) ranked
where position > 1;

update public.items item
set category_id = merge.canonical_id
from category_merge merge
where item.category_id = merge.duplicate_id;

update public.supplies supply
set category_id = merge.canonical_id
from category_merge merge
where supply.category_id = merge.duplicate_id;

delete from public.categories category
using category_merge merge
where category.id = merge.duplicate_id;

update public.categories
set name = upper(trim(name));

create unique index categories_organization_normalized_name_key
  on public.categories (organization_id, upper(trim(name)));
