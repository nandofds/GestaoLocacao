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
  itemTotal: number
  maintenanceTotal: number
  supplyAlerts: number
}

export async function loadDashboard(): Promise<DashboardSnapshot> {
  if (!supabase) throw new Error('Supabase não configurado.')

  const now = new Date()
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(now); dayEnd.setHours(23, 59, 59, 999)

  const [eventsResult, itemsResult, maintenanceResult, suppliesResult] = await Promise.all([
    supabase.from('events').select('id,name,venue,address,status,assembly_at,starts_at,ends_at,disassembly_at,clients(name)').lte('assembly_at', dayEnd.toISOString()).gte('disassembly_at', dayStart.toISOString()).order('assembly_at'),
    supabase.from('items').select('*', { count: 'exact', head: true }),
    supabase.from('maintenance').select('*', { count: 'exact', head: true }).is('tested_and_released_at', null),
    supabase.from('supplies').select('current_balance,minimum_stock'),
  ])

  const error = eventsResult.error ?? itemsResult.error ?? maintenanceResult.error ?? suppliesResult.error
  if (error) throw error

  const events = (eventsResult.data ?? []).map((event) => {
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

  return {
    events,
    itemTotal: itemsResult.count ?? 0,
    maintenanceTotal: maintenanceResult.count ?? 0,
    supplyAlerts: (suppliesResult.data ?? []).filter((supply) => Number(supply.current_balance) <= Number(supply.minimum_stock)).length,
  }
}
