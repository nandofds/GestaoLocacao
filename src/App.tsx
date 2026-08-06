import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, ArrowDownToLine, ArrowLeft, ArrowRight, Boxes, CalendarDays,
  Check, ChevronRight, CircleUserRound, ClipboardCheck, Clock3, Cloud,
  CloudOff, FolderKanban, Gauge, Headphones, LayoutDashboard, LogOut,
  Menu, PackageCheck, PackageOpen, QrCode, RotateCcw, Search, Settings,
  ShieldCheck, UsersRound, Wrench,
} from 'lucide-react'
import { loadDashboard, type DashboardSnapshot } from './lib/dashboard'
import { enqueue, migrateLegacyQueue, pendingQueueCount, syncQueue } from './lib/offlineQueue'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { PlatformAdmin } from './components/PlatformAdmin'
import { ClientsPage } from './components/ClientsPage'
import { EquipmentPage } from './components/EquipmentPage'
import { UserIdentity } from './components/UserIdentity'
import { SuppliesPage } from './components/SuppliesPage'
import { CollaboratorsPage } from './components/CollaboratorsPage'
import { EventsPage } from './components/EventsPage'
import { SeparationPage } from './components/SeparationPage'
import { DeparturePage } from './components/DeparturePage'
import { ReturnPage } from './components/ReturnPage'
import { MaintenancePage } from './components/MaintenancePage'
import { AgendaPage } from './components/AgendaPage'
import { ReportsPage } from './components/ReportsPage'
import { SettingsPage } from './components/SettingsPage'
import { ReturnCollectionPage } from './components/ReturnCollectionPage'
import { listMobileEvents, type MobileAction, type MobileEvent } from './lib/mobileOperations'
import { QrCameraScanner } from './components/QrCameraScanner'
import { listEvents, type RentalEvent } from './lib/events'
import { loadReturnDetails, scanReturnItem, type ReturnDetails } from './lib/returns'

type View = 'dashboard' | 'operation' | 'departure' | 'collection' | 'return' | 'events'
type DesktopSection = 'Dashboard' | 'Agenda' | 'Eventos' | 'Clientes' | 'Equipamentos' | 'Estoque' | 'Separação' | 'Saída' | 'Coleta no evento' | 'Retorno e conferência' | 'Manutenção' | 'Colaboradores' | 'Relatórios' | 'Configurações'
type Tone = 'danger' | 'warning' | 'success' | 'info' | 'neutral'

const nav = [
  ['Dashboard', LayoutDashboard], ['Agenda', CalendarDays], ['Eventos', FolderKanban],
  ['Clientes', CircleUserRound], ['Equipamentos', Headphones], ['Estoque', Boxes],
  ['Separação', ClipboardCheck], ['Saída', LogOut], ['Coleta no evento', PackageCheck], ['Retorno e conferência', RotateCcw],
  ['Manutenção', Wrench], ['Colaboradores', UsersRound], ['Relatórios', Gauge],
  ['Configurações', Settings],
] as const

function Status({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`status status--${tone}`}>{children}</span>
}

function Sidebar({ collapsed, active, onSelect, onToggle }: { collapsed: boolean; active: DesktopSection; onSelect: (section: DesktopSection) => void; onToggle: () => void }) {
  return <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
    <div className="brand"><span className="brand-mark">L</span><strong>Lume</strong></div>
    <nav aria-label="Navegação principal">
      {nav.map(([label, Icon]) => (
        <button className={label === active ? 'nav-item nav-item--active' : 'nav-item'} key={label} title={label} onClick={() => onSelect(label)}>
          <Icon size={19} /><span>{label}</span>
        </button>
      ))}
    </nav>
    <button className="collapse" onClick={onToggle}><ArrowLeft size={17} /><span>Recolher menu</span></button>
  </aside>
}

