import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, MapPin, UserPlus, UsersRound } from 'lucide-react'
import { listClients, saveClient, type Client, type ClientInput } from '../lib/clients'
import { listEvents, saveEvent, type EventInput, type RentalEvent } from '../lib/events'
import { formatPhone, formatTaxId, normalizePhone, normalizeTaxId } from '../lib/inputMasks'

function initialEvent(): EventInput {
  return {
    client_id: '', name: '', event_type: 'SHOW', assembly_at: '',
    starts_at: '', ends_at: '', disassembly_at: '',
    venue: '', address: '', local_contact: '', value: 0, additional_costs: 0, notes: '', status: 'PLANEJADO',
  }
}

function datePart(value: string) { return value.slice(0, 10) }
function timePart(value: string) { return value.slice(11, 16) }
function updateDatePart(value: string, date: string) { return date ? `${date}T${timePart(value)}` : '' }
function updateTimePart(value: string, time: string) { return `${datePart(value)}T${time}` }

function MobileTitle({ title, onBack }: { title: string; onBack: () => void }) {
  return <header className="mobile-header mobile-planning-header"><button aria-label="Voltar" onClick={onBack}><ArrowLeft /></button><h1>{title}</h1><span aria-hidden="true" /></header>
}

function message(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Não foi possível concluir a operação.'
}

