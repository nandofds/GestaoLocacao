import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { BadgeDollarSign, Pencil, Plus, Search, UserRoundCheck, UsersRound, X } from 'lucide-react'
import { listCollaborators, saveCollaborator, type Collaborator, type CollaboratorInput, type EmploymentType } from '../lib/collaborators'
import { formatCpf, formatPhone, normalizeCpf, normalizePhone } from '../lib/inputMasks'

const roles = ['TÉCNICO DE SOM', 'MONTADOR', 'MOTORISTA', 'AUXILIAR', 'ELETRICISTA', 'OPERADOR DE ILUMINAÇÃO', 'RESPONSÁVEL DE ESTOQUE', 'COORDENADOR']
const employmentTypes: Array<[EmploymentType, string]> = [['CLT', 'CLT'], ['PJ', 'PJ'], ['FREELANCER', 'Freelancer'], ['DIARISTA', 'Diarista'], ['OUTRO', 'Outro']]
const emptyForm: CollaboratorInput = { name: '', cpf: null, phone: null, job_role: roles[0], employment_type: 'FREELANCER', availability: null, skills: [], daily_rate: 0, active: true, notes: null }
const errorMessage = (error: unknown) => error instanceof Error ? error.message : error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : 'Não foi possível concluir a operação.'

