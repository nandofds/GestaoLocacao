import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [organizationName, setOrganizationName] = useState('')
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
      ? await supabase.auth.signUp({
          email,
          password,
          options: { data: { organization_name: organizationName } },
        })
      : await supabase.auth.signInWithPassword({ email, password })

    if (result.error) setMessage(result.error.message)
    else if (registering && !result.data.session) setMessage('Cadastro criado. Confirme o e-mail para entrar.')
    setLoading(false)
  }

  if (!isSupabaseConfigured) return children
  if (loading && !message) return <main className="auth-page"><div className="auth-card"><img className="auth-brand-logo" src="/backroadie-logo.png" alt="BackRoadie" /><p>Conectando...</p></div></main>
  if (session) return children

  return <main className="auth-page">
    <form className="auth-card" onSubmit={submit}>
      <img className="auth-brand-logo" src="/backroadie-logo.png" alt="BackRoadie" />
      <div className="auth-title"><span className="auth-logo"><LockKeyhole /></span><div><h1>{registering ? 'Criar acesso' : 'Entrar no BackRoadie'}</h1><p>Gestão segura da operação e do inventário.</p></div></div>
      <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
      {registering ? <label>Nome da empresa<input type="text" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} autoComplete="organization" required /></label> : null}
      <label>Senha<span className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={registering ? 'new-password' : 'current-password'} minLength={6} required /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff /> : <Eye />}</button></span></label>
      {message ? <p className="auth-message" role="status">{message}</p> : null}
      <button className="primary auth-submit" disabled={loading}>{loading ? 'Aguarde...' : registering ? 'Cadastrar' : 'Entrar'}</button>
      <button className="auth-switch" type="button" onClick={() => { setRegistering((value) => !value); setMessage('') }}>
        {registering ? 'Já tenho uma conta' : 'Criar minha conta'}
      </button>
    </form>
  </main>
}
