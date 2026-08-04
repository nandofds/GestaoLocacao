import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Identity = {
  name: string
  email: string
  organization: string
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'LU'
}

export function UserIdentity() {
  const [identity, setIdentity] = useState<Identity | null>(null)

  useEffect(() => {
    if (!supabase) return
    let active = true
    const client = supabase
    void client.auth.getUser().then(async ({ data, error }) => {
      if (error || !data.user) return
      const profileResult = await client
        .from('profiles')
        .select('display_name,active_organization:organizations!profiles_active_organization_id_fkey(name)')
        .eq('id', data.user.id)
        .single()
      if (!active) return
      const organization = profileResult.data?.active_organization as unknown as { name: string } | null
      const email = data.user.email ?? ''
      setIdentity({
        name: profileResult.data?.display_name?.trim() || email.split('@')[0] || 'Usuário',
        email,
        organization: organization?.name ?? 'Empresa não identificada',
      })
    })
    return () => { active = false }
  }, [])

  if (!identity) return <><span className="avatar">LU</span><span className="user"><strong>Carregando usuário…</strong><small>Carregando empresa…</small></span></>

  return <><span className="avatar" title={identity.email}>{initials(identity.name)}</span><span className="user" title={identity.email}><strong>{identity.name}</strong><small>{identity.organization}</small></span></>
}
