import { supabase } from './supabase'

export type ReportEvent = { id: string; name: string; client: string; startsAt: string; status: string; value: number; additionalCosts: number }
export type ReportSnapshot = { events: ReportEvent[]; maintenanceCost: number; maintenanceCount: number; itemCount: number }

export async function loadReport(start: string, end: string): Promise<ReportSnapshot> {
  if (!supabase) throw new Error('Serviço não configurado.')
  const endExclusive = new Date(`${end}T00:00:00`); endExclusive.setDate(endExclusive.getDate() + 1)
  const [eventsResult, maintenanceResult, itemsResult] = await Promise.all([
    supabase.from('events').select('id,name,starts_at,status,value,additional_costs,clients!events_tenant_client_fk(name)').gte('starts_at', `${start}T00:00:00`).lt('starts_at', endExclusive.toISOString()).order('starts_at', { ascending: false }),
    supabase.from('maintenance').select('total_cost').gte('opened_at', `${start}T00:00:00`).lt('opened_at', endExclusive.toISOString()),
    supabase.from('items').select('*', { count: 'exact', head: true }),
  ])
  const error = eventsResult.error ?? maintenanceResult.error ?? itemsResult.error
  if (error) throw new Error(error.message)
  return {
    events: (eventsResult.data ?? []).map((event) => ({ id: event.id, name: event.name, client: (event.clients as unknown as { name: string } | null)?.name ?? 'Cliente não informado', startsAt: event.starts_at, status: event.status, value: Number(event.value ?? 0), additionalCosts: Number(event.additional_costs ?? 0) })),
    maintenanceCost: (maintenanceResult.data ?? []).reduce((sum, row) => sum + Number(row.total_cost ?? 0), 0),
    maintenanceCount: maintenanceResult.data?.length ?? 0,
    itemCount: itemsResult.count ?? 0,
  }
}
