// Offline storage utilities using localStorage
export interface OfflineVocab {
  id: string
  word: string
  part_of_speech?: string
  cefr_level?: string
  meaning_primary?: string
  usage_tips?: string
  created_at: string
  synced: boolean
}

const STORAGE_KEY = 'verba_offline_vocabs'

export function saveOfflineVocab(vocab: Omit<OfflineVocab, 'id' | 'created_at' | 'synced'>): OfflineVocab {
  const offlineVocabs = getOfflineVocabs()
  
  const newVocab: OfflineVocab = {
    ...vocab,
    id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    created_at: new Date().toISOString(),
    synced: false
  }
  
  offlineVocabs.push(newVocab)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(offlineVocabs))
  
  return newVocab
}

export function getOfflineVocabs(): OfflineVocab[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function getUnsyncedVocabs(): OfflineVocab[] {
  return getOfflineVocabs().filter(v => !v.synced)
}

export function markVocabAsSynced(id: string) {
  const vocabs = getOfflineVocabs()
  const updated = vocabs.map(v => 
    v.id === id ? { ...v, synced: true } : v
  )
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

export function deleteOfflineVocab(id: string) {
  const vocabs = getOfflineVocabs()
  const filtered = vocabs.filter(v => v.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
}

export function clearSyncedVocabs() {
  const vocabs = getOfflineVocabs()
  const unsynced = vocabs.filter(v => !v.synced)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(unsynced))
}

export function isOnline(): boolean {
  return navigator.onLine
}
