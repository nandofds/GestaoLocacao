-- O administrador da plataforma possui visão e gestão globais. Usuários
-- comuns continuam limitados à empresa ativa pelas políticas tenant_*.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'clients', 'categories', 'items', 'supplies', 'events', 'event_items',
    'movements', 'movement_items', 'maintenance'
  ] loop
    execute format(
      'create policy "platform admin full access" on public.%I '
      'for all to authenticated '
      'using ((select public.is_platform_admin())) '
      'with check ((select public.is_platform_admin()))',
      table_name
    );
  end loop;
end $$;
