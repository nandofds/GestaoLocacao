import { supabase } from './supabase'

export type DashboardEvent = {
  id: string
  time: string
  end: string
  name: string
  place: string
  status: string
  tone: 'success' | 'warning' | 'neutral'
  client: string
  assemblyAt: string
  disassemblyAt: string
}

export type DashboardSnapshot = {
  events: DashboardEvent[]
  operations: Array<{ id: string; date: string; time: string; operation: 'Montagem' | 'Desmontagem'; event: string; client: string; place: string; status: string }>
  stock: Array<{ label: string; value: number; percent: number; tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral' }>
  itemTotal: number
  maintenanceTotal: number
  supplyAlerts: number
  pendingSeparations: number
  overdueItems: number
  awaitingReturnChecks: number
  assembliesToday: number
  disassembliesToday: number
}

export async function loadDashboard(): Promise<DashboardSnapshot> {
  if (!supabase) throw new Error('Serviço não configurado.')

  const now = new Date()
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(now); dayEnd.setHours(23, 59, 59, 999)

  const futureEnd = new Date(dayStart); futureEnd.setDate(futureEnd.getDate() + 14)
  const [eventsResult, itemsResult, maintenanceResult, suppliesResult, reservationsResult, movementsResult, movementItemsResult, separationResult, returnsResult] = await Promise.all([
    supabase.from('events').select('id,name,venue,address,status,assembly_at,starts_at,ends_at,disassembly_at,clients!events_tenant_client_fk(name)').gte('disassembly_at', dayStart.toISOString()).lte('assembly_at', futureEnd.toISOString()).neq('status', 'CANCELADO').order('assembly_at'),
    supabase.from('items').select('id,condition'),
    supabase.from('maintenance').select('item_id').is('tested_and_released_at', null),
    supabase.from('supplies').select('current_balance,minimum_stock'),
    supabase.from('event_items').select('id,event_id,item_id,planned_return_at,active').eq('active', true).not('item_id', 'is', null),
    supabase.from('movements').select('id,event_id,movement_type'),
    supabase.from('movement_items').select('movement_id,item_id'),
    supabase.from('separation_checks').select('event_id,event_item_id'),
    supabase.from('return_checks').select('event_id,item_id'),
  ])

  const error = eventsResult.error ?? itemsResult.error ?? maintenanceResult.error ?? suppliesResult.error ?? reservationsResult.error ?? movementsResult.error ?? movementItemsResult.error ?? separationResult.error ?? returnsResult.error
  if (error) throw error

  const rawEvents = eventsResult.data ?? []
  const operationalEvents = rawEvents.filter((event) => ['CONFIRMADO', 'EM_ANDAMENTO'].includes(event.status))
  const events = rawEvents.filter((event) => new Date(event.assembly_at) <= dayEnd).map((event) => {
    const clientRelation = event.clients as unknown as { name: string } | null
    const start = new Date(event.assembly_at)
    const end = new Date(event.disassembly_at)
    const active = start <= now && end >= now
    return {
      id: event.id,
      time: start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      end: end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      name: event.name,
      place: event.venue ?? event.address ?? 'Local não informado',
      status: active ? 'Em andamento' : event.status,
      tone: active ? 'warning' as const : start > now ? 'neutral' as const : 'success' as const,
      client: clientRelation?.name ?? 'Cliente não informado',
      assemblyAt: event.assembly_at,
      disassemblyAt: event.disassembly_at,
    }
  })

  const operations = operationalEvents.flatMap((event) => {
    const client = (event.clients as unknown as { name: string } | null)?.name ?? 'Cliente não informado'
    const common = { event: event.name, client, place: event.venue ?? event.address ?? 'Local não informado', status: event.status }
    return [{ id: `${event.id}-m`, at: new Date(event.assembly_at), operation: 'Montagem' as const, ...common }, { id: `${event.id}-d`, at: new Date(event.disassembly_at), operation: 'Desmontagem' as const, ...common }]
  }).filter((op) => op.at >= now).sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 8).map(({ at, ...op }) => ({ ...op, date: at.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), time: at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }))

  const movements = movementsResult.data ?? []
  const returnedEvents = new Set(movements.filter((m) => m.movement_type === 'RETORNO').map((m) => m.event_id))
  const openDepartures = movements.filter((m) => m.movement_type === 'SAIDA' && !returnedEvents.has(m.event_id))
  const departureEvent = new Map(openDepartures.map((m) => [m.id, m.event_id]))
  const departedEvents = new Set(movements.filter((m) => m.movement_type === 'SAIDA').map((m) => m.event_id))
  const reservations = reservationsResult.data ?? []
  const reservationByItem = new Map(reservations.map((r) => [`${r.event_id}:${r.item_id}`, r]))
  const returnChecks = new Set((returnsResult.data ?? []).map((r) => `${r.event_id}:${r.item_id}`))
  const inUseItems = new Set<string>(); const overdueItemIds = new Set<string>(); let awaitingReturnChecks = 0
  for (const item of movementItemsResult.data ?? []) {
    const eventId = departureEvent.get(item.movement_id)
    if (!eventId) continue
    inUseItems.add(item.item_id)
    if (returnChecks.has(`${eventId}:${item.item_id}`)) continue
    awaitingReturnChecks += 1
    const reservation = reservationByItem.get(`${eventId}:${item.item_id}`)
    if (reservation && new Date(reservation.planned_return_at) < now) overdueItemIds.add(item.item_id)
  }
  const separated = new Set((separationResult.data ?? []).map((s) => s.event_item_id))
  const nearLimit = new Date(now); nearLimit.setHours(nearLimit.getHours() + 48)
  const nearEvents = new Set(rawEvents.filter((e) => ['CONFIRMADO', 'EM_ANDAMENTO'].includes(e.status) && new Date(e.assembly_at) <= nearLimit && !departedEvents.has(e.id)).map((e) => e.id))
  const pendingSeparations = new Set(reservations.filter((r) => nearEvents.has(r.event_id) && !separated.has(r.id)).map((r) => r.event_id)).size
  const maintenanceItems = new Set((maintenanceResult.data ?? []).map((m) => m.item_id))
  const counts = { available: 0, use: 0, awaiting: 0, maintenance: 0, unavailable: 0 }
  for (const item of itemsResult.data ?? []) {
    if (['EXTRAVIADO', 'BAIXADO', 'DANIFICADO'].includes(item.condition)) counts.unavailable += 1
    else if (maintenanceItems.has(item.id)) counts.maintenance += 1
    else if (overdueItemIds.has(item.id)) counts.awaiting += 1
    else if (inUseItems.has(item.id)) counts.use += 1
    else counts.available += 1
  }
  const itemTotal = (itemsResult.data ?? []).length
  const stock = ([['Disponível', counts.available, 'success'], ['Em uso', counts.use, 'info'], ['Aguardando retorno', counts.awaiting, 'warning'], ['Em manutenção', counts.maintenance, 'danger'], ['Indisponível', counts.unavailable, 'neutral']] as const).map(([label, value, tone]) => ({ label, value, tone, percent: itemTotal ? value / itemTotal * 100 : 0 }))

  return {
    events, operations, stock, itemTotal, pendingSeparations, awaitingReturnChecks,
    overdueItems: overdueItemIds.size,
    maintenanceTotal: maintenanceItems.size,
    supplyAlerts: (suppliesResult.data ?? []).filter((supply) => Number(supply.current_balance) <= Number(supply.minimum_stock)).length,
    assembliesToday: operationalEvents.filter((e) => new Date(e.assembly_at) >= dayStart && new Date(e.assembly_at) <= dayEnd).length,
    disassembliesToday: operationalEvents.filter((e) => new Date(e.disassembly_at) >= dayStart && new Date(e.disassembly_at) <= dayEnd).length,
  }
}