function Dashboard({ onNavigate }: { onNavigate: (section: DesktopSection) => void }) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null)
  const [dataError, setDataError] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    void loadDashboard().then((data) => {
      if (active) setSnapshot(data)
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : 'Não foi possível carregar o painel.'
      if (active) setDataError(message)
    })
    return () => { active = false }
  }, [])

  const dashboardEvents = snapshot?.events ?? []
  const itemCount = snapshot?.itemTotal ?? 0
  const attentionItems = snapshot ? [
    { value: snapshot.overdueItems, label: 'itens com retorno atrasado', tone: 'danger', section: 'Retorno e conferência' as const, icon: AlertTriangle },
    { value: snapshot.pendingSeparations, label: 'separações pendentes nas próximas 48h', tone: 'warning', section: 'Separação' as const, icon: PackageOpen },
    { value: snapshot.awaitingReturnChecks, label: 'itens aguardando conferência', tone: 'warning', section: 'Retorno e conferência' as const, icon: RotateCcw },
    { value: snapshot.maintenanceTotal, label: 'itens em manutenção', tone: 'danger', section: 'Manutenção' as const, icon: Wrench },
    { value: snapshot.supplyAlerts, label: 'insumos abaixo do mínimo', tone: 'warning', section: 'Estoque' as const, icon: PackageOpen },
  ].filter((item) => item.value > 0) : []

  return <>
    <div className="title-row"><div><h1>Visão operacional</h1><p>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date())}</p></div><button className="primary" onClick={() => onNavigate('Eventos')}><CalendarDays size={17} /> Novo evento</button></div>
    {dataError ? <div className="data-error" role="alert">{dataError}</div> : null}
    {attentionItems.length ? <section className="attention"><div className="section-heading"><h2>Precisa de atenção</h2></div><div className="attention-list">{attentionItems.map((item) => <button className={`attention-item attention-item--${item.tone}`} key={item.label} onClick={() => onNavigate(item.section)}><span className="attention-icon"><item.icon /></span><span><strong>{item.value}</strong><small>{item.label}</small></span><ChevronRight /></button>)}</div></section> : null}
    <section className="metrics" aria-label="Indicadores do dia">
      {[
        ['Eventos hoje', String(dashboardEvents.length), CalendarDays, 'Agenda operacional'],
        ['Montagens hoje', String(snapshot?.assembliesToday ?? 0), Wrench, 'Operações previstas'],
        ['Desmontagens hoje', String(snapshot?.disassembliesToday ?? 0), ArrowDownToLine, 'Operações previstas'],
        ['Itens cadastrados', String(itemCount), Boxes, `${snapshot?.maintenanceTotal ?? 0} em manutenção`],
      ].map(([label, value, Icon, note]) => <article className="metric" key={String(label)}>
        <span className="metric-icon"><Icon size={20} /></span><div><small>{label as string}</small><strong>{value as string}</strong><p>{note as string}</p></div>
      </article>)}
    </section>
    <div className="dashboard-grid">
      <section className="panel agenda"><div className="section-heading"><h2>Agenda de hoje</h2><button onClick={() => onNavigate('Agenda')}>Agenda completa <ArrowRight size={15} /></button></div>
        <div className="event-list">{dashboardEvents.length === 0 ? <p className="empty-state">Nenhum evento programado para hoje.</p> : dashboardEvents.map((event) => <button className="event-row" key={event.id} onClick={() => onNavigate('Eventos')}>
          <span className="event-time"><strong>{event.time}</strong><small>até {event.end}</small></span>
          <span className={`timeline-dot timeline-dot--${event.tone}`} />
          <span className="event-detail"><strong>{event.name}</strong><small>{event.place}</small></span>
          <Status tone={event.tone}>{event.status}</Status><ChevronRight size={17} />
        </button>)}</div>
      </section>
      <section className="panel stock"><div className="section-heading"><h2>Estado do estoque</h2><button onClick={() => onNavigate('Equipamentos')}>Ver equipamentos <ArrowRight size={15} /></button></div>
        <div className="stock-list">{(snapshot?.stock ?? []).map((item) => <div className="stock-row" key={item.label}>
          <span className={`stock-dot stock-dot--${item.tone}`} /><span className="stock-name">{item.label}</span>
          <strong>{item.value.toLocaleString('pt-BR')}</strong><div className="bar"><i className={`bar--${item.tone}`} style={{ width: `${item.percent}%` }} /></div><small>{item.percent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</small>
        </div>)}</div>
        <div className="reconcile"><ShieldCheck size={18} /><span><strong>{itemCount.toLocaleString('pt-BR')} itens cadastrados</strong><small>Inventário conectado ao Supabase</small></span></div>
      </section>
    </div>
    <section className="panel operations"><div className="section-heading"><h2>Próximas operações</h2><button onClick={() => onNavigate('Agenda')}>Ver todas <ArrowRight size={15} /></button></div>
      <div className="table-wrap"><table><thead><tr><th>Data</th><th>Horário</th><th>Operação</th><th>Evento</th><th>Cliente</th><th>Local</th><th>Status</th></tr></thead>
      <tbody>{(snapshot?.operations ?? []).map((operation) => <tr key={operation.id}><td>{operation.date}</td><td>{operation.time}</td><td>{operation.operation}</td><td><strong>{operation.event}</strong></td><td>{operation.client}</td><td>{operation.place}</td><td><Status tone="info">{operation.status}</Status></td></tr>)}</tbody></table>{snapshot && snapshot.operations.length === 0 ? <p className="empty-state">Nenhuma operação prevista nos próximos 14 dias.</p> : null}</div>
    </section>
  </>
}

