import { listCollaborators, type Collaborator } from './collaborators'
import { listEvents, type RentalEvent } from './events'
import { supabase } from './supabase'

export type ReturnCondition = 'OTIMO' | 'BOM' | 'REGULAR' | 'DANIFICADO' | 'EXTRAVIADO'
export type ReturnItem = { item_id: string; internal_code: string; qr_value: string; description: string; departure_condition: string; check_id: string | null; return_condition: ReturnCondition | null; defect_description: string | null; checked_at: string | null }
export type ReturnDetails = { items: ReturnItem[]; collaborators: Collaborator[]; movement: { id: string; occurred_at: string; received_by: string | null } | null }
type DepartureRow = { item_id: string; condition: string; items: { internal_code: string; qr_value: string; description: string } }
type CheckRow = { id: string; item_id: string; condition: ReturnCondition; defect_description: string | null; checked_at: string }
function requireSupabase() { if (!supabase) throw new Error('Serviço não configurado.'); return supabase }

export async function listReturnEvents(): Promise<RentalEvent[]> {
  const [events, movementsResult] = await Promise.all([listEvents(), requireSupabase().from('movements').select('event_id,movement_type')])
  if (movementsResult.error) throw movementsResult.error
  const departed = new Set((movementsResult.data ?? []).filter((row) => row.movement_type === 'SAIDA').map((row) => row.event_id))
  return events.filter((event) => departed.has(event.id))
}

export async function loadReturnDetails(event: RentalEvent): Promise<ReturnDetails> {
  const [departureResult, checksResult, returnResult, collaborators] = await Promise.all([
    requireSupabase().from('movement_items').select('item_id,condition,items!movement_items_tenant_item_fk(internal_code,qr_value,description),movements!movement_items_tenant_movement_fk!inner(event_id,movement_type)').eq('movements.event_id', event.id).eq('movements.movement_type', 'SAIDA'),
    requireSupabase().from('return_checks').select('id,item_id,condition,defect_description,checked_at').eq('event_id', event.id),
    requireSupabase().from('movements').select('id,occurred_at,received_by').eq('event_id', event.id).eq('movement_type', 'RETORNO').maybeSingle(),
    listCollaborators(),
  ])
  const error = departureResult.error ?? checksResult.error ?? returnResult.error
  if (error) throw error
  const checks = new Map(((checksResult.data ?? []) as CheckRow[]).map((check) => [check.item_id, check]))
  const items = ((departureResult.data ?? []) as unknown as DepartureRow[]).map((row): ReturnItem => { const check = checks.get(row.item_id); return { item_id: row.item_id, internal_code: row.items.internal_code, qr_value: row.items.qr_value, description: row.items.description, departure_condition: row.condition, check_id: check?.id ?? null, return_condition: check?.condition ?? null, defect_description: check?.defect_description ?? null, checked_at: check?.checked_at ?? null } })
  return { items, collaborators: collaborators.filter((person) => person.organization_id === event.organization_id && person.active), movement: returnResult.data }
}

export async function scanReturnItem(eventId: string, code: string, condition: ReturnCondition, defect: string) {
  const { error } = await requireSupabase().rpc('scan_return_item', { target_event_id: eventId, scanned_code: code.trim(), returned_condition: condition, target_defect: defect || null })
  if (error) throw new Error(error.message)
}
export async function undoReturnCheck(id: string) { const { error } = await requireSupabase().from('return_checks').delete().eq('id', id); if (error) throw new Error(error.message) }
export async function finalizeReturn(eventId: string, collaboratorId: string, notes: string) { const { error } = await requireSupabase().rpc('finalize_event_return', { target_event_id: eventId, responsible_collaborator_id: collaboratorId, target_notes: notes || null }); if (error) throw new Error(error.message) }
