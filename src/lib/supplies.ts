import { supabase } from './supabase'
import type { Category } from './equipment'

export type Supply = {
  id: string
  organization_id: string
  organization_name: string
  name: string
  category_id: string | null
  category_name: string
  unit: string
  current_balance: number
  minimum_stock: number
  unit_cost: number
}

export type SupplyInput = Omit<Supply, 'id' | 'organization_id' | 'organization_name' | 'category_name'>

function requireSupabase() {
  if (!supabase) throw new Error('Supabase não configurado.')
  return supabase
}

export async function loadSupplies() {
  const client = requireSupabase()
  const [suppliesResult, categoriesResult, organizationResult] = await Promise.all([
    client.from('supplies').select('id,organization_id,name,category_id,unit,current_balance,minimum_stock,unit_cost,categories!supplies_tenant_category_fk(name),organizations!supplies_organization_id_fkey(name)').order('name'),
    client.from('categories').select('id,name,organization_id,organizations!categories_organization_id_fkey(name)').order('name'),
    client.rpc('current_organization_id'),
  ])
  const error = suppliesResult.error ?? categoriesResult.error ?? organizationResult.error
  if (error) throw error
  const supplies = (suppliesResult.data ?? []).map((row) => ({
    id: row.id,
    organization_id: row.organization_id,
    organization_name: (row.organizations as unknown as { name: string } | null)?.name ?? 'Empresa não identificada',
    name: row.name,
    category_id: row.category_id,
    category_name: (row.categories as unknown as { name: string } | null)?.name ?? 'Sem categoria',
    unit: row.unit,
    current_balance: Number(row.current_balance),
    minimum_stock: Number(row.minimum_stock),
    unit_cost: Number(row.unit_cost),
  })) as Supply[]
  const categories = (categoriesResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    organization_id: row.organization_id,
    organization_name: (row.organizations as unknown as { name: string } | null)?.name ?? 'Empresa não identificada',
  })) as Category[]
  return { supplies, categories, activeOrganizationId: organizationResult.data as string }
}

export async function saveSupply(input: SupplyInput, id?: string) {
  const client = requireSupabase()
  const query = id ? client.from('supplies').update(input).eq('id', id) : client.from('supplies').insert(input)
  const { error } = await query
  if (error?.code === '23505') throw new Error(`O insumo ${input.name} já está cadastrado nesta empresa.`)
  if (error) throw error
}
