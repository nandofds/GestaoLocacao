import { type FormEvent, useEffect, useState } from 'react'
import { AlertTriangle, Check, PackageCheck, Truck } from 'lucide-react'
import { finishCollection, listCollectionEvents, loadCollection, scanCollection, type CollectionDetails } from '../lib/returnCollection'
import type { RentalEvent } from '../lib/events'
import { QrCameraScanner } from './QrCameraScanner'

const message = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir a operação.'

export function ReturnCollectionPage({ initialEventId = '' }: { initialEventId?: string }) {
  const [events, setEvents] = useState<RentalEvent[]>([])
  const [eventId, setEventId] = useState(initialEventId)
  const [details, setDetails] = useState<CollectionDetails>()
  const [code, setCode] = useState('')
  const [damage, setDamage] = useState(false)
  const [damageNotes, setDamageNotes] = useState('')
  const [responsible, setResponsible] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const selected = events.find((event) => event.id === eventId)
  const checked = details?.items.filter((item) => item.checked).length ?? 0
  const total = details?.items.length ?? 0
  const incomplete = checked < total

  async function refresh(event = selected) { if (event) setDetails(await loadCollection(event)) }

  useEffect(() => {
    let active = true
    void listCollectionEvents().then((data) => { if (active) { setEvents(data); setEventId((value) => value || data[0]?.id || '') } }).catch((reason: unknown) => { if (active) setError(message(reason)) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selected) return
    let active = true
    void loadCollection(selected).then((data) => { if (active) { setDetails(data); setResponsible(data.collaborators[0]?.id ?? '') } }).catch((reason: unknown) => { if (active) setError(message(reason)) })
    return () => { active = false }
  }, [selected])

  async function scan(event: FormEvent) {
    event.preventDefault(); if (!selected || !code.trim()) return
    setSaving(true); setError(''); setSuccess('')
    try { await scanCollection(selected.id, code, damage, damageNotes); setCode(''); setDamage(false); setDamageNotes(''); await refresh(); setSuccess('Item adicionado à carga.') }
    catch (reason) { setError(message(reason)) } finally { setSaving(false) }
  }

  async function finish() {
    if (!selected) return
    setSaving(true); setError(''); setSuccess('')
    try { await finishCollection(selected.id, responsible, notes, incomplete); await refresh(); setSuccess('Carga de retorno fechada.') }
    catch (reason) { setError(message(reason)) } finally { setSaving(false) }
  }

  return <>
    <div className="title-row"><div><h1>Coleta no evento</h1><p>Conferência dos equipamentos carregados para retorno.</p></div></div>
    <section className="separation-event panel"><label className="field">Evento<select value={eventId} onChange={(event) => setEventId(event.target.value)}><option value="">Selecione</option>{events.map((event) => <option value={event.id} key={event.id}>{event.name}</option>)}</select></label>{selected ? <div><strong>{selected.name}</strong><span>{selected.venue || selected.address || 'Local não informado'}</span></div> : null}</section>
    {error ? <div className="data-error" role="alert">{error}</div> : null}{success ? <div className="data-success"><Check />{success}</div> : null}
    {selected && details ? details.movement ? <section className="panel return-complete"><Truck /><h2>Carga fechada</h2><p>{details.movement.confirmation}</p><strong>{checked} itens carregados</strong></section> : <>
      <section className="separation-progress"><article><PackageCheck /><span><strong>{checked} de {total}</strong><small>itens carregados</small></span></article></section>
      <form className="return-scanner-form collection-scanner" onSubmit={scan}><label className="field">QR ou código<input required value={code} onChange={(event) => setCode(event.target.value.toLocaleUpperCase('pt-BR'))} placeholder="LEIA OU DIGITE O CÓDIGO" /></label><QrCameraScanner onDetected={(value) => setCode(value.toLocaleUpperCase('pt-BR'))} /><label className="field collection-damage"><span><input type="checkbox" checked={damage} onChange={(event) => setDamage(event.target.checked)} /> Dano aparente</span></label>{damage ? <label className="field">Descrição do dano<input required value={damageNotes} onChange={(event) => setDamageNotes(event.target.value.toLocaleUpperCase('pt-BR'))} /></label> : null}<button className="primary" disabled={saving || !code.trim()}>Adicionar à carga</button></form>
      <section className="panel separation-list"><header><h2>Itens da saída</h2><span>{total - checked} faltando</span></header><div>{details.items.map((item) => <article className={item.checked ? 'separation-item separation-item--checked' : 'separation-item'} key={item.item_id}><span className="separation-state">{item.apparent_damage ? <AlertTriangle /> : item.checked ? <Check /> : '!'}</span><div><strong>{item.internal_code} · {item.description}</strong><small>{item.damage_notes || 'Sem dano aparente'}</small></div><em>{item.checked ? 'Carregado' : 'Pendente'}</em></article>)}</div></section>
      <section className="panel return-finalize"><label className="field">Responsável<select value={responsible} onChange={(event) => setResponsible(event.target.value)}><option value="">Selecione</option>{details.collaborators.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select></label><label className="field">{incomplete ? 'Justificativa obrigatória' : 'Observações'}<input required={incomplete} value={notes} onChange={(event) => setNotes(event.target.value.toLocaleUpperCase('pt-BR'))} /></label><button className="primary" disabled={!responsible || saving || (incomplete && !notes.trim())} onClick={() => void finish()}><Truck />Fechar {incomplete ? 'carga incompleta' : 'carga'}</button></section>
    </> : null}
  </>
}
