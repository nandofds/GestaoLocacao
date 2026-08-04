alter table public.events
  add constraint events_minimum_assembly_lead_time
  check (starts_at >= assembly_at + interval '12 hours')
  not valid;

comment on constraint events_minimum_assembly_lead_time on public.events is
  'O início do evento deve ocorrer pelo menos 12 horas após o início da montagem.';
