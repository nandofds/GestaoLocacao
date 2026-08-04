import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ClipboardCheck, QrCode, RotateCcw, ScanLine } from 'lucide-react'
import { listSeparationEvents, loadEventSeparation, scanSeparationItem, undoSeparationCheck, type SeparationItem } from '../lib/separation'
import type { RentalEvent } from '../lib/events'

const message = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir a operação.'

export function SeparationPage() {
  const [events, setEvents] = useState<RentalEvent[]>([]); const [eventId, setEventId] = useState(''); const [items, setItems] = useState<SeparationItem[]>([])
  const [code, setCode] = useState(''); const [loading, setLoading] = useState(true); const [checking, setChecking] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { let active = true; void listSeparationEvents().then((data) => { if (active) { setEvents(data); setEventId(data[0]?.id ?? '') } }).catch((reason: unknown) => { if (active) setError(message(reason)) }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [])
  useEffect(() => { if (!eventId) { setItems([]); return }; let active = true; setLoading(true); setError(''); void loadEventSeparation(eventId).then((data) => { if (active) setItems(data) }).catch((reason: unknown) => { if (active) setError(message(reason)) }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [eventId])

  const selectedEvent = events.find((event) => event.id === eventId); const checkedCount = items.filter((item) => item.checked_id).length; const progress = items.length ? Math.round(checkedCount / items.length * 100) : 0
  const orderedItems = useMemo(() => [...items].sort((a, b) => Number(Boolean(a.checked_id)) - Number(Boolean(b.checked_id)) || a.internal_code.localeCompare(b.internal_code, 'pt-BR')), [items])
  async function refresh() { if (eventId) setItems(await loadEventSeparation(eventId)) }
  async function submit(event: FormEvent) { event.preventDefault(); if (!eventId || !code.trim()) return; setChecking(true); setError(''); setSuccess(''); try { await scanSeparationItem(eventId, code); const scanned = code.trim().toLocaleUpperCase('pt-BR'); setCode(''); await refresh(); setSuccess(`${scanned} conferido com sucesso.`) } catch (reason) { setError(message(reason)) } finally { setChecking(false); inputRef.current?.focus() } }
  async function undo(checkId: string) { setChecking(true); setError(''); try { await undoSeparationCheck(checkId); await refresh() } catch (reason) { setError(message(reason)) } finally { setChecking(false); inputRef.current?.focus() } }

  return <><div className="title-row clients-title"><div><h1>Separação</h1><p>Conferência dos equipamentos reservados antes da saída.</p></div></div>
    <section className="separation-event panel"><label className="field">Evento<select value={eventId} onChange={(event) => { setEventId(event.target.value); setSuccess(''); setError('') }}><option value="">Selecione um evento</option>{events.map((event) => <option value={event.id} key={event.id}>{event.name} · {new Date(event.starts_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</option>)}</select></label>{selectedEvent ? <div><strong>{selectedEvent.client_name}</strong><span>{selectedEvent.venue || selectedEvent.address || 'LOCAL NÃO INFORMADO'}</span><small>Montagem: {new Date(selectedEvent.assembly_at).toLocaleString('pt-BR')}</small></div> : null}</section>
    {error ? <div className="data-error" role="alert">{error}</div> : null}{success ? <div className="data-success"><Check /> {success}</div> : null}
    {!loading && events.length === 0 ? <div className="clients-empty panel"><ClipboardCheck /><strong>Nenhum evento disponível para separação</strong><p>Crie um evento ativo e reserve seus equipamentos.</p></div> : eventId ? <>
      <section className="separation-progress"><article><ClipboardCheck /><span><strong>{checkedCount} de {items.length}</strong><small>equipamentos conferidos</small></span></article><div><span><strong>{progress}%</strong><small>{progress === 100 && items.length > 0 ? 'Separação completa' : 'Separação em andamento'}</small></span><div className="progress"><i style={{ width: `${progress}%` }} /></div></div></section>
      <form className="separation-scanner" onSubmit={(event) => void submit(event)}><ScanLine /><label><strong>Ler ou digitar QR Code</strong><input ref={inputRef} autoFocus autoComplete="off" placeholder="APONTE O LEITOR OU DIGITE O CÓDIGO" value={code} onChange={(event) => setCode(event.target.value.toLocaleUpperCase('pt-BR'))} /></label><button className="primary" disabled={checking || !code.trim()}><QrCode /> {checking ? 'Conferindo…' : 'Conferir item'}</button></form>
      <section className="panel separation-list"><header><h2>Equipamentos da reserva</h2><span>{items.length - checkedCount} pendentes</span></header>{loading ? <p className="empty-state">Carregando reserva…</p> : items.length === 0 ? <div className="clients-empty"><ClipboardCheck /><strong>Evento sem equipamentos reservados</strong><p>Volte a Eventos e adicione os equipamentos.</p></div> : <div>{orderedItems.map((item) => <article className={item.checked_id ? 'separation-item separation-item--checked' : 'separation-item'} key={item.reservation_id}><span className="separation-state">{item.checked_id ? <Check /> : <QrCode />}</span><div><strong>{item.internal_code} · {item.description}</strong><small>{item.category_name}</small></div><em>{item.checked_at ? `Conferido às ${new Date(item.checked_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Pendente'}</em>{item.checked_id ? <button disabled={checking} onClick={() => void undo(item.checked_id!)}><RotateCcw /> Desfazer</button> : null}</article>)}</div>}</section>
    </> : null}</>
}
