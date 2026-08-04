import { type FormEvent, useEffect, useState } from 'react'
import { Building2, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Organization = { id: string; name: string }

export function PlatformAdmin() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [activeId, setActiveId] = useState('')
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    void Promise.all([
      client.from('platform_admins').select('user_id').limit(1),
      client.rpc('current_organization_id'),
    ]).then(async ([adminResult, organizationResult]) => {
      if (!adminResult.data?.length) return
      setIsAdmin(true)
      setActiveId((organizationResult.data as string | null) ?? '')
      const result = await client.from('organizations').select('id,name').order('name')
      if (result.data) setOrganizations(result.data)
    })
  }, [])

  async function switchOrganization(id: string) {
    if (!supabase || !id || id === activeId) return
    setMessage('Alternando empresa...')
    const { error } = await supabase.rpc('switch_organization', { target_organization_id: id })
    if (error) setMessage(error.message)
    else window.location.reload()
  }

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !newName.trim()) return
    setCreating(true)
    setMessage('')
    const { data, error } = await supabase.rpc('create_organization', { organization_name: newName.trim() })
    if (error) { setMessage(error.message); setCreating(false); return }
    await supabase.rpc('switch_organization', { target_organization_id: data as string })
    window.location.reload()
  }

  if (!isAdmin) return null
  return <div className="platform-admin" title="Administração geral">
    <Building2 size={17} />
    <select aria-label="Empresa ativa" value={activeId} onChange={(event) => void switchOrganization(event.target.value)}>
      {organizations.map((organization) => <option value={organization.id} key={organization.id}>{organization.name}</option>)}
    </select>
    <form onSubmit={createOrganization}>
      <input aria-label="Nome da nova empresa" placeholder="Nova empresa" value={newName} onChange={(event) => setNewName(event.target.value)} required />
      <button type="submit" disabled={creating} title="Criar empresa"><Plus size={16} /></button>
    </form>
    {message ? <small role="status">{message}</small> : null}
  </div>
}
