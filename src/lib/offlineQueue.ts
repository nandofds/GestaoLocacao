export type OfflineOperation = {
  id: string
  type: 'SAIDA' | 'RETORNO' | 'DANO'
  itemCode: string
  eventId: string
  createdAt: string
}

const KEY = 'lume:offline-queue:v1'

export function readQueue(): OfflineOperation[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as OfflineOperation[]
  } catch {
    return []
  }
}

export function enqueue(operation: Omit<OfflineOperation, 'id' | 'createdAt'>) {
  const next = [
    ...readQueue(),
    { ...operation, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
  ]
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}

export function clearQueue() {
  localStorage.setItem(KEY, '[]')
}