export function MobileAgenda({ onBack }: { onBack: () => void }) {
  const [events, setEvents] = useState<RentalEvent[]>([])
  const [month, setMonth] = useState(() => { const date = new Date(); date.setDate(1); date.setHours(0, 0, 0, 0); return date })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void listEvents().then((items) => {
      if (active) setEvents(items)
    }).catch((reason: unknown) => { if (active) setError(message(reason)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const grouped = useMemo(() => {
    const groups = new Map<string, RentalEvent[]>()
    const start = month.getTime()
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime()
    for (const event of events.filter((item) => new Date(item.starts_at).getTime() >= start && new Date(item.starts_at).getTime() < end)) {
      const key = new Date(event.starts_at).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
      groups.set(key, [...(groups.get(key) ?? []), event])
    }
    return [...groups.entries()]
  }, [events, month])

  function changeMonth(offset: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  function goToday() {
    const today = new Date(); setMonth(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  function goToDate(value: string) {
    if (!value) return
    const [year, selectedMonth] = value.split('-').map(Number)
    setMonth(new Date(year, selectedMonth - 1, 1))
  }

  return <div className="mobile-screen"><MobileTitle title="Agenda" onBack={onBack} />
    <p className="mobile-page-intro">Consulte eventos anteriores e futuros.</p>
    <nav className="mobile-agenda-nav" aria-label="Navegação da agenda"><button aria-label="Mês anterior" onClick={() => changeMonth(-1)}><ChevronLeft /></button><strong>{month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong><button aria-label="Próximo mês" onClick={() => changeMonth(1)}><ChevronRight /></button><div className="mobile-agenda-jump"><button className="mobile-agenda-today" onClick={goToday}>Hoje</button><label className="mobile-date-picker"><CalendarDays /><span>Ir para data</span><input type="date" aria-label="Ir para uma data" onChange={(event) => goToDate(event.target.value)} /></label></div></nav>
    {error ? <div className="data-error" role="alert">{error}</div> : null}
    {loading ? <p className="empty-state">Carregando agenda…</p> : grouped.length === 0 ? <p className="empty-state">Nenhum evento neste mês.</p> : <div className="mobile-agenda">
      {grouped.map(([date, items]) => <section key={date}><h2>{date}</h2>{items.map((event) => <article key={event.id}>
        <time>{new Date(event.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time>
        <div><strong>{event.name}</strong><span><UsersRound /> {event.client_name}</span><span><MapPin /> {event.venue || event.address || 'Local não informado'}</span><small>Montagem: {new Date(event.assembly_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</small></div>
        <em className={`mobile-agenda-status mobile-agenda-status--${event.status.toLocaleLowerCase('pt-BR')}`}>{event.status === 'PLANEJADO' ? 'Planejado' : event.status === 'CONFIRMADO' ? 'Confirmado' : event.status === 'EM_ANDAMENTO' ? 'Em andamento' : event.status === 'CANCELADO' ? 'Cancelado' : 'Concluído'}</em>
      </article>)}</section>)}
    </div>}
  </div>
}

export function MobileClientCreate({ onBack, onCreated }: { onBack: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<ClientInput>({ name: '', person_type: 'PF', tax_id: '', phone: '', whatsapp: '', email: '', address: '', contact_name: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      await saveClient({ ...form, name: form.name.trim(), tax_id: normalizeTaxId(form.tax_id ?? '', form.person_type) || null, phone: normalizePhone(form.phone ?? '') || null, whatsapp: normalizePhone(form.whatsapp ?? '') || null, email: form.email?.trim() || null })
      onCreated()
    } catch (reason) { setError(message(reason)) } finally { setSaving(false) }
  }

  return <div className="mobile-screen"><MobileTitle title="Novo cliente" onBack={onBack} /><p className="mobile-page-intro">Cadastro básico para criar eventos rapidamente.</p>
    <form className="mobile-simple-form" onSubmit={submit}>{error ? <div className="data-error" role="alert">{error}</div> : null}
      <label>Nome / razão social<input autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label>Tipo<select value={form.person_type} onChange={(event) => setForm({ ...form, person_type: event.target.value as 'PF' | 'PJ', tax_id: '' })}><option value="PF">Pessoa física</option><option value="PJ">Pessoa jurídica</option></select></label>
      <label>{form.person_type === 'PF' ? 'CPF' : 'CNPJ'}<input required inputMode={form.person_type === 'PF' ? 'numeric' : 'text'} maxLength={18} value={formatTaxId(form.tax_id ?? '', form.person_type)} onChange={(event) => setForm({ ...form, tax_id: normalizeTaxId(event.target.value, form.person_type) })} placeholder={form.person_type === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'} /></label>
      <label>Telefone<input type="tel" inputMode="tel" value={formatPhone(form.phone ?? '')} onChange={(event) => setForm({ ...form, phone: normalizePhone(event.target.value) })} /></label>
      <label>WhatsApp<input type="tel" inputMode="tel" value={formatPhone(form.whatsapp ?? '')} onChange={(event) => setForm({ ...form, whatsapp: normalizePhone(event.target.value) })} /></label>
      <label>E-mail<input type="email" value={form.email ?? ''} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <button className="mobile-primary" disabled={saving}><UserPlus /> {saving ? 'Salvando…' : 'Cadastrar cliente'}</button>
    </form>
  </div>
}

export function MobileEventWizard({ onBack, onSaved, initialClientId }: { onBack: () => void; onSaved: () => void; initialClientId?: string }) {
  const [clients, setClients] = useState<Client[]>([])
  const [form, setForm] = useState<EventInput>(() => initialEvent())
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void listClients().then((items) => { if (active) { setClients(items); setForm((current) => ({ ...current, client_id: initialClientId || items[0]?.id || '' })) } })
      .catch((reason: unknown) => { if (active) setError(message(reason)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [initialClientId])

  function next() {
    setError('')
    if (step === 1 && (!form.client_id || !form.name.trim())) { setError('Selecione o cliente e informe o nome do evento.'); return }
    if (step === 2 && !form.venue?.trim() && !form.address?.trim()) { setError('Informe o local ou o endereço do evento.'); return }
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    setStep((current) => Math.min(3, current + 1))
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError('')
    const dates = [form.assembly_at, form.starts_at, form.ends_at, form.disassembly_at].map((value) => new Date(value).getTime())
    if (dates.some(Number.isNaN) || !(dates[0] <= dates[1] && dates[1] <= dates[2] && dates[2] <= dates[3])) { setError('Revise a ordem: montagem, início, término e desmontagem.'); return }
    setSaving(true)
    try {
      await saveEvent({ ...form, name: form.name.trim().toLocaleUpperCase('pt-BR'), event_type: form.event_type.trim().toLocaleUpperCase('pt-BR'), venue: form.venue?.trim().toLocaleUpperCase('pt-BR') || null, address: form.address?.trim().toLocaleUpperCase('pt-BR') || null, local_contact: null, assembly_at: new Date(form.assembly_at).toISOString(), starts_at: new Date(form.starts_at).toISOString(), ends_at: new Date(form.ends_at).toISOString(), disassembly_at: new Date(form.disassembly_at).toISOString() })
      setSaved(true)
    } catch (reason) { setError(message(reason)) } finally { setSaving(false) }
  }

  if (saved) return <div className="mobile-screen"><MobileTitle title="Evento criado" onBack={onBack} /><div className="mobile-event-success"><span><Check /></span><h2>Evento criado com sucesso</h2><p>O evento foi salvo como planejado. Confirme-o antes de selecionar equipamentos.</p><button className="mobile-primary" onClick={onSaved}>Ver na agenda</button><button className="secondary" onClick={onBack}>Voltar ao início</button></div></div>

  return <div className="mobile-screen"><MobileTitle title="Novo evento" onBack={onBack} />
    <div className="wizard-progress" aria-label={`Etapa ${step} de 3`}><span className={step >= 1 ? 'active' : ''} /><span className={step >= 2 ? 'active' : ''} /><span className={step >= 3 ? 'active' : ''} /></div>
    <div className="wizard-heading"><small>Etapa {step} de 3</small><h2>{step === 1 ? 'Cliente e evento' : step === 2 ? 'Local do evento' : 'Datas e horários'}</h2></div>
    {error ? <div className="data-error" role="alert">{error}</div> : null}
    {loading ? <p className="empty-state">Carregando…</p> : clients.length === 0 ? <div className="mobile-empty-action"><UsersRound /><strong>Cadastre um cliente primeiro</strong><button type="button" className="secondary" onClick={onBack}>Voltar</button></div> : <form className="mobile-simple-form mobile-wizard" onSubmit={submit}>
      {step === 1 ? <div className="mobile-wizard-step" key="event-step-1"><label>Cliente<select required value={form.client_id} onChange={(event) => setForm({ ...form, client_id: event.target.value })}>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></label><label>Nome do evento<input autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Tipo<select value={form.event_type} onChange={(event) => setForm({ ...form, event_type: event.target.value })}>{['SHOW', 'FESTA', 'CASAMENTO', 'CORPORATIVO', 'OUTRO'].map((type) => <option key={type}>{type}</option>)}</select></label></div> : null}
      {step === 2 ? <div className="mobile-wizard-step" key="event-step-2"><label>Local / espaço<input autoFocus value={form.venue ?? ''} onChange={(event) => setForm({ ...form, venue: event.target.value })} placeholder="Ex.: Espaço Central" /></label><label>Endereço<input value={form.address ?? ''} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label></div> : null}
      {step === 3 ? <div className="mobile-wizard-step" key="event-step-3">
        <fieldset className="mobile-date-time"><legend>Montagem</legend><label>Data<input type="date" required value={datePart(form.assembly_at)} onChange={(event) => setForm({ ...form, assembly_at: updateDatePart(form.assembly_at, event.target.value) })} /></label><label>Hora<input type="time" required disabled={!datePart(form.assembly_at)} value={timePart(form.assembly_at)} onChange={(event) => setForm({ ...form, assembly_at: updateTimePart(form.assembly_at, event.target.value) })} /></label></fieldset>
        <fieldset className="mobile-date-time"><legend>Início do evento</legend><label>Data<input type="date" required value={datePart(form.starts_at)} onChange={(event) => setForm({ ...form, starts_at: updateDatePart(form.starts_at, event.target.value) })} /></label><label>Hora<input type="time" required disabled={!datePart(form.starts_at)} value={timePart(form.starts_at)} onChange={(event) => setForm({ ...form, starts_at: updateTimePart(form.starts_at, event.target.value) })} /></label></fieldset>
        <fieldset className="mobile-date-time"><legend>Término do evento</legend><label>Data<input type="date" required value={datePart(form.ends_at)} onChange={(event) => setForm({ ...form, ends_at: updateDatePart(form.ends_at, event.target.value) })} /></label><label>Hora<input type="time" required disabled={!datePart(form.ends_at)} value={timePart(form.ends_at)} onChange={(event) => setForm({ ...form, ends_at: updateTimePart(form.ends_at, event.target.value) })} /></label></fieldset>
        <fieldset className="mobile-date-time"><legend>Desmontagem concluída</legend><label>Data<input type="date" required value={datePart(form.disassembly_at)} onChange={(event) => setForm({ ...form, disassembly_at: updateDatePart(form.disassembly_at, event.target.value) })} /></label><label>Hora<input type="time" required disabled={!datePart(form.disassembly_at)} value={timePart(form.disassembly_at)} onChange={(event) => setForm({ ...form, disassembly_at: updateTimePart(form.disassembly_at, event.target.value) })} /></label></fieldset>
      </div> : null}
      <footer><button type="button" className="secondary" onClick={() => step === 1 ? onBack() : setStep((current) => current - 1)}><ArrowLeft /> {step === 1 ? 'Cancelar' : 'Voltar'}</button>{step < 3 ? <button type="button" className="mobile-primary" onClick={next}>Continuar <ArrowRight /></button> : <button className="mobile-primary" disabled={saving}><Check /> {saving ? 'Salvando…' : 'Criar planejado'}</button>}</footer>
    </form>}
  </div>
}