function MobileHeader({ title, back, online }: { title?: string; back?: () => void; online?: boolean }) {
  return <header className="mobile-header">
    {back ? <button aria-label="Voltar" onClick={back}><ArrowLeft /></button> : <div className="mobile-brand"><strong>Lume</strong><span>Operação</span></div>}
    {title ? <h1>{title}</h1> : null}
    {online !== undefined ? <span className={online ? 'sync sync--ok' : 'sync'}>{online ? <Cloud /> : <CloudOff />}<span>{online ? 'Online' : 'Offline'}<small>{online ? 'tudo sincronizado' : 'salvando no aparelho'}</small></span></span> : <button aria-label="Opções"><Menu /></button>}
  </header>
}

function OperationHome({ setView, online }: { setView: (v: View) => void; online: boolean }) {
  const [name, setName] = useState('')
  const [nextEvent, setNextEvent] = useState<RentalEvent>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => { let active = true; async function load() { if (!supabase) throw new Error('Supabase não configurado.'); const [{ data: auth }, events] = await Promise.all([supabase.auth.getUser(), listEvents()]); const profile = auth.user ? await supabase.from('profiles').select('display_name').eq('id', auth.user.id).single() : null; if (!active) return; setName(profile?.data?.display_name?.trim() || auth.user?.email?.split('@')[0] || 'usuário'); const now = Date.now(); setNextEvent(events.filter((event) => ['CONFIRMADO', 'EM_ANDAMENTO'].includes(event.status) && new Date(event.disassembly_at).getTime() >= now).sort((a, b) => new Date(a.assembly_at).getTime() - new Date(b.assembly_at).getTime())[0]) } void load().catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a operação.') }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [])
  return <div className="mobile-screen"><MobileHeader online={online} />
    <div className="greeting"><h1>{loading ? 'Carregando…' : `Olá, ${name}!`}</h1><p>Vamos fazer um ótimo evento.</p></div>{error ? <div className="data-error" role="alert">{error}</div> : null}
    <div className="operation-actions">
      <button className="operation-action operation-action--navy" onClick={() => setView('events')}><QrCode /><span>Selecionar evento</span><ChevronRight /></button>
    </div>
    {nextEvent ? <button className="next-task" onClick={() => setView('events')}><small>Próximo evento</small><strong>{nextEvent.name}</strong><span><Clock3 /> {new Date(nextEvent.assembly_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span><span><CalendarDays /> {nextEvent.venue || nextEvent.address || 'Local não informado'}</span><i><ChevronRight /></i></button> : !loading ? <div className="next-task"><small>Próximo evento</small><strong>Nenhum evento confirmado</strong></div> : null}
    <button className="mobile-sign-out" onClick={() => void supabase?.auth.signOut()}>Sair da conta</button>
  </div>
}

function ReturnScreen({ setView, online, event }: { setView: (v: View) => void; online: boolean; event: RentalEvent }) {
  const [details, setDetails] = useState<ReturnDetails>(); const [code, setCode] = useState(''); const [error, setError] = useState('')
  const [queued, setQueued] = useState(0)
  const [toast, setToast] = useState('')
  const items = details?.items ?? []; const progress = items.filter((item) => item.check_id).length

  useEffect(() => { let active = true; void Promise.all([pendingQueueCount(), loadReturnDetails(event)]).then(([count, data]) => { if (active) { setQueued(count); setDetails(data) } }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o retorno.') }); return () => { active = false } }, [event])

  const scan = async () => {
    const scanned = code.trim(); if (!scanned) return; setError('')
    try { if (online) { await scanReturnItem(event.id, scanned, 'BOM', ''); setDetails(await loadReturnDetails(event)) } else setQueued((await enqueue({ type: 'RETORNO', itemCode: scanned, eventId: event.id })).length); setCode(''); setToast(`${scanned} conferido com sucesso`) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível conferir o item.') }
    window.setTimeout(() => setToast(''), 2200)
  }

  return <div className="mobile-screen mobile-screen--return"><MobileHeader title="Conferência de retorno" back={() => setView('operation')} />
    <div className="return-event"><span><CalendarDays /></span><div><strong>{event.name}</strong><small>{event.venue || event.address || 'Local não informado'}</small></div></div>
    <div className="progress-head"><strong>{progress} de {items.length} <span>itens</span></strong><small>{items.length ? Math.round(progress / items.length * 100) : 0}%</small></div><div className="progress"><i style={{ width: `${items.length ? progress / items.length * 100 : 0}%` }} /></div>
    {error ? <div className="data-error" role="alert">{error}</div> : null}<div className="scanner"><QrCode /><strong>Leia ou digite o código do item</strong><input aria-label="Código do equipamento" value={code} onChange={(e) => setCode(e.target.value.toLocaleUpperCase('pt-BR'))} placeholder="QR OU CÓDIGO INTERNO" /><QrCameraScanner onDetected={(value) => setCode(value.toLocaleUpperCase('pt-BR'))} /><small>A leitura é salva mesmo sem internet</small></div>
    <button className="scan-button" disabled={!code.trim()} onClick={() => void scan()}><QrCode /> Conferir item</button>
    <div className="recent-heading"><strong>Equipamentos do evento</strong><small>{items.length - progress} faltando</small></div>
    <div className="return-list">{items.map((item) => <div className={item.check_id ? 'return-row return-row--ok' : 'return-row return-row--missing'} key={item.item_id}>
      <span className="return-state">{item.check_id ? <Check /> : <AlertTriangle />}</span><span><strong>{item.internal_code}</strong><small>{item.description}</small></span><Status tone={item.check_id ? 'success' : 'warning'}>{item.check_id ? 'OK' : 'Pendente'}</Status>
    </div>)}</div>
    {queued > 0 ? <div className="offline-banner"><CloudOff /> {queued} leituras aguardando sincronização <ChevronRight /></div> : null}
    {toast ? <div className="toast"><Check /> {toast}</div> : null}
  </div>
}

function MyEvents({ setView, onSelect }: { setView: (v: View) => void; onSelect: (event: MobileEvent, action: MobileAction) => void }) {
  const [list, setList] = useState<MobileEvent[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  useEffect(() => { let active = true; void listMobileEvents().then((events) => { if (active) setList(events) }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os eventos.') }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [])
  return <div className="mobile-screen"><MobileHeader title="Meus eventos" back={() => setView('operation')} />
    {error ? <div className="data-error" role="alert">{error}</div> : null}{loading ? <p className="empty-state">Carregando eventos…</p> : list.length === 0 ? <p className="empty-state">Nenhum evento confirmado ou em andamento.</p> : <div className="my-events">{list.map((event) => <button className="my-event" key={event.id} disabled={event.mobileAction === 'complete'} onClick={() => onSelect(event, event.mobileAction)}>
      <span className="my-event-time"><strong>{new Date(event.assembly_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong><small>às {new Date(event.disassembly_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small></span>
      <span className="my-event-main"><strong>{event.name}</strong><small>{event.venue || event.address || 'Local não informado'}</small><em><UsersRound /> {event.client_name}</em></span>
      <Status tone={event.mobileAction === 'complete' ? 'success' : event.mobileAction === 'return' ? 'warning' : 'info'}>{{ departure: 'Saída', collection: 'Coleta', return: 'Recebimento', complete: 'Concluído' }[event.mobileAction]}</Status><ChevronRight />
    </button>)}</div>}
  </div>
}

function App() {
  const [view, setView] = useState<View>(() => window.innerWidth < 760 ? 'operation' : 'dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [section, setSection] = useState<DesktopSection>('Dashboard')
  const [online, setOnline] = useState(navigator.onLine)
  const [mobileEvent, setMobileEvent] = useState<RentalEvent>()

  useEffect(() => {
    const on = () => { setOnline(true); void syncQueue() }
    const off = () => setOnline(false)
    void migrateLegacyQueue().then(() => { if (navigator.onLine) void syncQueue() })
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const mobileView = useMemo(() => {
    if (view === 'return' && mobileEvent) return <ReturnScreen setView={setView} online={online} event={mobileEvent} />
    if (view === 'departure' && mobileEvent) return <div className="mobile-screen"><MobileHeader title="Saída" back={() => setView('events')} /><DeparturePage initialEventId={mobileEvent.id} /></div>
    if (view === 'collection' && mobileEvent) return <div className="mobile-screen"><MobileHeader title="Coleta no evento" back={() => setView('events')} /><ReturnCollectionPage initialEventId={mobileEvent.id} /></div>
    if (view === 'events') return <MyEvents setView={setView} onSelect={(event, action) => { if (action === 'complete') return; setMobileEvent(event); setView(action) }} />
    return <OperationHome setView={setView} online={online} />
  }, [view, online, mobileEvent])

  if (view !== 'dashboard') return <main className="mobile-app">{mobileView}<button className="desktop-switch" onClick={() => setView('dashboard')}>Abrir painel de gestão</button></main>

  return <div className="app-shell"><Sidebar collapsed={collapsed} active={section} onSelect={setSection} onToggle={() => setCollapsed((v) => !v)} />
    <div className="workspace"><header className="topbar"><button className="menu-button" onClick={() => setCollapsed((v) => !v)}><Menu /></button><label className="search"><Search /><input aria-label="Buscar" placeholder="Buscar eventos, clientes, equipamentos..." /></label><div className="topbar-actions"><PlatformAdmin /><button className="operation-link" onClick={() => setView('operation')}><PackageCheck /> App operacional</button><button className="sign-out" aria-label="Sair" title="Sair" onClick={() => void supabase?.auth.signOut()}><LogOut /></button><UserIdentity /></div></header>
      <main className="content">{section === 'Agenda' ? <AgendaPage onOpenEvents={() => setSection('Eventos')} /> : section === 'Eventos' ? <EventsPage /> : section === 'Clientes' ? <ClientsPage /> : section === 'Equipamentos' ? <EquipmentPage /> : section === 'Estoque' ? <SuppliesPage /> : section === 'Separação' ? <SeparationPage /> : section === 'Saída' ? <DeparturePage /> : section === 'Coleta no evento' ? <ReturnCollectionPage /> : section === 'Retorno e conferência' ? <ReturnPage /> : section === 'Manutenção' ? <MaintenancePage /> : section === 'Colaboradores' ? <CollaboratorsPage /> : section === 'Relatórios' ? <ReportsPage /> : section === 'Configurações' ? <SettingsPage /> : <Dashboard onNavigate={setSection} />}</main>
    </div>
  </div>
}

export default App
