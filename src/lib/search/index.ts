import { bingProvider } from './bing'
import { getCachedSearch, setCachedSearch } from './cache'
import { duckDuckGoProvider } from './duckduckgo'
import { fetchPageText } from './http'
import { tavilyProvider } from './tavily'
import type { SearchHit, SearchProvider, SearchProviderName } from './types'
import type { PipelineContext } from '@/types/pipeline'
import type { ActionIcon } from '../stream'

export type OnAction = (msg: string, icon?: ActionIcon) => void

export type { SearchHit, SearchProvider, SearchProviderName } from './types'

function resolveProviderName(): SearchProviderName {
  const configured = (process.env.SEARCH_PROVIDER ?? 'duckduckgo').toLowerCase() as SearchProviderName
  if (configured === 'tavily' || configured === 'duckduckgo' || configured === 'bing') return configured
  return 'auto'
}

export function getSearchProvider(): SearchProvider {
  const name = resolveProviderName()

  if (name === 'bing') return bingProvider
  if (name === 'tavily') return tavilyProvider
  if (name === 'duckduckgo') return duckDuckGoProvider

  // Keyless by default. Tavily remains only as an explicit legacy override.
  return duckDuckGoProvider
}

export function buildScoutQueries(context: PipelineContext): string[] {
  const { title, description } = context.idea
  const descString = description || title || ''
  const queries = [
    `${title} open source GitHub`,
    `${title} Product Hunt`,
    `${descString.split(' ').slice(0, 8).join(' ')} software tool`,
    `${title} alternative competitor`,
  ]

  if (context.brainstorm?.coreValueProposition) {
    queries.push(`${context.brainstorm.coreValueProposition} similar product`)
  }

  return queries
}

async function runQueries(
  queries: string[],
  provider: SearchProvider,
  maxPerQuery: number,
): Promise<PromiseSettledResult<SearchHit[]>[]> {
  // DuckDuckGo rate-limits parallel requests — run sequentially with a short pause.
  if (provider.name === 'duckduckgo') {
    const results: PromiseSettledResult<SearchHit[]>[] = []
    for (const q of queries) {
      try {
        const value = await provider.search(q, maxPerQuery)
        results.push({ status: 'fulfilled', value })
      } catch (reason) {
        results.push({ status: 'rejected', reason })
      }
      await new Promise((r) => setTimeout(r, 400))
    }
    return results
  }

  return Promise.allSettled(queries.map((q) => provider.search(q, maxPerQuery)))
}

export async function multiSearch(
  queries: string[],
  provider?: SearchProvider,
  maxPerQuery = 4,
  onAction?: OnAction
): Promise<SearchHit[]> {
  const activeProvider = provider ?? getSearchProvider()
  const cacheKey = `${activeProvider.name}:${maxPerQuery}:${queries.join('\u001f')}`
  const cached = getCachedSearch(cacheKey)
  if (cached) return cached
  onAction?.(`Ran ${queries.length} searches via ${activeProvider.name}`, 'search')

  const settled = await runQueries(queries, activeProvider, maxPerQuery)

  const flat: SearchHit[] = []
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      flat.push(...result.value)
    } else {
      console.warn(`[search:${activeProvider.name}] query failed:`, result.reason)
    }
  }

  if (flat.length === 0) {
    const failed = settled.filter((r) => r.status === 'rejected')
    if (failed.length === settled.length) {
      throw new Error(`All searches failed via ${activeProvider.name}`)
    }
  }

  const seen = new Set<string>()
  const deduped = flat.filter((r) => {
    if (!r.url || seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })

  const hits = deduped.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  if (hits.length > 0) setCachedSearch(cacheKey, hits)
  return hits
}

export async function multiSearchWithFallback(
  queries: string[],
  onAction?: OnAction
): Promise<{ hits: SearchHit[]; providerName: string }> {
  const primary = getSearchProvider()
  const chain = primary.name === 'duckduckgo'
    ? [duckDuckGoProvider, bingProvider]
    : [primary, duckDuckGoProvider, bingProvider].filter((p, i, all) => all.findIndex((x) => x.name === p.name) === i)

  for (const provider of chain) {
    try {
      const hits = await multiSearch(queries, provider, 4, onAction)
      if (hits.length > 0) return { hits, providerName: provider.name }
    } catch (error) {
      console.warn(`[search] ${provider.name} failed:`, error)
    }
    const next = chain[chain.indexOf(provider) + 1]
    if (next) onAction?.(`Falling back to ${next.name} search`, 'search')
  }
  throw new Error('All keyless search providers failed')
}

export async function enrichHits(hits: SearchHit[], limit = 5, onAction?: OnAction): Promise<SearchHit[]> {
  const enrichEnabled = process.env.SEARCH_ENRICH_PAGES !== 'false'
  if (!enrichEnabled || hits.length === 0) return hits

  const top = hits.slice(0, limit)
  const enriched = await Promise.all(
    top.map(async (hit) => {
      onAction?.(`Opened page ${new URL(hit.url).hostname.replace(/^www\./, '')}`, 'globe')
      const pageText = await fetchPageText(hit.url)
      if (!pageText) return hit
      return {
        ...hit,
        content: `${hit.content}\n\n[Page content]\n${pageText}`.slice(0, 3000),
      }
    }),
  )

  return [...enriched, ...hits.slice(limit)]
}

export function formatHitsForPrompt(hits: SearchHit[], limit = 10): string {
  return hits
    .slice(0, limit)
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`)
    .join('\n\n---\n\n')
}
