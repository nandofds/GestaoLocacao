import { supabase } from './supabase'

export type OfflineOperation = {
  id: string; type: 'SAIDA' | 'RETORNO' | 'DANO'; itemCode: string; eventId: string
  organizationId: string; userId: string; createdAt: string; attempts: number; lastError?: string
}

const DB_NAME = 'lume-offline'; const STORE = 'operations'; const LEGACY_KEY = 'lume:offline-queue:v1'
const CONTEXT_KEY = 'lume:offline-context:v1'
let databasePromise: Promise<IDBDatabase> | undefined

function database() {
  if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains(STORE)) { const store = db.createObjectStore(STORE, { keyPath: 'id' }); store.createIndex('createdAt', 'createdAt'); store.createIndex('context', ['organizationId', 'userId']) } }
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
  })
  return databasePromise
}

async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await database(); return new Promise<T>((resolve, reject) => { const request = action(db.transaction(STORE, mode).objectStore(STORE)); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
}

async function context() {
  if (!supabase) throw new Error('Supabase não configurado.')
  const [{ data: auth, error: authError }, organization] = await Promise.all([supabase.auth.getSession(), supabase.rpc('current_organization_id')])
  const userId = auth.session?.user.id
  if (authError || !userId) throw new Error('Sessão inválida para operação offline.')
  if (!organization.error && organization.data) { const value = { userId, organizationId: organization.data as string }; localStorage.setItem(CONTEXT_KEY, JSON.stringify(value)); return value }
  try { const cached = JSON.parse(localStorage.getItem(CONTEXT_KEY) ?? 'null') as { userId: string; organizationId: string } | null; if (cached?.userId === userId && cached.organizationId) return cached } catch { /* contexto inválido */ }
  throw new Error('Empresa ativa não encontrada no cache offline.')
}

export async function migrateLegacyQueue() {
  const raw = localStorage.getItem(LEGACY_KEY); if (!raw) return
  localStorage.removeItem(LEGACY_KEY)
  try { const legacy = JSON.parse(raw) as Array<Pick<OfflineOperation, 'id' | 'type' | 'itemCode' | 'eventId' | 'createdAt'>>; const current = await context(); for (const item of legacy) await transaction('readwrite', (store) => store.put({ ...item, ...current, attempts: 0 })) } catch { /* fila antiga inválida é descartada */ }
}

export async function readQueue(): Promise<OfflineOperation[]> {
  const rows = await transaction<OfflineOperation[]>('readonly', (store) => store.getAll())
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function enqueue(operation: Pick<OfflineOperation, 'type' | 'itemCode' | 'eventId'>) {
  const current = await context(); const rows = await readQueue()
  const matching = rows.find((row) => row.organizationId === current.organizationId && row.userId === current.userId && row.eventId === operation.eventId && row.itemCode === operation.itemCode)
  const next: OfflineOperation = { ...operation, ...current, id: matching?.id ?? crypto.randomUUID(), createdAt: matching?.createdAt ?? new Date().toISOString(), attempts: 0 }
  if (matching?.type === 'DANO' && operation.type === 'RETORNO') next.type = 'DANO'
  await transaction('readwrite', (store) => store.put(next)); return readQueue()
}

export async function pendingQueueCount() { return (await readQueue()).length }

export async function syncQueue() {
  if (!navigator.onLine || !supabase) return readQueue()
  const current = await context(); const rows = await readQueue()
  for (const operation of rows) {
    if (operation.organizationId !== current.organizationId || operation.userId !== current.userId) continue
    const result = operation.type === 'SAIDA'
      ? await supabase.rpc('scan_separation_item', { target_event_id: operation.eventId, scanned_code: operation.itemCode })
      : await supabase.rpc('scan_return_item', { target_event_id: operation.eventId, scanned_code: operation.itemCode, returned_condition: operation.type === 'DANO' ? 'DANIFICADO' : 'BOM', target_defect: operation.type === 'DANO' ? 'DANO REGISTRADO DURANTE OPERAÇÃO OFFLINE' : null })
    const duplicate = result.error?.message.toLocaleLowerCase('pt-BR').includes('já foi conferido')
    if (!result.error || duplicate) await transaction('readwrite', (store) => store.delete(operation.id))
    else await transaction('readwrite', (store) => store.put({ ...operation, attempts: operation.attempts + 1, lastError: result.error.message }))
  }
  return readQueue()
}
