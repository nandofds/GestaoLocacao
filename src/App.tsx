import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, ArrowDownToLine, ArrowLeft, ArrowRight, Boxes, CalendarDays,
  Check, ChevronRight, CircleUserRound, ClipboardCheck, Clock3, Cloud,
  CloudOff, FolderKanban, Gauge, Headphones, LayoutDashboard, LogOut,
  Menu, PackageCheck, PackageOpen, QrCode, RotateCcw, Search, Settings,
  ShieldCheck, UsersRound, Wrench,
} from 'lucide-react'
import { attention, events, operations, returnItems, stock } from './data'
import { loadDashboard, type DashboardSnapshot } from './lib/dashboard'
import { clearQueue, enqueue, readQueue } from './lib/offlineQueue'
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

type View = 'dashboard' | 'operation' | 'return' | 'events'
type DesktopSection = 'Dashboard' | 'Agenda' | 'Eventos' | 'Clientes' | 'Equipamentos' | 'Estoque' | 'Separação' | 'Saída' | 'Retorno e conferência' | 'Manutenção' | 'Colaboradores'
type Tone = 'danger' | 'warning' | 'success' | 'info' | 'neutral'
type ReturnItem = { code: string; name: string; state: 'missing' | 'ok' | 'damaged' }

const nav = [
  ['Dashboard', LayoutDashboard], ['Agenda', CalendarDays], ['Eventos', FolderKanban],
  ['Clientes', CircleUserRound], ['Equipamentos', Headphones], ['Estoque', Boxes],
  ['Separação', ClipboardCheck], ['Saída', LogOut], ['Retorno e conferência', RotateCcw],
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
        <button className={label === active ? 'nav-item nav-item--active' : 'nav-item'} key={label} title={label} onClick={() => { if (label === 'Dashboard' || label === 'Agenda' || label === 'Eventos' || label === 'Clientes' || label === 'Equipamentos' || label === 'Estoque' || label === 'Separação' || label === 'Saída' || label === 'Retorno e conferência' || label === 'Manutenção' || label === 'Colaboradores') onSelect(label) }}>
          <Icon size={19} /><span>{label}</span>
        </button>
      ))}
    </nav>
    <button className="collapse" onClick={onToggle}><ArrowLeft size={17} /><span>Recolher menu</span></button>
  </aside>
}

function AttentionRail() {
  return <section className="attention" aria-labelledby="attention-title">
    <div className="section-heading"><h2 id="attention-title">Precisa de atenção</h2><button>Ver todas <ArrowRight size={15} /></button></div>
    <div className="attention-list">
      {attention.map((item) => <button className={`attention-item attention-item--${item.tone}`} key={item.label}>
        <span className="attention-icon">{item.tone === 'danger' ? <AlertTriangle /> : <PackageOpen />}</span>
        <span><strong>{item.value}</strong><small>{item.label}</small></span><ChevronRight />
      </button>)}
    </div>
  </section>
}

