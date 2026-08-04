import { supabase } from './supabase'

export type Client = {
  id: string
  organization_id: string
  organization_name: string
  name: string
  person_type: 'PF' | 'PJ'
  tax_id: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  address: string | null
  contact_name: string | null
  notes: string | null
  created_at: string
}

export type ClientInput = Omit<Client, 'id' | 'created_at' | 'organization_id' | 'organization_name'>

type ClientRow = Omit<Client, 'organization_name'> & { organizations: { name: string } | null }

function mapClient(row: ClientRow): Client {
  const { organizations, ...client } = row
  return { ...client, organization_name: organizations?.name ?? 'Empresa não identificada' }
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase não configurado.')
  return supabase
}

export async function listClients(): Promise<Client[]> {
  const { data, error } = await requireSupabase()
    .from('clients')
    .select('id,organization_id,name,person_type,tax_id,phone,whatsapp,email,address,contact_name,notes,created_at,organizations!clients_organization_id_fkey(name)')
    .order('name')

  if (error) throw error
  return ((data ?? []) as unknown as ClientRow[]).map(mapClient)
}

export async function saveClient(input: ClientInput, id?: string): Promise<Client> {
  const query = id
    ? requireSupabase().from('clients').update(input).eq('id', id)
    : requireSupabase().from('clients').insert(input)
  const { data, error } = await query
    .select('id,organization_id,name,person_type,tax_id,phone,whatsapp,email,address,contact_name,notes,created_at,organizations!clients_organization_id_fkey(name)')
    .single()

  if (error) throw error
  return mapClient(data as unknown as ClientRow)
}
