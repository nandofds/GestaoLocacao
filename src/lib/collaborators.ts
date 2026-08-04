import { supabase } from './supabase'

export type EmploymentType = 'CLT' | 'PJ' | 'FREELANCER' | 'DIARISTA' | 'OUTRO'
export type Collaborator = {
  id: string
  organization_id: string
  organization_name: string
  name: string
  cpf: string | null
  phone: string | null
  job_role: string
  employment_type: EmploymentType
  availability: string | null
  skills: string[]
  daily_rate: number
  active: boolean
  notes: string | null
}
export type CollaboratorInput = Omit<Collaborator, 'id' | 'organization_id' | 'organization_name'>

function requireSupabase() {
  if (!supabase) throw new Error('Supabase não configurado.')
  return supabase
}

export async function listCollaborators(): Promise<Collaborator[]> {
  const { data, error } = await requireSupabase().from('collaborators').select('id,organization_id,name,cpf,phone,job_role,employment_type,availability,skills,daily_rate,active,notes,organizations!collaborators_organization_id_fkey(name)').order('name')
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    organization_name: (row.organizations as unknown as { name: string } | null)?.name ?? 'Empresa não identificada',
    organizations: undefined,
    daily_rate: Number(row.daily_rate),
  })) as unknown as Collaborator[]
}

export async function saveCollaborator(input: CollaboratorInput, id?: string) {
  const client = requireSupabase()
  const query = id ? client.from('collaborators').update(input).eq('id', id) : client.from('collaborators').insert(input)
  const { error } = await query
  if (error?.code === '23505') throw new Error(`O CPF ${input.cpf} já está vinculado a outro colaborador desta empresa.`)
  if (error) throw error
}