function Dashboard() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null)
  const [dataError, setDataError] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    void loadDashboard().then((data) => {
      if (active) setSnapshot(data)
    }).catch((error: unknown) => {
      if (active) setDataError(error instanceof Error ? error.message : 'Não foi possível carregar o painel.')
    })
    return () => { active = false }
  }, [])

  const dashboardEvents = isSupabaseConfigured ? snapshot?.events ?? [] : [...events]
  const eventCount = isSupabaseConfigured ? snapshot?.events.length ?? 0 : 6
  const itemCount = isSupabaseConfigured ? snapshot?.itemTotal ?? 0 : 2000
  const maintenanceCount = isSupabaseConfigured ? snapshot?.maintenanceTotal ?? 0 : 64
  const supplyAlerts = isSupabaseConfigured ? snapshot?.supplyAlerts ?? 0 : 5

  return <>
    <div className="title-row"><div><h1>Visão operacional</h1><p>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date())}</p></div><button className="primary"><CalendarDays size={17} /> Novo evento</button></div>
    {dataError ? <div className="data-error" role="alert">{dataError}</div> : null}
    {isSupabaseConfigured ? <section className="attention"><div className="section-heading"><h2>Precisa de atenção</h2></div><div className="attention-list">
      <button className="attention-item attention-item--danger"><span className="attention-icon"><Wrench /></span><span><strong>{maintenanceCount}</strong><small>itens em manutenção</small></span></button>
      <button className="attention-item attention-item--warning"><span className="attention-icon"><PackageOpen /></span><span><strong>{supplyAlerts}</strong><small>insumos abaixo do mínimo</small></span></button>
    </div></section> : <AttentionRail />}
    <section className="metrics" aria-label="Indicadores do dia">
      {[
        ['Eventos hoje', String(eventCount), CalendarDays, 'Agenda operacional'],
        ['Montagens hoje', String(eventCount), Wrench, 'Eventos do dia'],
        ['Desmontagens hoje', String(eventCount), ArrowDownToLine, 'Eventos do dia'],
        ['Itens cadastrados', String(itemCount), Boxes, `${maintenanceCount} em manutenção`],
      ].map(([label, value, Icon, note]) => <article className="metric" key={String(label)}>
        <span className="metric-icon"><Icon size={20} /></span><div><small>{label as string}</small><strong>{value as string}</strong><p>{note as string}</p></div>
      </article>)}
    </section>
    <div className="dashboard-grid">
      <section className="panel agenda"><div className="section-heading"><h2>Agenda de hoje</h2><button>Agenda completa <ArrowRight size={15} /></button></div>
        <div className="event-list">{dashboardEvents.length === 0 ? <p className="empty-state">Nenhum evento programado para hoje.</p> : dashboardEvents.map((event) => <button className="event-row" key={'id' in event ? event.id : event.name}>
          <span className="event-time"><strong>{event.time}</strong><small>até {event.end}</small></span>
          <span className={`timeline-dot timeline-dot--${event.tone}`} />
          <span className="event-detail"><strong>{event.name}</strong><small>{event.place}</small></span>
          <Status tone={event.tone}>{event.status}</Status><ChevronRight size={17} />
        </button>)}</div>
      </section>
      <section className="panel stock"><div className="section-heading"><h2>Estado do estoque</h2><button>Ver estoque <ArrowRight size={15} /></button></div>
        <div className="stock-list">{stock.map((item) => <div className="stock-row" key={item.label}>
          <span className={`stock-dot stock-dot--${item.tone}`} /><span className="stock-name">{item.label}</span>
          <strong>{item.value.toLocaleString('pt-BR')}</strong><div className="bar"><i className={`bar--${item.tone}`} style={{ width: `${item.percent}%` }} /></div><small>{item.percent}%</small>
        </div>)}</div>
        <div className="reconcile"><ShieldCheck size={18} /><span><strong>{itemCount.toLocaleString('pt-BR')} itens cadastrados</strong><small>Inventário conectado ao Supabase</small></span></div>
      </section>
    </div>
    <section className="panel operations"><div className="section-heading"><h2>Próximas operações</h2><button>Ver todas <ArrowRight size={15} /></button></div>
      <div className="table-wrap"><table><thead><tr><th>Data</th><th>Horário</th><th>Operação</th><th>Evento</th><th>Cliente</th><th>Local</th><th>Status</th></tr></thead>
      <tbody>{isSupabaseConfigured ? dashboardEvents.map((event) => <tr key={'id' in event ? event.id : event.name}><td>{'assemblyAt' in event ? new Date(event.assemblyAt).toLocaleDateString('pt-BR') : '-'}</td><td>{event.time}</td><td>Montagem</td><td><strong>{event.name}</strong></td><td>{'client' in event ? event.client : '-'}</td><td>{event.place}</td><td><Status tone="info">{event.status}</Status></td></tr>) : operations.map((op) => <tr key={`${op.time}-${op.event}`}><td>{op.date}</td><td>{op.time}</td><td>{op.operation}</td><td><strong>{op.event}</strong></td><td>{op.client}</td><td>{op.place}</td><td><Status tone="info">Programado</Status></td></tr>)}</tbody></table></div>
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
  return <div className="mobile-screen"><MobileHeader online={online} />
    <div className="greeting"><h1>Bom dia, Rafael!</h1><p>Vamos fazer um ótimo evento.</p></div>
    <div className="operation-actions">
      <button className="operation-action operation-action--navy"><QrCode /><span>Bipar saída</span><ChevronRight /></button>
      <button className="operation-action operation-action--green" onClick={() => setView('return')}><RotateCcw /><span>Bipar retorno</span><ChevronRight /></button>
      <button className="operation-action" onClick={() => setView('events')}><CalendarDays /><span>Meus eventos</span><ChevronRight /></button>
    </div>
    <button className="next-task" onClick={() => setView('events')}><small>Próxima tarefa</small><strong>Show Banda Aurora</strong><span><Clock3 /> Hoje às 14:00</span><span><CalendarDays /> Arena das Dunas · Natal/RN</span><i><ChevronRight /></i></button>
  </div>
}

