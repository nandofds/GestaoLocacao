import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { LockKeyhole } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setLoading(true)
    setMessage('')

    const result = registering
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    if (result.error) setMessage(result.error.message)
    else if (registering && !result.data.session) setMessage('Cadastro criado. Confirme o e-mail para entrar.')
    setLoading(false)
  }

  if (!isSupabaseConfigured) return children
  if (loading && !message) return <main className="auth-page"><div className="auth-card"><span className="auth-logo">L</span><p>Conectando ao Supabase...</p></div></main>
  if (session) return children

  return <main className="auth-page">
    <form className="auth-card" onSubmit={submit}>
      <span className="auth-logo"><LockKeyhole /></span>
      <div><h1>{registering ? 'Criar acesso' : 'Entrar no Lume'}</h1><p>Gestão segura da operação e do inventário.</p></div>
      <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
      <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={registering ? 'new-password' : 'current-password'} minLength={6} required /></label>
      {message ? <p className="auth-message" role="status">{message}</p> : null}
      <button className="primary auth-submit" disabled={loading}>{loading ? 'Aguarde...' : registering ? 'Cadastrar' : 'Entrar'}</button>
      <button className="auth-switch" type="button" onClick={() => { setRegistering((value) => !value); setMessage('') }}>
        {registering ? 'Já tenho uma conta' : 'Criar minha conta'}
      </button>
    </form>
  </main>
}
