import { listCollaborators, type Collaborator } from './collaborators'
import { supabase } from './supabase'

export type MaintenanceStatus = 'AGUARDANDO_ANALISE' | 'EM_ANALISE' | 'AGUARDANDO_PECA' | 'EM_CONSERTO' | 'AGUARDANDO_TESTE' | 'CONCLUIDA' | 'SEM_REPARO'
export type MaintenanceUrgency = 'BAIXA' | 'NORMAL' | 'ALTA' | 'CRITICA'
export type ReleaseCondition = 'OTIMO' | 'BOM' | 'REGULAR'
export type MaintenanceHistory = { id: string; from_status: MaintenanceStatus | null; to_status: MaintenanceStatus; responsible_id: string | null; total_cost: number; notes: string | null; changed_at: string }
export type WorkOrder = { id: string; organization_id: string; organization_name: string; item_id: string; item_code: string; item_description: string; origin_event_name: string | null; defect_description: string; urgency: MaintenanceUrgency; opened_at: string; expected_completion_at: string | null; result: string | null; status: MaintenanceStatus; tested_and_released_at: string | null; responsible_id: string | null; responsible_name: string | null; total_cost: number; technical_notes: string | null; updated_at: string; history: MaintenanceHistory[] }
export type WorkOrderInput = { status: MaintenanceStatus; urgency: MaintenanceUrgency; responsible_id: string | null; total_cost: number; result: string; technical_notes: string; release_condition: ReleaseCondition }
type OrderRow = Omit<WorkOrder, 'organization_name' | 'item_code' | 'item_description' | 'origin_event_name' | 'responsible_name' | 'history'> & { organizations: { name: string } | null; items: { internal_code: string; description: string } | null; events: { name: string } | null; collaborators: { name: string } | null }
function requireSupabase() { if (!supabase) throw new Error('Supabase não configurado.'); return supabase }

export async function loadMaintenance() {
  const [ordersResult, historyResult, collaborators] = await Promise.all([
    requireSupabase().from('maintenance').select('id,organization_id,item_id,origin_event_id,defect_description,urgency,opened_at,expected_completion_at,result,status,tested_and_released_at,responsible_id,total_cost,technical_notes,updated_at,organizations!maintenance_organization_id_fkey(name),items!maintenance_tenant_item_fk(internal_code,description),events!maintenance_tenant_event_fk(name),collaborators!maintenance_responsible_collaborator_fk(name)').order('opened_at', { ascending: false }),
    requireSupabase().from('maintenance_history').select('id,maintenance_id,from_status,to_status,responsible_id,total_cost,notes,changed_at').order('changed_at', { ascending: false }),
    listCollaborators(),
  ])
  const error = ordersResult.error ?? historyResult.error
  if (error) throw error
  const historyMap = new Map<string, MaintenanceHistory[]>()
  for (const row of historyResult.data ?? []) { const list = historyMap.get(row.maintenance_id) ?? []; list.push({ id: row.id, from_status: row.from_status, to_status: row.to_status, responsible_id: row.responsible_id, total_cost: Number(row.total_cost), notes: row.notes, changed_at: row.changed_at }); historyMap.set(row.maintenance_id, list) }
  const orders = ((ordersResult.data ?? []) as unknown as OrderRow[]).map((row): WorkOrder => ({ ...row, organizations: undefined, items: undefined, events: undefined, collaborators: undefined, organization_name: row.organizations?.name ?? '', item_code: row.items?.internal_code ?? '', item_description: row.items?.description ?? '', origin_event_name: row.events?.name ?? null, responsible_name: row.collaborators?.name ?? null, total_cost: Number(row.total_cost), history: historyMap.get(row.id) ?? [] } as WorkOrder))
  return { orders, collaborators }
}

export async function updateWorkOrder(id: string, input: WorkOrderInput) {
  const { error } = await requireSupabase().rpc('update_maintenance_work_order', { target_maintenance_id: id, target_status: input.status, target_urgency: input.urgency, target_responsible_id: input.responsible_id, target_cost: input.total_cost, target_result: input.result, target_notes: input.technical_notes, target_release_condition: input.release_condition })
  if (error) throw new Error(error.message)
}

export function collaboratorsForOrder(collaborators: Collaborator[], order: WorkOrder) { return collaborators.filter((person) => person.organization_id === order.organization_id && person.active) }