function ReturnScreen({ setView, online }: { setView: (v: View) => void; online: boolean }) {
  const [items, setItems] = useState<ReturnItem[]>(() => returnItems.map((item) => ({ ...item })))
  const [queued, setQueued] = useState(() => readQueue().length)
  const [toast, setToast] = useState('')
  const progress = items.filter((item) => item.state === 'ok').length + 15

  const scan = () => {
    const code = `CA-${Math.floor(1100 + Math.random() * 8000)}`
    setItems((current) => [{ code, name: 'Cabo de sinal XLR 10m', state: 'ok' }, ...current.slice(0, 4)])
    if (!online) setQueued(enqueue({ type: 'RETORNO', itemCode: code, eventId: 'show-banda-aurora' }).length)
    setToast(`${code} conferido com sucesso`)
    window.setTimeout(() => setToast(''), 2200)
  }

  const markDamage = () => {
    setItems((current) => current.map((item, index) => index === 0 ? { ...item, state: 'damaged' } : item))
    if (!online) setQueued(enqueue({ type: 'DANO', itemCode: items[0].code, eventId: 'show-banda-aurora' }).length)
    setToast('Dano registrado · manutenção será aberta')
    window.setTimeout(() => setToast(''), 2600)
  }

  return <div className="mobile-screen mobile-screen--return"><MobileHeader title="Conferência de retorno" back={() => setView('operation')} />
    <div className="return-event"><span><CalendarDays /></span><div><strong>Show Banda Aurora</strong><small>Hoje · Arena das Dunas</small></div></div>
    <div className="progress-head"><strong>{progress} de 24 <span>itens</span></strong><small>{Math.round(progress / 24 * 100)}%</small></div><div className="progress"><i style={{ width: `${progress / 24 * 100}%` }} /></div>
    <div className="scanner"><QrCode /><strong>Aponte para o QR do item</strong><small>A leitura é salva mesmo sem internet</small><i className="corner corner--a" /><i className="corner corner--b" /><i className="corner corner--c" /><i className="corner corner--d" /></div>
    <button className="scan-button" onClick={scan}><QrCode /> Ler próximo item</button>
    <div className="recent-heading"><strong>Últimos itens lidos</strong><small>{24 - progress} faltando</small></div>
    <div className="return-list">{items.map((item, index) => <div className={`return-row return-row--${item.state}`} key={`${item.code}-${index}`}>
      <span className="return-state">{item.state === 'ok' ? <Check /> : item.state === 'damaged' ? <Wrench /> : <AlertTriangle />}</span>
      <span><strong>{item.code}</strong><small>{item.name}</small></span>
      {index === 0 && item.state !== 'damaged' ? <button onClick={markDamage}><Wrench /> Marcar dano</button> : <Status tone={item.state === 'ok' ? 'success' : 'danger'}>{item.state === 'ok' ? 'OK' : item.state === 'damaged' ? 'Dano' : 'Faltando'}</Status>}
    </div>)}</div>
    {queued > 0 ? <div className="offline-banner"><CloudOff /> {queued} leituras aguardando sincronização <ChevronRight /></div> : null}
    {toast ? <div className="toast"><Check /> {toast}</div> : null}
  </div>
}

