import { duckDuckGoProvider } from './duckduckgo'
import { fetchPageText } from './http'
import { tavilyProvider } from './tavily'
import type { SearchHit, SearchProvider, SearchProviderName } from './types'
import type { PipelineContext } from '@/types/pipeline'

export type { SearchHit, SearchProvider, SearchProviderName } from './types'

function resolveProviderName(): SearchProviderName {
  const configured = (process.env.SEARCH_PROVIDER ?? 'auto').toLowerCase() as SearchProviderName
  if (configured === 'tavily' || configured === 'duckduckgo') return configured
  return 'auto'
}

export function getSearchProvider(): SearchProvider {
  const name = resolveProviderName()

  if (name === 'tavily') return tavilyProvider
  if (name === 'duckduckgo') return duckDuckGoProvider

  // auto: prefer Tavily when key is present, otherwise DuckDuckGo (free)
  if (process.env.TAVILY_API_KEY) return tavilyProvider
  return duckDuckGoProvider
}

export function buildScoutQueries(context: PipelineContext): string[] {
  const { title, description } = context.idea
  const queries = [
    `${title} open source GitHub`,
    `${title} Product Hunt`,
    `${description.split(' ').slice(0, 8).join(' ')} software tool`,
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
): Promise<SearchHit[]> {
  const activeProvider = provider ?? getSearchProvider()
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

  return deduped.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
}

/** Run multiSearch with automatic DuckDuckGo fallback when the primary provider fails. */
export async function multiSearchWithFallback(
  queries: string[],
): Promise<{ hits: SearchHit[]; providerName: string }> {
  const primary = getSearchProvider()

  try {
    const hits = await multiSearch(queries, primary)
    if (hits.length > 0) return { hits, providerName: primary.name }
  } catch (err) {
    console.warn(`[search] ${primary.name} failed:`, err)
  }

  if (primary.name !== duckDuckGoProvider.name) {
    console.info('[search] falling back to duckduckgo')
    const hits = await multiSearch(queries, duckDuckGoProvider)
    return { hits, providerName: 'duckduckgo' }
  }

  throw new Error('All search providers failed')
}

export async function enrichHits(hits: SearchHit[], limit = 3): Promise<SearchHit[]> {
  const enrichEnabled = process.env.SEARCH_ENRICH_PAGES !== 'false'
  if (!enrichEnabled || hits.length === 0) return hits

  const top = hits.slice(0, limit)
  const enriched = await Promise.all(
    top.map(async (hit) => {
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
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 600)}`)
    .join('\n\n---\n\n')
}
