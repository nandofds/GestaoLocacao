import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CalendarPlus, Pencil, Plus, Search, X } from 'lucide-react'
import { listClients, type Client } from '../lib/clients'
import { listEvents, saveEvent, type EventInput, type EventStatus, type RentalEvent } from '../lib/events'
import { EventEquipmentModal } from './EventEquipmentModal'

const statuses: Array<[EventStatus, string]> = [['PLANEJADO', 'Planejado'], ['CONFIRMADO', 'Confirmado'], ['EM_ANDAMENTO', 'Em andamento'], ['CONCLUIDO', 'Concluído'], ['CANCELADO', 'Cancelado']]
const statusLegend: Array<[EventStatus, string, string]> = [
  ['PLANEJADO', 'Planejado', 'Evento em preparação; dados e reservas ainda podem ser ajustados.'],
  ['CONFIRMADO', 'Confirmado', 'Evento aprovado e confirmado; os equipamentos reservados ficam bloqueados.'],
  ['EM_ANDAMENTO', 'Em andamento', 'A operação já começou, incluindo montagem, saída ou uso dos equipamentos.'],
  ['CONCLUIDO', 'Concluído', 'Evento finalizado, com retorno e conferência encerrados.'],
  ['CANCELADO', 'Cancelado', 'Evento não será realizado e suas reservas ficam liberadas.'],
]
const types = ['SHOW', 'CASAMENTO', 'CONGRESSO', 'FORMATURA', 'FESTA', 'FEIRA', 'CULTO', 'OUTRO']
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir a operação.'
const localDateTime = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
const toInput = (value: string) => localDateTime(new Date(value))

function makeEmptyForm(): EventInput {
  const assembly = new Date(); assembly.setMinutes(0, 0, 0); assembly.setHours(assembly.getHours() + 1)
  const starts = new Date(assembly.getTime() + 12 * 60 * 60_000); const ends = new Date(starts.getTime() + 4 * 60 * 60_000); const disassembly = new Date(ends.getTime() + 2 * 60 * 60_000)
  return { client_id: '', name: '', event_type: types[0], assembly_at: localDateTime(assembly), starts_at: localDateTime(starts), ends_at: localDateTime(ends), disassembly_at: localDateTime(disassembly), venue: null, address: null, local_contact: null, value: 0, additional_costs: 0, notes: null, status: 'PLANEJADO' }
}

