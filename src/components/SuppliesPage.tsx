import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, PackagePlus, Pencil, Plus, Search, Tag, X } from 'lucide-react'
import { createCategory, type Category } from '../lib/equipment'
import { loadSupplies, saveSupply, type Supply, type SupplyInput } from '../lib/supplies'

const units = ['UN', 'CAIXA', 'PACOTE', 'ROLO', 'METRO', 'KG', 'LITRO']
const emptySupply: SupplyInput = { name: '', category_id: null, unit: 'UN', current_balance: 0, minimum_stock: 0, unit_cost: 0 }
const errorMessage = (error: unknown) => error instanceof Error ? error.message : error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : 'Não foi possível concluir a operação.'

export function SuppliesPage() {
  const [supplies, setSupplies] = useState<Supply[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [activeOrganizationId, setActiveOrganizationId] = useState('')
  const [formOrganizationId, setFormOrganizationId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string>()
  const [form, setForm] = useState<SupplyInput>(emptySupply)
  const [categoryName, setCategoryName] = useState('')

  async function refresh() {
    const data = await loadSupplies()
    setSupplies(data.supplies); setCategories(data.categories); setActiveOrganizationId(data.activeOrganizationId)
  }

  useEffect(() => {
    let active = true
    void loadSupplies().then((data) => { if (active) { setSupplies(data.supplies); setCategories(data.categories); setActiveOrganizationId(data.activeOrganizationId) } }).catch((reason: unknown) => { if (active) setError(errorMessage(reason)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    return term ? supplies.filter((supply) => [supply.name, supply.category_name, supply.organization_name, supply.unit].some((value) => value.toLocaleLowerCase('pt-BR').includes(term))) : supplies
  }, [search, supplies])
  const formCategories = categories.filter((category) => category.organization_id === formOrganizationId)
  const alerts = supplies.filter((supply) => supply.current_balance <= supply.minimum_stock).length
  const canManageFormOrganization = formOrganizationId === activeOrganizationId

  function openNew() { setEditingId(undefined); setFormOrganizationId(activeOrganizationId); setForm({ ...emptySupply, category_id: categories.find((category) => category.organization_id === activeOrganizationId)?.id ?? null }); setError(''); setFormOpen(true) }
  function openEdit(supply: Supply) { setEditingId(supply.id); setFormOrganizationId(supply.organization_id); setForm({ name: supply.name, category_id: supply.category_id, unit: supply.unit, current_balance: supply.current_balance, minimum_stock: supply.minimum_stock, unit_cost: supply.unit_cost }); setError(''); setFormOpen(true) }

  async function addCategory() {
    if (!categoryName.trim()) return
    setSaving(true); setError('')
    try { const category = await createCategory(categoryName); setFormOrganizationId(category.organization_id); setCategories((current) => [...current.filter((item) => item.id !== category.id), category].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))); setForm((current) => ({ ...current, category_id: category.id })); setCategoryName('') } catch (reason) { setError(errorMessage(reason)) } finally { setSaving(false) }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    try { await saveSupply({ ...form, name: form.name.trim().toLocaleUpperCase('pt-BR'), unit: form.unit.toLocaleUpperCase('pt-BR'), current_balance: Number(form.current_balance), minimum_stock: Number(form.minimum_stock), unit_cost: Number(form.unit_cost) }, editingId); await refresh(); setFormOpen(false) } catch (reason) { setError(errorMessage(reason)) } finally { setSaving(false) }
  }

  return <>
    <div className="title-row clients-title"><div><h1>Estoque de insumos</h1><p>Consumíveis controlados por saldo. Saem e não retornam.</p></div><button className="primary" onClick={openNew}><Plus size={17} /> Novo insumo</button></div>
    {error && !formOpen ? <div className="data-error" role="alert">{error}</div> : null}
    <section className="supply-summary"><article><PackagePlus /><span><strong>{supplies.length}</strong><small>insumos cadastrados</small></span></article><article className={alerts ? 'supply-alert' : ''}><AlertTriangle /><span><strong>{alerts}</strong><small>abaixo ou no mínimo</small></span></article></section>
    <section className="panel clients-panel"><div className="clients-toolbar"><label className="clients-search"><Search size={17} /><input aria-label="Buscar insumos" placeholder="Buscar por nome, categoria, unidade ou empresa" value={search} onChange={(event) => setSearch(event.target.value)} /></label><span>{filtered.length} exibidos</span></div>
      {loading ? <p className="empty-state">Carregando insumos…</p> : filtered.length === 0 ? <div className="clients-empty"><PackagePlus /><strong>Nenhum insumo encontrado</strong><p>Cadastre o primeiro consumível desta empresa.</p><button className="primary" onClick={openNew}><Plus size={16} /> Cadastrar insumo</button></div> : <div className="table-wrap"><table className="clients-table"><thead><tr><th>Insumo</th><th>Empresa</th><th>Categoria</th><th>Saldo atual</th><th>Estoque mínimo</th><th>Custo unitário</th><th>Situação</th><th aria-label="Ações" /></tr></thead><tbody>{filtered.map((supply) => { const low = supply.current_balance <= supply.minimum_stock; return <tr key={supply.id}><td><strong>{supply.name}</strong></td><td>{supply.organization_name}</td><td>{supply.category_name}</td><td><strong>{supply.current_balance.toLocaleString('pt-BR')} {supply.unit}</strong></td><td>{supply.minimum_stock.toLocaleString('pt-BR')} {supply.unit}</td><td>{supply.unit_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td><span className={low ? 'stock-state stock-state--low' : 'stock-state'}>{low ? 'Repor estoque' : 'Normal'}</span></td><td><button className="icon-action" aria-label={`Editar ${supply.name}`} onClick={() => openEdit(supply)}><Pencil size={15} /></button></td></tr> })}</tbody></table></div>}
    </section>
    {formOpen ? <div className="modal-backdrop"><section className="client-modal" role="dialog" aria-modal="true" aria-labelledby="supply-form-title"><header><div><span><PackagePlus /></span><div><h2 id="supply-form-title">{editingId ? 'Editar insumo' : 'Novo insumo'}</h2><p>Saldo consumível, sem conferência de retorno.</p></div></div><button aria-label="Fechar" onClick={() => setFormOpen(false)}><X /></button></header><form className="uppercase-fields" onSubmit={submit}>{error ? <div className="data-error" role="alert">{error}</div> : null}<div className="category-creator"><Tag size={16} /><select aria-label="Categoria" value={form.category_id ?? ''} onChange={(event) => setForm({ ...form, category_id: event.target.value || null })}><option value="">SEM CATEGORIA</option>{formCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div><div className="inline-category"><input aria-label="Nova categoria" placeholder={canManageFormOrganization ? 'NOVA CATEGORIA PARA ESTA EMPRESA' : 'TROQUE PARA A EMPRESA DO INSUMO'} disabled={!canManageFormOrganization} value={categoryName} onChange={(event) => setCategoryName(event.target.value.toLocaleUpperCase('pt-BR'))} /><button type="button" className="secondary" disabled={!canManageFormOrganization || saving || !categoryName.trim()} onClick={() => void addCategory()}>Adicionar categoria</button></div><div className="form-grid"><label className="field field--full">Nome do insumo<input autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value.toLocaleUpperCase('pt-BR') })} /></label><label className="field">Unidade<select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></label><label className="field">Saldo atual<input type="number" min="0" step="0.001" required value={form.current_balance} onChange={(event) => setForm({ ...form, current_balance: Number(event.target.value) })} /></label><label className="field">Estoque mínimo<input type="number" min="0" step="0.001" required value={form.minimum_stock} onChange={(event) => setForm({ ...form, minimum_stock: Number(event.target.value) })} /></label><label className="field">Custo unitário (R$)<input type="number" min="0" step="0.01" required value={form.unit_cost} onChange={(event) => setForm({ ...form, unit_cost: Number(event.target.value) })} /></label></div><footer><button type="button" className="secondary" onClick={() => setFormOpen(false)}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Cadastrar insumo'}</button></footer></form></section></div> : null}
  </>
}
