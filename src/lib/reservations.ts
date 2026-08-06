import { loadEquipment, type EquipmentItem } from './equipment'
import { supabase } from './supabase'

export type EquipmentReservation = {
  id: string; event_id: string; event_name: string; item_id: string; item: EquipmentItem
  planned_departure_at: string; planned_return_at: string; logistics_buffer_hours: number; active: boolean
}

type ReservationRow = {
  id: string; event_id: string; item_id: string; planned_departure_at: string; planned_return_at: string
  logistics_buffer: string; active: boolean; events: { name: string } | null
  items: Omit<EquipmentItem, 'organization_name' | 'category_name'> & { organizations: { name: string } | null; categories: { name: string } | null }
}

function requireSupabase() { if (!supabase) throw new Error('Serviço não configurado.'); return supabase }
function intervalHours(interval: string) { const days = Number(interval.match(/(\d+) day/)?.[1] ?? 0); const hours = Number(interval.match(/(\d+):/)?.[1] ?? interval.match(/(\d+) hour/)?.[1] ?? 0); return days * 24 + hours }

export async function loadReservationManager(organizationId: string) {
  const [equipment, reservationResult] = await Promise.all([
    loadEquipment(),
    requireSupabase().from('event_items').select('id,event_id,item_id,planned_departure_at,planned_return_at,logistics_buffer,active,events!event_items_tenant_event_fk(name),items!event_items_tenant_item_fk(id,organization_id,internal_code,qr_value,category_id,description,brand,model,serial_number,storage_location,condition,notes,organizations!items_organization_id_fkey(name),categories!items_tenant_category_fk(name))').eq('organization_id', organizationId).not('item_id', 'is', null),
  ])
  if (reservationResult.error) throw reservationResult.error
  const items = equipment.items.filter((item) => item.organization_id === organizationId)
  const reservations = ((reservationResult.data ?? []) as unknown as ReservationRow[]).map((row): EquipmentReservation => ({
    id: row.id, event_id: row.event_id, event_name: row.events?.name ?? 'Evento', item_id: row.item_id,
    planned_departure_at: row.planned_departure_at, planned_return_at: row.planned_return_at,
    logistics_buffer_hours: intervalHours(row.logistics_buffer), active: row.active,
    item: { ...row.items, organizations: undefined, categories: undefined, organization_name: row.items.organizations?.name ?? '', category_name: row.items.categories?.name ?? 'Sem categoria' } as EquipmentItem,
  }))
  return { items, reservations }
}

export async function addEquipmentReservations(eventId: string, itemIds: string[], departureAt: string, returnAt: string, bufferHours: number) {
  const rows = itemIds.map((itemId) => ({ event_id: eventId, item_id: itemId, planned_departure_at: departureAt, planned_return_at: returnAt, logistics_buffer: `${bufferHours} hours` }))
  const { error } = await requireSupabase().from('event_items').insert(rows)
  if (error?.code === '23P01') throw new Error('Um dos equipamentos foi reservado por outro evento neste período. Atualize a disponibilidade e tente novamente.')
  if (error?.code === '23505') throw new Error('Um dos equipamentos já pertence à reserva deste evento.')
  if (error) throw error
}

export async function removeEquipmentReservation(id: string) {
  const { error } = await requireSupabase().from('event_items').delete().eq('id', id)
  if (error) throw error
}