export function EventsPage() {
  const [events, setEvents] = useState<RentalEvent[]>([]); const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string>(); const [formOpen, setFormOpen] = useState(false); const [form, setForm] = useState<EventInput>(() => makeEmptyForm())
  const [reservationEvent, setReservationEvent] = useState<RentalEvent>()

  useEffect(() => { let active = true; void Promise.all([listEvents(), listClients()]).then(([eventList, clientList]) => { if (active) { setEvents(eventList); setClients(clientList) } }).catch((reason: unknown) => { if (active) setError(errorMessage(reason)) }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [])
  const filtered = useMemo(() => { const term = search.trim().toLocaleLowerCase('pt-BR'); return term ? events.filter((event) => [event.name, event.client_name, event.venue, event.event_type, event.status].some((value) => value?.toLocaleLowerCase('pt-BR').includes(term))) : events }, [events, search])

  function openNew() { const next = makeEmptyForm(); next.client_id = clients[0]?.id ?? ''; setEditingId(undefined); setForm(next); setError(''); setFormOpen(true) }
  function openEdit(event: RentalEvent) { setEditingId(event.id); setForm({ client_id: event.client_id, name: event.name, event_type: event.event_type, assembly_at: toInput(event.assembly_at), starts_at: toInput(event.starts_at), ends_at: toInput(event.ends_at), disassembly_at: toInput(event.disassembly_at), venue: event.venue, address: event.address, local_contact: event.local_contact, value: event.value, additional_costs: event.additional_costs, notes: event.notes, status: event.status }); setError(''); setFormOpen(true) }
  function changeAssembly(value: string) {
    setForm((current) => {
      if (!value) return { ...current, assembly_at: value }
      const minimumStart = new Date(value).getTime() + 12 * 60 * 60_000
      const currentStart = new Date(current.starts_at).getTime()
      if (currentStart >= minimumStart) return { ...current, assembly_at: value }
      const shift = minimumStart - currentStart
      return { ...current, assembly_at: value, starts_at: localDateTime(new Date(minimumStart)), ends_at: localDateTime(new Date(new Date(current.ends_at).getTime() + shift)), disassembly_at: localDateTime(new Date(new Date(current.disassembly_at).getTime() + shift)) }
    })
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); const timeline = [form.assembly_at, form.starts_at, form.ends_at, form.disassembly_at].map((value) => new Date(value).getTime())
    if (!(timeline[0] <= timeline[1] && timeline[1] <= timeline[2] && timeline[2] <= timeline[3])) { setError('A ordem deve ser: montagem, início, término e desmontagem.'); return }
    setSaving(true)
    try {
      const normalized: EventInput = { ...form, name: form.name.trim().toLocaleUpperCase('pt-BR'), event_type: form.event_type.trim().toLocaleUpperCase('pt-BR'), assembly_at: new Date(form.assembly_at).toISOString(), starts_at: new Date(form.starts_at).toISOString(), ends_at: new Date(form.ends_at).toISOString(), disassembly_at: new Date(form.disassembly_at).toISOString(), venue: form.venue?.trim().toLocaleUpperCase('pt-BR') || null, address: form.address?.trim().toLocaleUpperCase('pt-BR') || null, local_contact: form.local_contact?.trim().toLocaleUpperCase('pt-BR') || null, value: Number(form.value), additional_costs: Number(form.additional_costs), notes: form.notes?.trim().toLocaleUpperCase('pt-BR') || null }
      const saved = await saveEvent(normalized, editingId); setEvents((current) => (editingId ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved]).sort((a, b) => a.assembly_at.localeCompare(b.assembly_at))); setFormOpen(false)
    } catch (reason) { setError(errorMessage(reason)) } finally { setSaving(false) }
  }

  return <><div className="title-row clients-title"><div><h1>Eventos</h1><p>Planejamento comercial e operacional por período.</p></div><button className="primary" onClick={openNew} disabled={clients.length === 0}><Plus size={17} /> Novo evento</button></div>
    {clients.length === 0 && !loading ? <div className="data-error">Cadastre um cliente antes de criar o primeiro evento.</div> : null}{error && !formOpen ? <div className="data-error" role="alert">{error}</div> : null}
    <section className="panel clients-panel"><div className="clients-toolbar"><label className="clients-search"><Search size={17} /><input aria-label="Buscar eventos" placeholder="Buscar por evento, cliente, local ou status" value={search} onChange={(e) => setSearch(e.target.value)} /></label><span>{events.length} {events.length === 1 ? 'evento cadastrado' : 'eventos cadastrados'}</span></div>
      {loading ? <p className="empty-state">Carregando eventos…</p> : filtered.length === 0 ? <div className="clients-empty"><CalendarDays /><strong>Nenhum evento encontrado</strong><p>{events.length === 0 ? 'Cadastre o primeiro evento desta empresa.' : 'Tente buscar por outro termo.'}</p>{events.length === 0 && clients.length > 0 ? <button className="primary" onClick={openNew}><Plus size={16} /> Cadastrar evento</button> : null}</div> : <div className="table-wrap"><table className="clients-table events-table"><thead><tr><th>Evento</th><th>Empresa</th><th>Cliente</th><th>Datas operacionais</th><th>Local</th><th>Status</th><th aria-label="Ações" /></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><small>{item.event_type}</small></td><td>{item.organization_name}</td><td>{item.client_name}</td><td><div className="event-dates"><span><small>Montagem</small><strong>{new Date(item.assembly_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</strong></span><span><small>Evento</small><strong>{new Date(item.starts_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</strong></span><span><small>Encerramento</small><strong>{new Date(item.ends_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</strong></span><span><small>Desmontagem</small><strong>{new Date(item.disassembly_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</strong></span></div></td><td>{item.venue || item.address || '—'}</td><td><span className={`event-status event-status--${item.status.toLocaleLowerCase('pt-BR')}`}>{statuses.find(([status]) => status === item.status)?.[1] ?? item.status}</span></td><td><div className="row-actions"><button className="icon-action" title={['CONFIRMADO', 'EM_ANDAMENTO'].includes(item.status) ? 'Gerenciar equipamentos' : 'Confirme o evento para selecionar equipamentos'} aria-label={`Gerenciar equipamentos de ${item.name}`} disabled={!['CONFIRMADO', 'EM_ANDAMENTO'].includes(item.status)} onClick={() => setReservationEvent(item)}><CalendarPlus size={15} /></button><button className="icon-action" aria-label={`Editar ${item.name}`} onClick={() => openEdit(item)}><Pencil size={15} /></button></div></td></tr>)}</tbody></table></div>}
    </section>
    <section className="event-legend" aria-labelledby="event-status-legend"><h2 id="event-status-legend">O que significa cada status?</h2><div>{statusLegend.map(([status, label, description]) => <article key={status}><span className={`event-status event-status--${status.toLocaleLowerCase('pt-BR')}`}>{label}</span><p>{description}</p></article>)}</div></section>
    {reservationEvent ? <EventEquipmentModal event={reservationEvent} onClose={() => setReservationEvent(undefined)} /> : null}
    {formOpen ? <div className="modal-backdrop"><section className="client-modal event-modal" role="dialog" aria-modal="true" aria-labelledby="event-form-title"><header><div><span><CalendarDays /></span><div><h2 id="event-form-title">{editingId ? 'Editar evento' : 'Novo evento'}</h2><p>Datas e horários serão usados para verificar disponibilidade.</p></div></div><button aria-label="Fechar" onClick={() => setFormOpen(false)}><X /></button></header><form className="uppercase-fields" onSubmit={submit}>{error ? <div className="data-error" role="alert">{error}</div> : null}<div className="form-grid">
      <label className="field field--full">Nome do evento<input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toLocaleUpperCase('pt-BR') })} /></label><label className="field">Cliente<select required value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></label><label className="field">Tipo<select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })}>{types.map((type) => <option key={type}>{type}</option>)}</select></label>
      <label className="field">Montagem<input type="datetime-local" required value={form.assembly_at} onChange={(e) => changeAssembly(e.target.value)} /></label><label className="field">Início do evento <small>SUGESTÃO AUTOMÁTICA: 12 HORAS APÓS A MONTAGEM</small><input type="datetime-local" required value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></label><label className="field">Término do evento<input type="datetime-local" required value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></label><label className="field">Desmontagem concluída<input type="datetime-local" required value={form.disassembly_at} onChange={(e) => setForm({ ...form, disassembly_at: e.target.value })} /></label>
      <label className="field">Local / espaço<input value={form.venue ?? ''} onChange={(e) => setForm({ ...form, venue: e.target.value.toLocaleUpperCase('pt-BR') })} /></label><label className="field">Contato no local<input value={form.local_contact ?? ''} onChange={(e) => setForm({ ...form, local_contact: e.target.value.toLocaleUpperCase('pt-BR') })} /></label><label className="field field--full">Endereço<input value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value.toLocaleUpperCase('pt-BR') })} /></label>
      <label className="field">Valor do evento (R$)<input type="number" min="0" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} /></label><label className="field">Custos adicionais (R$)<input type="number" min="0" step="0.01" value={form.additional_costs} onChange={(e) => setForm({ ...form, additional_costs: Number(e.target.value) })} /></label><label className="field">Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as EventStatus })}>{statuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="field field--full">Observações<textarea rows={3} value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value.toLocaleUpperCase('pt-BR') })} /></label>
    </div><footer><button type="button" className="secondary" onClick={() => setFormOpen(false)}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Cadastrar evento'}</button></footer></form></section></div> : null}</>
}
