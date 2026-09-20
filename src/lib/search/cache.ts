import type { SearchHit } from './types'
const TTL_MS = 10 * 60 * 1000
const MAX_ENTRIES = 200
const cache = new Map<string, { expires: number; hits: SearchHit[] }>()
export function getCachedSearch(key: string, now = Date.now()): SearchHit[] | null {
  const item = cache.get(key)
  if (!item || item.expires <= now) { cache.delete(key); return null }
  cache.delete(key); cache.set(key, item)
  return item.hits.map((hit) => ({ ...hit }))
}
export function setCachedSearch(key: string, hits: SearchHit[], now = Date.now()) {
  cache.delete(key); cache.set(key, { expires: now + TTL_MS, hits: hits.map((hit) => ({ ...hit })) })
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!)
}
