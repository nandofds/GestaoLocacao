import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Boxes, Pencil, Plus, QrCode, Search, Tag, X } from 'lucide-react'
import { createCategory, loadEquipment, saveEquipment, type Category, type EquipmentInput, type EquipmentItem, type ItemCondition } from '../lib/equipment'

const emptyItem: EquipmentInput = { internal_code: '', qr_value: '', category_id: '', description: '', brand: '', model: '', serial_number: '', storage_location: '', condition: 'BOM', notes: '' }
const conditions: Array<[ItemCondition, string]> = [['OTIMO', 'Ótimo'], ['BOM', 'Bom'], ['REGULAR', 'Regular'], ['DANIFICADO', 'Danificado'], ['EXTRAVIADO', 'Extraviado'], ['BAIXADO', 'Baixado']]
const message = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const failure = error as { message?: string; details?: string; hint?: string; code?: string }
    return [failure.message, failure.details, failure.hint, failure.code ? `Código: ${failure.code}` : ''].filter(Boolean).join(' · ')
  }
  return 'Não foi possível concluir a operação.'
}

export function EquipmentPage() {
  const [items, setItems] = useState<EquipmentItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [activeOrganizationId, setActiveOrganizationId] = useState('')
  const [formOrganizationId, setFormOrganizationId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string>()
  const [form, setForm] = useState<EquipmentInput>(emptyItem)
  const [categoryName, setCategoryName] = useState('')

  async function refresh() {
    const data = await loadEquipment()
    setItems(data.items); setCategories(data.categories); setActiveOrganizationId(data.activeOrganizationId)
  }

  useEffect(() => {
    let active = true
    void loadEquipment().then((data) => { if (active) { setItems(data.items); setCategories(data.categories); setActiveOrganizationId(data.activeOrganizationId) } }).catch((reason: unknown) => { if (active) setError(message(reason)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    return term ? items.filter((item) => [item.internal_code, item.description, item.brand, item.model, item.serial_number, item.category_name, item.organization_name].some((value) => value?.toLocaleLowerCase('pt-BR').includes(term))) : items
  }, [items, search])

  const formCategories = categories.filter((category) => category.organization_id === formOrganizationId)
  const canManageFormOrganization = formOrganizationId === activeOrganizationId

  function openNew() { const firstCategory = categories.find((category) => category.organization_id === activeOrganizationId); setEditingId(undefined); setFormOrganizationId(activeOrganizationId); setForm({ ...emptyItem, category_id: firstCategory?.id ?? '' }); setError(''); setFormOpen(true) }
  function openEdit(item: EquipmentItem) { setEditingId(item.id); setFormOrganizationId(item.organization_id); setForm({ internal_code: item.internal_code, qr_value: item.qr_value, category_id: item.category_id, description: item.description, brand: item.brand ?? '', model: item.model ?? '', serial_number: item.serial_number ?? '', storage_location: item.storage_location ?? '', condition: item.condition, notes: item.notes ?? '' }); setError(''); setFormOpen(true) }

  async function addCategory() {
    if (!categoryName.trim()) return
    setSaving(true); setError('')
    try {
      const category = await createCategory(categoryName)
      setFormOrganizationId(category.organization_id)
      setCategories((current) => [...current.filter((item) => item.id !== category.id), category].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
      setForm((current) => ({ ...current, category_id: category.id }))
      setCategoryName('')
    } catch (reason) { setError(message(reason)) } finally { setSaving(false) }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const upper = (value: string | null | undefined) => value?.trim().toLocaleUpperCase('pt-BR') || null
      const internalCode = form.internal_code.trim().toLocaleUpperCase('pt-BR')
      const normalized = { ...form, internal_code: internalCode, qr_value: upper(form.qr_value) || internalCode, description: form.description.trim().toLocaleUpperCase('pt-BR'), brand: upper(form.brand), model: upper(form.model), serial_number: upper(form.serial_number), storage_location: upper(form.storage_location), notes: upper(form.notes) } as EquipmentInput
      await saveEquipment(normalized, editingId); await refresh(); setFormOpen(false)
    } catch (reason) { setError(message(reason)) } finally { setSaving(false) }
  }

  return <>
    <div className="title-row clients-title"><div><h1>Equipamentos</h1><p>Itens serializados que saem, voltam e ocupam a agenda.</p></div><button className="primary" onClick={openNew}><Plus size={17} /> Novo item</button></div>
    {error && !formOpen ? <div className="data-error" role="alert">{error}</div> : null}
    <section className="panel clients-panel"><div className="clients-toolbar"><label className="clients-search"><Search size={17} /><input aria-label="Buscar equipamentos" placeholder="Buscar por código, descrição, categoria ou série" value={search} onChange={(event) => setSearch(event.target.value)} /></label><span>{items.length} {items.length === 1 ? 'item cadastrado' : 'itens cadastrados'}</span></div>
    {loading ? <p className="empty-state">Carregando equipamentos…</p> : filtered.length === 0 ? <div className="clients-empty"><Boxes /><strong>Nenhum equipamento encontrado</strong><p>Crie uma categoria e cadastre a primeira unidade.</p><button className="primary" onClick={openNew}><Plus size={16} /> Cadastrar item</button></div> : <div className="table-wrap"><table className="clients-table"><thead><tr><th>Código</th><th>Equipamento</th><th>Empresa</th><th>Categoria</th><th>Marca / modelo</th><th>Local</th><th>Condição</th><th aria-label="Ações" /></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.internal_code}</strong></td><td>{item.description}</td><td>{item.organization_name}</td><td>{item.category_name}</td><td>{[item.brand, item.model].filter(Boolean).join(' · ') || '—'}</td><td>{item.storage_location || '—'}</td><td><span className={`condition condition--${item.condition.toLowerCase()}`}>{conditions.find(([value]) => value === item.condition)?.[1]}</span></td><td><button className="icon-action" aria-label={`Editar ${item.internal_code}`} onClick={() => openEdit(item)}><Pencil size={15} /></button></td></tr>)}</tbody></table></div>}</section>
    {formOpen ? <div className="modal-backdrop"><section className="client-modal" role="dialog" aria-modal="true" aria-labelledby="equipment-form-title"><header><div><span><QrCode /></span><div><h2 id="equipment-form-title">{editingId ? 'Editar item' : 'Novo item serializado'}</h2><p>Cada unidade recebe código e QR próprios.</p></div></div><button aria-label="Fechar" onClick={() => setFormOpen(false)}><X /></button></header><form className="uppercase-fields" onSubmit={submit}>{error ? <div className="data-error" role="alert">{error}</div> : null}<div className="category-creator"><Tag size={16} /><select aria-label="Categoria" required value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })}><option value="">Selecione uma categoria</option>{formCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div><div className="inline-category"><input aria-label="Nova categoria" placeholder={canManageFormOrganization ? 'NOVA CATEGORIA PARA ESTA EMPRESA' : 'TROQUE PARA A EMPRESA DO ITEM'} disabled={!canManageFormOrganization} value={categoryName} onChange={(event) => setCategoryName(event.target.value.toLocaleUpperCase('pt-BR'))} /><button type="button" className="secondary" disabled={!canManageFormOrganization || saving || !categoryName.trim()} onClick={() => void addCategory()}>Adicionar categoria</button></div><div className="form-grid"><label className="field">Código interno<input required value={form.internal_code} onChange={(event) => setForm({ ...form, internal_code: event.target.value.toLocaleUpperCase('pt-BR') })} /></label><label className="field">Valor do QR<input placeholder="USA O CÓDIGO SE FICAR VAZIO" value={form.qr_value} onChange={(event) => setForm({ ...form, qr_value: event.target.value.toLocaleUpperCase('pt-BR') })} /></label><label className="field field--full">Descrição<input required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value.toLocaleUpperCase('pt-BR') })} /></label><label className="field">Marca<input value={form.brand ?? ''} onChange={(event) => setForm({ ...form, brand: event.target.value.toLocaleUpperCase('pt-BR') })} /></label><label className="field">Modelo<input value={form.model ?? ''} onChange={(event) => setForm({ ...form, model: event.target.value.toLocaleUpperCase('pt-BR') })} /></label><label className="field">Número de série<input value={form.serial_number ?? ''} onChange={(event) => setForm({ ...form, serial_number: event.target.value.toLocaleUpperCase('pt-BR') })} /></label><label className="field">Local guardado<input value={form.storage_location ?? ''} onChange={(event) => setForm({ ...form, storage_location: event.target.value.toLocaleUpperCase('pt-BR') })} /></label><label className="field">Condição<select value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value as ItemCondition })}>{conditions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="field field--full">Observações<textarea rows={3} value={form.notes ?? ''} onChange={(event) => setForm({ ...form, notes: event.target.value.toLocaleUpperCase('pt-BR') })} /></label></div><footer><button type="button" className="secondary" onClick={() => setFormOpen(false)}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Cadastrar item'}</button></footer></form></section></div> : null}
  </>
}