export function CollaboratorsPage() {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string>()
  const [form, setForm] = useState<CollaboratorInput>(emptyForm)
  const [skillsText, setSkillsText] = useState('')

  async function refresh() { setCollaborators(await listCollaborators()) }
  useEffect(() => { let active = true; void listCollaborators().then((data) => { if (active) setCollaborators(data) }).catch((reason: unknown) => { if (active) setError(errorMessage(reason)) }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    return term ? collaborators.filter((person) => [person.name, person.job_role, person.organization_name, person.phone, ...person.skills].some((value) => value?.toLocaleLowerCase('pt-BR').includes(term))) : collaborators
  }, [collaborators, search])
  const activeCount = collaborators.filter((person) => person.active).length

  function openNew() { setEditingId(undefined); setForm(emptyForm); setSkillsText(''); setError(''); setFormOpen(true) }
  function openEdit(person: Collaborator) { setEditingId(person.id); setForm({ name: person.name, cpf: person.cpf, phone: person.phone, job_role: person.job_role, employment_type: person.employment_type, availability: person.availability, skills: person.skills, daily_rate: person.daily_rate, active: person.active, notes: person.notes }); setSkillsText(person.skills.join(', ')); setError(''); setFormOpen(true) }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const normalized: CollaboratorInput = { ...form, name: form.name.trim().toLocaleUpperCase('pt-BR'), cpf: form.cpf ? normalizeCpf(form.cpf) || null : null, phone: form.phone ? normalizePhone(form.phone) || null : null, job_role: form.job_role.trim().toLocaleUpperCase('pt-BR'), availability: form.availability?.trim().toLocaleUpperCase('pt-BR') || null, skills: skillsText.split(',').map((skill) => skill.trim().toLocaleUpperCase('pt-BR')).filter(Boolean), daily_rate: Number(form.daily_rate), notes: form.notes?.trim().toLocaleUpperCase('pt-BR') || null }
      await saveCollaborator(normalized, editingId); await refresh(); setFormOpen(false)
    } catch (reason) { setError(errorMessage(reason)) } finally { setSaving(false) }
  }

  return <>
    <div className="title-row clients-title"><div><h1>Colaboradores</h1><p>Equipe operacional, funções, habilidades e valores de diária.</p></div><button className="primary" onClick={openNew}><Plus size={17} /> Novo colaborador</button></div>
    {error && !formOpen ? <div className="data-error" role="alert">{error}</div> : null}
    <section className="supply-summary"><article><UsersRound /><span><strong>{collaborators.length}</strong><small>colaboradores cadastrados</small></span></article><article><UserRoundCheck /><span><strong>{activeCount}</strong><small>cadastros ativos</small></span></article></section>
    <section className="panel clients-panel"><div className="clients-toolbar"><label className="clients-search"><Search size={17} /><input aria-label="Buscar colaboradores" placeholder="Buscar por nome, função, habilidade ou empresa" value={search} onChange={(event) => setSearch(event.target.value)} /></label><span>{filtered.length} exibidos</span></div>
      {loading ? <p className="empty-state">Carregando colaboradores…</p> : filtered.length === 0 ? <div className="clients-empty"><UsersRound /><strong>Nenhum colaborador encontrado</strong><p>Cadastre a primeira pessoa da equipe.</p><button className="primary" onClick={openNew}><Plus size={16} /> Cadastrar colaborador</button></div> : <div className="table-wrap"><table className="clients-table"><thead><tr><th>Colaborador</th><th>Empresa</th><th>Função</th><th>Contato</th><th>Habilidades</th><th>Diária</th><th>Status</th><th aria-label="Ações" /></tr></thead><tbody>{filtered.map((person) => <tr key={person.id}><td><strong>{person.name}</strong><small>{person.employment_type}</small></td><td>{person.organization_name}</td><td>{person.job_role}</td><td>{person.phone ? formatPhone(person.phone) : '—'}</td><td>{person.skills.join(', ') || '—'}</td><td>{person.daily_rate.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td><span className={person.active ? 'stock-state' : 'stock-state stock-state--inactive'}>{person.active ? 'Ativo' : 'Inativo'}</span></td><td><button className="icon-action" aria-label={`Editar ${person.name}`} onClick={() => openEdit(person)}><Pencil size={15} /></button></td></tr>)}</tbody></table></div>}
    </section>
    {formOpen ? <div className="modal-backdrop"><section className="client-modal" role="dialog" aria-modal="true" aria-labelledby="collaborator-form-title"><header><div><span><UsersRound /></span><div><h2 id="collaborator-form-title">{editingId ? 'Editar colaborador' : 'Novo colaborador'}</h2><p>Informações usadas na operação e nas futuras escalas.</p></div></div><button aria-label="Fechar" onClick={() => setFormOpen(false)}><X /></button></header><form className="uppercase-fields" onSubmit={submit}>{error ? <div className="data-error" role="alert">{error}</div> : null}<div className="form-grid"><label className="field field--full">Nome completo<input autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value.toLocaleUpperCase('pt-BR') })} /></label><label className="field">CPF<input inputMode="numeric" maxLength={14} value={formatCpf(form.cpf ?? '')} onChange={(event) => setForm({ ...form, cpf: normalizeCpf(event.target.value) })} /></label><label className="field">Telefone<input type="tel" inputMode="tel" maxLength={15} value={formatPhone(form.phone ?? '')} onChange={(event) => setForm({ ...form, phone: normalizePhone(event.target.value) })} /></label><label className="field">Função<select value={form.job_role} onChange={(event) => setForm({ ...form, job_role: event.target.value })}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label><label className="field">Contratação<select value={form.employment_type} onChange={(event) => setForm({ ...form, employment_type: event.target.value as EmploymentType })}>{employmentTypes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="field field--full">Disponibilidade<input placeholder="EX.: SEGUNDA A SÁBADO, NOTURNO" value={form.availability ?? ''} onChange={(event) => setForm({ ...form, availability: event.target.value.toLocaleUpperCase('pt-BR') })} /></label><label className="field field--full">Habilidades<input placeholder="SEPARE POR VÍRGULAS" value={skillsText} onChange={(event) => setSkillsText(event.target.value.toLocaleUpperCase('pt-BR'))} /></label><label className="field"><BadgeDollarSign size={14} /> Valor da diária (R$)<input type="number" min="0" step="0.01" required value={form.daily_rate} onChange={(event) => setForm({ ...form, daily_rate: Number(event.target.value) })} /></label><label className="field checkbox-field"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Cadastro ativo</label><label className="field field--full">Observações<textarea rows={3} value={form.notes ?? ''} onChange={(event) => setForm({ ...form, notes: event.target.value.toLocaleUpperCase('pt-BR') })} /></label></div><footer><button type="button" className="secondary" onClick={() => setFormOpen(false)}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Cadastrar colaborador'}</button></footer></form></section></div> : null}
  </>
}
