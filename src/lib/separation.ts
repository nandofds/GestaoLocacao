import { listEvents, type RentalEvent } from './events'
import { supabase } from './supabase'

export type SeparationItem = {
  reservation_id: string; item_id: string; internal_code: string; qr_value: string
  description: string; category_name: string; checked_id: string | null; checked_at: string | null
}

type ReservationRow = { id: string; item_id: string; items: { internal_code: string; qr_value: string; description: string; categories: { name: string } | null } }
type CheckRow = { id: string; event_item_id: string; checked_at: string }

function requireSupabase() { if (!supabase) throw new Error('Supabase não configurado.'); return supabase }

export async function listSeparationEvents(): Promise<RentalEvent[]> {
  const events = await listEvents()
  return events.filter((event) => ['CONFIRMADO', 'EM_ANDAMENTO'].includes(event.status))
}

export async function loadEventSeparation(eventId: string): Promise<SeparationItem[]> {
  const [reservationsResult, checksResult] = await Promise.all([
    requireSupabase().from('event_items').select('id,item_id,items!event_items_tenant_item_fk(internal_code,qr_value,description,categories!items_tenant_category_fk(name))').eq('event_id', eventId).eq('active', true).not('item_id', 'is', null).order('id'),
    requireSupabase().from('separation_checks').select('id,event_item_id,checked_at').eq('event_id', eventId),
  ])
  const error = reservationsResult.error ?? checksResult.error
  if (error) throw error
  const checks = new Map(((checksResult.data ?? []) as CheckRow[]).map((check) => [check.event_item_id, check]))
  return ((reservationsResult.data ?? []) as unknown as ReservationRow[]).map((row) => {
    const check = checks.get(row.id)
    return { reservation_id: row.id, item_id: row.item_id, internal_code: row.items.internal_code, qr_value: row.items.qr_value, description: row.items.description, category_name: row.items.categories?.name ?? 'Sem categoria', checked_id: check?.id ?? null, checked_at: check?.checked_at ?? null }
  })
}

export async function scanSeparationItem(eventId: string, code: string) {
  const { error } = await requireSupabase().rpc('scan_separation_item', { target_event_id: eventId, scanned_code: code.trim() })
  if (error) throw new Error(error.message)
}

export async function undoSeparationCheck(checkId: string) {
  const { error } = await requireSupabase().from('separation_checks').delete().eq('id', checkId)
  if (error) throw error
}
