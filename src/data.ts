export const attention = [
  { value: 3, label: 'separações pendentes', tone: 'danger' },
  { value: 2, label: 'itens não retornados', tone: 'danger' },
  { value: 4, label: 'aguardando conferência', tone: 'warning' },
  { value: 5, label: 'insumos abaixo do mínimo', tone: 'warning' },
] as const

export const events = [
  { time: '08:00', end: '14:00', name: 'Festival Conexão Norte', place: 'Expo Center Norte · Pavilhão Azul', status: 'Montagem', tone: 'success' },
  { time: '10:00', end: '18:00', name: 'Solenidade Câmara Municipal', place: 'Câmara Municipal · Plenário', status: 'Montagem', tone: 'success' },
  { time: '14:00', end: '22:00', name: 'Show Banda Aurora', place: 'Clube dos Ingleses', status: 'Em andamento', tone: 'warning' },
  { time: '19:00', end: '02:00', name: 'Baile Empresa Inova', place: 'Luso Brasileiro · Salão Nobre', status: 'Previsto', tone: 'neutral' },
] as const

export const stock = [
  { label: 'Disponível', value: 1248, percent: 62.4, tone: 'success' },
  { label: 'Em uso', value: 612, percent: 30.6, tone: 'info' },
  { label: 'Aguardando conferência', value: 76, percent: 3.8, tone: 'warning' },
  { label: 'Em manutenção', value: 64, percent: 3.2, tone: 'danger' },
] as const

export const operations = [
  { date: '23/05', time: '07:00', operation: 'Montagem', event: 'Tech Summit 2025', client: 'Tech Events', place: 'CentroSul' },
  { date: '23/05', time: '13:30', operation: 'Desmontagem', event: 'Show Banda Aurora', client: 'Aurora Produções', place: 'Clube dos Ingleses' },
  { date: '23/05', time: '15:00', operation: 'Montagem', event: 'Casamento Juliana e Rafael', client: 'Particular', place: 'Ponta dos Ganchos' },
] as const

export const returnItems = [
  { code: 'TR-2187', name: 'Box Truss Q30 2,0m', state: 'missing' },
  { code: 'CA-1042', name: 'Cabo AC PowerCON 20m', state: 'ok' },
  { code: 'AT-3301', name: 'Moving Head Beam 330', state: 'ok' },
  { code: 'FL-1508', name: 'Flood Light LED 150W', state: 'ok' },
] as const
