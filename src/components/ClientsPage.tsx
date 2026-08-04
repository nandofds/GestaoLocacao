import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Building2, Pencil, Plus, Search, UserRound, X } from 'lucide-react'
import { listClients, saveClient, type Client, type ClientInput } from '../lib/clients'
import { formatPhone, formatTaxId, normalizePhone, normalizeTaxId } from '../lib/inputMasks'

const emptyForm: ClientInput = {
  name: '', person_type: 'PF', tax_id: '', phone: '', whatsapp: '', email: '',
  address: '', contact_name: '', notes: '',
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Não foi possível concluir a operação.'
}

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | undefined>()
  const [form, setForm] = useState<ClientInput>(emptyForm)
  const [formOpen, setFormOpen] = useState(false)

  useEffect(() => {
    let active = true
    void listClients().then((data) => {
      if (active) setClients(data)
    }).catch((reason: unknown) => {
      if (active) setError(errorMessage(reason))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  const filteredClients = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    if (!term) return clients
    return clients.filter((client) => [client.name, client.tax_id, client.email, client.phone]
      .some((value) => value?.toLocaleLowerCase('pt-BR').includes(term)))
  }, [clients, search])

  function openNew() {
    setEditingId(undefined)
    setForm(emptyForm)
    setError('')
    setFormOpen(true)
  }

  function openEdit(client: Client) {
    setEditingId(client.id)
    setForm({
      name: client.name, person_type: client.person_type, tax_id: client.tax_id ?? '',
      phone: client.phone ?? '', whatsapp: client.whatsapp ?? '', email: client.email ?? '',
      address: client.address ?? '', contact_name: client.contact_name ?? '', notes: client.notes ?? '',
    })
    setError('')
    setFormOpen(true)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const normalized = Object.fromEntries(Object.entries(form).map(([key, value]) => [
        key, typeof value === 'string' && key !== 'name' && key !== 'person_type' ? value.trim() || null : value,
      ])) as ClientInput
      normalized.name = form.name.trim()
      normalized.tax_id = form.tax_id ? normalizeTaxId(form.tax_id, form.person_type) || null : null
      normalized.phone = form.phone ? normalizePhone(form.phone) || null : null
      normalized.whatsapp = form.whatsapp ? normalizePhone(form.whatsapp) || null : null
      const saved = await saveClient(normalized, editingId)
      setClients((current) => (editingId
        ? current.map((client) => client.id === saved.id ? saved : client)
        : [...current, saved]).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
      setFormOpen(false)
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setSaving(false)
    }
  }

  return <>
    <div className="title-row clients-title"><div><h1>Clientes</h1><p>Cadastros comerciais da empresa ativa.</p></div><button className="primary" onClick={openNew}><Plus size={17} /> Novo cliente</button></div>
    {error && !formOpen ? <div className="data-error" role="alert">{error}</div> : null}
    <section className="panel clients-panel">
      <div className="clients-toolbar">
        <label className="clients-search"><Search size={17} /><input aria-label="Buscar clientes" placeholder="Buscar por nome, documento, e-mail ou telefone" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <span>{clients.length} {clients.length === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}</span>
      </div>
      {loading ? <p className="empty-state">Carregando clientes…</p> : filteredClients.length === 0 ? <div className="clients-empty"><UserRound /><strong>{clients.length === 0 ? 'Nenhum cliente cadastrado' : 'Nenhum cliente encontrado'}</strong><p>{clients.length === 0 ? 'Cadastre o primeiro cliente desta empresa.' : 'Tente buscar por outro termo.'}</p>{clients.length === 0 ? <button className="primary" onClick={openNew}><Plus size={16} /> Cadastrar cliente</button> : null}</div> : <div className="table-wrap"><table className="clients-table"><thead><tr><th>Cliente</th><th>Empresa</th><th>Tipo</th><th>Documento</th><th>Contato</th><th>E-mail</th><th aria-label="Ações" /></tr></thead><tbody>{filteredClients.map((client) => <tr key={client.id}><td><strong>{client.name}</strong><small>{client.contact_name || 'Sem responsável informado'}</small></td><td>{client.organization_name}</td><td><span className="person-badge">{client.person_type}</span></td><td>{client.tax_id ? formatTaxId(client.tax_id, client.person_type) : '—'}</td><td>{client.whatsapp || client.phone ? formatPhone(client.whatsapp || client.phone || '') : '—'}</td><td>{client.email || '—'}</td><td><button className="icon-action" aria-label={`Editar ${client.name}`} onClick={() => openEdit(client)}><Pencil size={15} /></button></td></tr>)}</tbody></table></div>}
    </section>

    {formOpen ? <div className="modal-backdrop" role="presentation"><section className="client-modal" role="dialog" aria-modal="true" aria-labelledby="client-form-title"><header><div><span><Building2 /></span><div><h2 id="client-form-title">{editingId ? 'Editar cliente' : 'Novo cliente'}</h2><p>Os dados ficarão disponíveis somente na empresa ativa.</p></div></div><button aria-label="Fechar" onClick={() => setFormOpen(false)}><X /></button></header><form onSubmit={submit}>
      {error ? <div className="data-error" role="alert">{error}</div> : null}
      <div className="form-grid"><label className="field field--wide">Nome / razão social<input autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="field">Tipo<select value={form.person_type} onChange={(event) => { const personType = event.target.value as 'PF' | 'PJ'; setForm({ ...form, person_type: personType, tax_id: '' }) }}><option value="PF">Pessoa física</option><option value="PJ">Pessoa jurídica</option></select></label><label className="field">{form.person_type === 'PF' ? 'CPF' : 'CNPJ'}<input inputMode={form.person_type === 'PF' ? 'numeric' : 'text'} maxLength={18} value={formatTaxId(form.tax_id ?? '', form.person_type)} onChange={(event) => setForm({ ...form, tax_id: normalizeTaxId(event.target.value, form.person_type) })} /></label><label className="field">Telefone<input type="tel" inputMode="tel" maxLength={15} value={formatPhone(form.phone ?? '')} onChange={(event) => setForm({ ...form, phone: normalizePhone(event.target.value) })} /></label><label className="field">WhatsApp<input type="tel" inputMode="tel" maxLength={15} value={formatPhone(form.whatsapp ?? '')} onChange={(event) => setForm({ ...form, whatsapp: normalizePhone(event.target.value) })} /></label><label className="field field--wide">E-mail<input type="email" value={form.email ?? ''} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label className="field field--wide">Responsável / contato<input value={form.contact_name ?? ''} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} /></label><label className="field field--full">Endereço<input value={form.address ?? ''} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label><label className="field field--full">Observações<textarea rows={3} value={form.notes ?? ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label></div>
      <footer><button type="button" className="secondary" onClick={() => setFormOpen(false)}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Cadastrar cliente'}</button></footer>
    </form></section></div> : null}
  </>
}
