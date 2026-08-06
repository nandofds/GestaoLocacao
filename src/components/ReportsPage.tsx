import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, CircleDollarSign, FileBarChart, PackageCheck, Wrench } from 'lucide-react'
import { loadReport, type ReportSnapshot } from '../lib/reports'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const labels: Record<string, string> = { PLANEJADO: 'Planejado', CONFIRMADO: 'Confirmado', EM_ANDAMENTO: 'Em andamento', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' }
function dateValue(date: Date) { return date.toISOString().slice(0, 10) }

export function ReportsPage() {
  const initialStart = new Date(); initialStart.setDate(1)
  const [start, setStart] = useState(dateValue(initialStart)); const [end, setEnd] = useState(dateValue(new Date()))
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  useEffect(() => { let active = true; setLoading(true); setError(''); void loadReport(start, end).then((data) => { if (active) setSnapshot(data) }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o relatório.') }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [start, end])
  const metrics = useMemo(() => {
    const events = snapshot?.events ?? []; const valid = events.filter((event) => event.status !== 'CANCELADO')
    const revenue = valid.reduce((sum, event) => sum + event.value, 0); const eventCosts = valid.reduce((sum, event) => sum + event.additionalCosts, 0); const maintenance = snapshot?.maintenanceCost ?? 0
    return { events: valid.length, confirmed: valid.filter((event) => ['CONFIRMADO', 'EM_ANDAMENTO', 'CONCLUIDO'].includes(event.status)).length, revenue, costs: eventCosts + maintenance, margin: revenue - eventCosts - maintenance }
  }, [snapshot])
  return <div className="management-page reports-page">
    <div className="title-row"><div><h1>Relatórios</h1><p>Desempenho operacional e financeiro da empresa ativa</p></div></div>
    <section className="panel report-filters"><CalendarRange /><label>De<input type="date" value={start} max={end} onChange={(event) => setStart(event.target.value)} /></label><label>Até<input type="date" value={end} min={start} onChange={(event) => setEnd(event.target.value)} /></label></section>
    {error ? <div className="data-error" role="alert">{error}</div> : null}
    {loading ? <p className="empty-state">Carregando relatório…</p> : <>
      <section className="report-metrics">
        <article><FileBarChart /><span><small>Eventos no período</small><strong>{metrics.events}</strong><em>{metrics.confirmed} confirmados ou realizados</em></span></article>
        <article><CircleDollarSign /><span><small>Valor dos eventos</small><strong>{money.format(metrics.revenue)}</strong><em>Cancelados desconsiderados</em></span></article>
        <article><Wrench /><span><small>Custos registrados</small><strong>{money.format(metrics.costs)}</strong><em>{snapshot?.maintenanceCount ?? 0} manutenções no período</em></span></article>
        <article><PackageCheck /><span><small>Resultado estimado</small><strong>{money.format(metrics.margin)}</strong><em>{snapshot?.itemCount ?? 0} itens cadastrados</em></span></article>
      </section>
      <section className="panel"><div className="section-heading"><h2>Eventos do período</h2><small>{snapshot?.events.length ?? 0} registros</small></div><div className="table-wrap"><table className="report-table"><thead><tr><th>Data</th><th>Evento</th><th>Cliente</th><th>Status</th><th>Valor</th><th>Custos adicionais</th></tr></thead><tbody>{snapshot?.events.map((event) => <tr key={event.id}><td>{new Date(event.startsAt).toLocaleDateString('pt-BR')}</td><td><strong>{event.name}</strong></td><td>{event.client}</td><td><span className={`event-status event-status--${event.status.toLowerCase()}`}>{labels[event.status] ?? event.status}</span></td><td>{money.format(event.value)}</td><td>{money.format(event.additionalCosts)}</td></tr>)}</tbody></table>{snapshot?.events.length === 0 ? <p className="empty-state">Nenhum evento encontrado neste período.</p> : null}</div></section>
    </>}
  </div>
}
