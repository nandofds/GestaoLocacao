import { listCollaborators, type Collaborator } from './collaborators'
import { listSeparationEvents } from './separation'
import type { RentalEvent } from './events'
import { supabase } from './supabase'

export type DepartureItem = { item_id: string; internal_code: string; description: string; condition: string; checked: boolean }
export type DepartureDetails = { items: DepartureItem[]; collaborators: Collaborator[]; movement: { id: string; occurred_at: string; receiver_name: string | null; delivered_by: string | null } | null }
type ReservationRow = { item_id: string; items: { internal_code: string; description: string; condition: string } }

function requireSupabase() { if (!supabase) throw new Error('Supabase não configurado.'); return supabase }
export async function listDepartureEvents(): Promise<RentalEvent[]> { return listSeparationEvents() }

export async function loadDepartureDetails(event: RentalEvent): Promise<DepartureDetails> {
  const [reservationsResult, checksResult, movementsResult, collaborators] = await Promise.all([
    requireSupabase().from('event_items').select('item_id,items!event_items_tenant_item_fk(internal_code,description,condition)').eq('event_id', event.id).eq('active', true).not('item_id', 'is', null),
    requireSupabase().from('separation_checks').select('item_id').eq('event_id', event.id),
    requireSupabase().from('movements').select('id,occurred_at,receiver_name,delivered_by').eq('event_id', event.id).eq('movement_type', 'SAIDA').maybeSingle(),
    listCollaborators(),
  ])
  const error = reservationsResult.error ?? checksResult.error ?? movementsResult.error
  if (error) throw error
  const checkedIds = new Set((checksResult.data ?? []).map((row) => row.item_id))
  const items = ((reservationsResult.data ?? []) as unknown as ReservationRow[]).map((row) => ({ item_id: row.item_id, internal_code: row.items.internal_code, description: row.items.description, condition: row.items.condition, checked: checkedIds.has(row.item_id) }))
  return { items, collaborators: collaborators.filter((person) => person.organization_id === event.organization_id && person.active), movement: movementsResult.data }
}

export async function finalizeDeparture(eventId: string, collaboratorId: string, receiverName: string, notes: string) {
  const { data, error } = await requireSupabase().rpc('finalize_event_departure', { target_event_id: eventId, responsible_collaborator_id: collaboratorId, target_receiver_name: receiverName, target_notes: notes || null })
  if (error) throw new Error(error.message)
  return data as string
}
