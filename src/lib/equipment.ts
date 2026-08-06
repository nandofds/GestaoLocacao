import { supabase } from './supabase'

export type Category = { id: string; name: string; organization_id: string; organization_name: string }
export type ItemCondition = 'OTIMO' | 'BOM' | 'REGULAR' | 'DANIFICADO' | 'EXTRAVIADO' | 'BAIXADO'
export type EquipmentItem = {
  id: string
  organization_id: string
  organization_name: string
  internal_code: string
  qr_value: string
  category_id: string
  category_name: string
  description: string
  brand: string | null
  model: string | null
  serial_number: string | null
  storage_location: string | null
  condition: ItemCondition
  notes: string | null
}
export type EquipmentInput = Omit<EquipmentItem, 'id' | 'organization_id' | 'organization_name' | 'category_name'>

function requireSupabase() {
  if (!supabase) throw new Error('Serviço não configurado.')
  return supabase
}

export async function loadEquipment() {
  const [categoriesResult, itemsResult, organizationResult] = await Promise.all([
    requireSupabase().from('categories').select('id,name,organization_id,organizations!categories_organization_id_fkey(name)').order('name'),
    requireSupabase().from('items').select('id,organization_id,internal_code,qr_value,category_id,description,brand,model,serial_number,storage_location,condition,notes,categories!items_tenant_category_fk(name),organizations!items_organization_id_fkey(name)').order('internal_code'),
    requireSupabase().rpc('current_organization_id'),
  ])
  const error = categoriesResult.error ?? itemsResult.error ?? organizationResult.error
  if (error) throw error
  const items = (itemsResult.data ?? []).map((row) => {
    const category = row.categories as unknown as { name: string } | null
    const organization = row.organizations as unknown as { name: string } | null
    return { ...row, categories: undefined, organizations: undefined, category_name: category?.name ?? 'Sem categoria', organization_name: organization?.name ?? 'Empresa não identificada' } as EquipmentItem
  })
  const categories = (categoriesResult.data ?? []).map((row) => {
    const organization = row.organizations as unknown as { name: string } | null
    return { id: row.id, name: row.name, organization_id: row.organization_id, organization_name: organization?.name ?? 'Empresa não identificada' }
  }) as Category[]
  return { categories, items, activeOrganizationId: organizationResult.data as string }
}

export async function createCategory(name: string): Promise<Category> {
  const client = requireSupabase()
  const normalizedName = name.trim().toLocaleUpperCase('pt-BR')
  const { data: organizationId, error: organizationError } = await client.rpc('current_organization_id')
  if (organizationError) throw organizationError
  const { data: existing, error: searchError } = await client.from('categories').select('id').eq('organization_id', organizationId as string).ilike('name', normalizedName).limit(1)
  if (searchError) throw searchError
  if (existing?.length) throw new Error(`A categoria ${normalizedName} já existe nesta empresa.`)
  const { data, error } = await client.from('categories').insert({ name: normalizedName }).select('id,name,organization_id,organizations!categories_organization_id_fkey(name)').single()
  if (error?.code === '23505') throw new Error(`A categoria ${normalizedName} já existe nesta empresa.`)
  if (error) throw error
  const row = data as unknown as { id: string; name: string; organization_id: string; organizations: { name: string } | null }
  return { id: row.id, name: row.name, organization_id: row.organization_id, organization_name: row.organizations?.name ?? 'Empresa não identificada' }
}

export async function saveEquipment(input: EquipmentInput, id?: string): Promise<void> {
  const query = id ? requireSupabase().from('items').update(input).eq('id', id) : requireSupabase().from('items').insert(input)
  const { error } = await query
  if (error?.code === '23505' && error.message.includes('items_organization_internal_code_key')) {
    throw new Error(`O código interno ${input.internal_code} já está cadastrado nesta empresa.`)
  }
  if (error?.code === '23505' && error.message.includes('items_organization_qr_value_key')) {
    throw new Error(`O QR ${input.qr_value} já está vinculado a outro item desta empresa.`)
  }
  if (error) throw error
}
