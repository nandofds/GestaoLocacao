import { supabase } from './supabase'

export type EventStatus = 'PLANEJADO' | 'CONFIRMADO' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO'

export type RentalEvent = {
  id: string; organization_id: string; organization_name: string; client_id: string; client_name: string
  name: string; event_type: string; assembly_at: string; starts_at: string; ends_at: string; disassembly_at: string
  venue: string | null; address: string | null; local_contact: string | null; value: number
  additional_costs: number; notes: string | null; status: EventStatus
}

export type EventInput = Omit<RentalEvent, 'id' | 'organization_id' | 'organization_name' | 'client_name'>
type EventRow = Omit<RentalEvent, 'organization_name' | 'client_name'> & { clients: { name: string } | null; organizations: { name: string } | null }

function requireSupabase() { if (!supabase) throw new Error('Serviço não configurado.'); return supabase }
function mapEvent(row: EventRow): RentalEvent {
  const { clients, organizations, ...event } = row
  return { ...event, value: Number(event.value ?? 0), additional_costs: Number(event.additional_costs ?? 0), client_name: clients?.name ?? 'Cliente não identificado', organization_name: organizations?.name ?? 'Empresa não identificada' }
}

const eventSelect = 'id,organization_id,client_id,name,event_type,assembly_at,starts_at,ends_at,disassembly_at,venue,address,local_contact,value,additional_costs,notes,status,clients!events_tenant_client_fk(name),organizations!events_organization_id_fkey(name)'

export async function listEvents(): Promise<RentalEvent[]> {
  const { data, error } = await requireSupabase().from('events').select(eventSelect).order('assembly_at')
  if (error) throw error
  return ((data ?? []) as unknown as EventRow[]).map(mapEvent)
}

export async function listAgendaEvents(startAt: string, endAt: string, status?: EventStatus): Promise<RentalEvent[]> {
  let query = requireSupabase().from('events').select(eventSelect).lte('assembly_at', endAt).gte('disassembly_at', startAt).order('assembly_at')
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as unknown as EventRow[]).map(mapEvent)
}

export async function saveEvent(input: EventInput, id?: string): Promise<RentalEvent> {
  const query = id ? requireSupabase().from('events').update(input).eq('id', id) : requireSupabase().from('events').insert(input)
  const { data, error } = await query.select(eventSelect).single()
  if (error) throw error
  return mapEvent(data as unknown as EventRow)
}