function MyEvents({ setView }: { setView: (v: View) => void }) {
  const list = [
    ['08:00', '12:00', 'Congresso Tech 2025', 'Centro de Convenções Recife', 'Carregamento', 'Em andamento'],
    ['14:00', '23:00', 'Show Banda Aurora', 'Arena das Dunas · Natal/RN', 'Conferência de retorno', 'Em andamento'],
    ['23:30', '02:00', 'After Party Skyline', 'Rooftop Ocean · Natal/RN', 'Desmontagem', 'Pendente'],
  ]
  return <div className="mobile-screen"><MobileHeader title="Meus eventos" back={() => setView('operation')} />
    <h2 className="day-title"><i /> Hoje · 22/05</h2>
    <div className="my-events">{list.map((event, index) => <button className="my-event" key={event[2]}>
      <span className="my-event-time"><strong>{event[0]}</strong><small>às {event[1]}</small></span>
      <span className="my-event-main"><strong>{event[2]}</strong><small>{event[3]}</small><em><UsersRound /> {event[4]}</em></span>
      <Status tone={index < 2 ? 'success' : 'neutral'}>{event[5]}</Status><ChevronRight />
    </button>)}</div>
    <h2 className="day-title day-title--cyan"><i /> Amanhã · 23/05</h2>
    <button className="my-event"><span className="my-event-time"><strong>09:00</strong><small>às 13:00</small></span><span className="my-event-main"><strong>Feira Indústria 4.0</strong><small>Pavilhão de Exposições</small><em><UsersRound /> Carregamento</em></span><Status tone="info">Agendado</Status><ChevronRight /></button>
  </div>
}

function App() {
  const [view, setView] = useState<View>(() => window.innerWidth < 760 ? 'operation' : 'dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [section, setSection] = useState<DesktopSection>('Dashboard')
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const on = () => { setOnline(true); clearQueue() }
    const off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const mobileView = useMemo(() => {
    if (view === 'return') return <ReturnScreen setView={setView} online={online} />
    if (view === 'events') return <MyEvents setView={setView} />
    return <OperationHome setView={setView} online={online} />
  }, [view, online])

  if (view !== 'dashboard') return <main className="mobile-app">{mobileView}<button className="desktop-switch" onClick={() => setView('dashboard')}>Abrir painel de gestão</button></main>

  return <div className="app-shell"><Sidebar collapsed={collapsed} active={section} onSelect={setSection} onToggle={() => setCollapsed((v) => !v)} />
    <div className="workspace"><header className="topbar"><button className="menu-button" onClick={() => setCollapsed((v) => !v)}><Menu /></button><label className="search"><Search /><input aria-label="Buscar" placeholder="Buscar eventos, clientes, equipamentos..." /></label><div className="topbar-actions"><PlatformAdmin /><button className="operation-link" onClick={() => setView('operation')}><PackageCheck /> App operacional</button><button className="sign-out" aria-label="Sair" title="Sair" onClick={() => void supabase?.auth.signOut()}><LogOut /></button><UserIdentity /></div></header>
      <main className="content">{section === 'Agenda' ? <AgendaPage onOpenEvents={() => setSection('Eventos')} /> : section === 'Eventos' ? <EventsPage /> : section === 'Clientes' ? <ClientsPage /> : section === 'Equipamentos' ? <EquipmentPage /> : section === 'Estoque' ? <SuppliesPage /> : section === 'Separação' ? <SeparationPage /> : section === 'Saída' ? <DeparturePage /> : section === 'Retorno e conferência' ? <ReturnPage /> : section === 'Manutenção' ? <MaintenancePage /> : section === 'Colaboradores' ? <CollaboratorsPage /> : <Dashboard />}</main>
    </div>
  </div>
}

export default App
