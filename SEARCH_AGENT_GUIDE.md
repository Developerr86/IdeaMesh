# Building Search Agents with DuckDuckGo: A Guide to Free Web Search Integration

## Overview

This guide explains how to build search agents using DuckDuckGo as a free alternative to paid search APIs like Tavily. The Scout agent in IdeaMesh demonstrates a production-ready implementation that combines DuckDuckGo's web scraping capabilities with intelligent fallback mechanisms.

## Why DuckDuckGo?

- **No API key required** - Completely free to use
- **Rich result extraction** - Gets titles, snippets, and page content
- **Built-in fallbacks** - Multiple scraping methods and HTML parsing
- **Rate limiting friendly** - Sequential request handling for DuckDuckGo
- **Privacy-focused** - No personal data collection

## Core Architecture

The search system is built around a pluggable provider pattern:

```typescript
// src/lib/search/index.ts - Main orchestration
export function getSearchProvider(): SearchProvider {
  const name = resolveProviderName()
  
  if (name === 'tavily') return tavilyProvider
  if (name === 'duckduckgo') return duckDuckGoProvider
  
  // auto: prefer Tavily when key is present, otherwise DuckDuckGo (free)
  if (process.env.TAVILY_API_KEY) return tavilyProvider
  return duckDuckGoProvider
}
```

## DuckDuckGo Implementation Details

### 1. Primary Provider (duck-duck-scrape)

The implementation first tries the `duck-duck-scrape` npm package for structured results:

```typescript
// src/lib/search/duckduckgo.ts
export const duckDuckGoProvider: SearchProvider = {
  name: 'duckduckgo',
  
  async search(query: string, maxResults = 5): Promise<SearchHit[]> {
    try {
      const response = await search(
        query,
        {
          safeSearch: SafeSearchType.MODERATE,
        },
        { headers: DDG_HEADERS },
      )
      
      if (response.noResults || !response.results?.length) {
        return searchDuckDuckGoHtml(query, maxResults)
      }
      
      return response.results.slice(0, maxResults).map((r, i) => ({
        title: stripTags(r.title),
        url: r.url,
        content: stripTags(r.description || r.rawDescription || ''),
        score: response.results.length - i,
      }))
    } catch (err) {
      console.warn('[search:duckduckgo] package search failed, trying HTML fallback:', err)
      return searchDuckDuckGoHtml(query, maxResults)
    }
  },
}
```

### 2. HTML Fallback

When the package fails or returns no results, it falls back to parsing DuckDuckGo's HTML pages:

```typescript
async function searchDuckDuckGoHtml(query: string, maxResults: number): Promise<SearchHit[]> {
  const encoded = encodeURIComponent(query)
  const endpoints = [
    `https://html.duckduckgo.com/html/?q=${encoded}`,
    `https://lite.duckduckgo.com/lite/?q=${encoded}`,
  ]
  
  for (const endpoint of endpoints) {
    const response = await fetchWithRetry(endpoint, {
      timeoutMs: 12_000,
      retries: 1,
      headers: DDG_HEADERS,
    })
    
    if (!response.ok) continue
    
    const html = await response.text()
    const hits = endpoint.includes('/lite/')
      ? parseLiteResults(html, maxResults)
      : parseHtmlResults(html, maxResults)
    
    if (hits.length > 0) return hits
  }
  
  return []
}
```

### 3. Rate Limiting for DuckDuckGo

DuckDuckGo rate-limits parallel requests, so the system runs queries sequentially:

```typescript
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
```

## Query Generation

The Scout agent builds intelligent search queries based on the idea:

```typescript
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
```

## Result Processing

### 1. Deduplication

```typescript
const seen = new Set<string>()
const deduped = flat.filter((r) => {
  if (!r.url || seen.has(r.url)) return false
  seen.add(r.url)
  return true
})
```

### 2. Scoring and Sorting

```typescript
return deduped.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
```

### 3. Content Enrichment

Optional page content fetching:

```typescript
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
```

## Integration with Scout Agent

The Scout agent orchestrates the search process:

```typescript
// src/app/api/agents/scout/route.ts
export async function POST(req: Request) {
  const { context } = body
  const queries = buildScoutQueries(context)
  const { hits: searchResults, providerName } = await multiSearchWithFallback(queries)
  
  console.info(`[scout] ${searchResults.length} hits via ${providerName} (${queries.length} queries)`)
  const enriched = await enrichHits(searchResults)
  const rawText = formatHitsForPrompt(enriched)
  
  const completion = await getAI().chat.completions.create({
    model: getModel(),
    messages: [{ role: 'user', content: scoutSummaryPrompt(context, rawText) }],
    temperature: 0.5,
    max_tokens: 2000,
  })
  
  const result = safeParseJSON<ScoutOutput>(raw, { results: [], summary: '' })
  return Response.json({ result })
}
```

## Environment Configuration

```env
# Web search
SEARCH_PROVIDER=auto           # 'tavily', 'duckduckgo', or 'auto'
TAVILY_API_KEY=                # Optional - if not set, DuckDuckGo is used
SEARCH_ENRICH_PAGES=true       # Fetch and append page content (optional)
```

## Key Features

### 1. Automatic Fallback

The system automatically falls back to DuckDuckGo when the primary provider fails:

```typescript
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
```

### 2. URL Resolution

Handles DuckDuckGo's redirect URLs:

```typescript
function resolveDuckDuckGoUrl(rawUrl: string): string {
  const decoded = decodeHtml(rawUrl)
  const absolute = decoded.startsWith('//') ? `https:${decoded}` : decoded
  
  try {
    const parsed = new URL(absolute)
    const uddg = parsed.searchParams.get('uddg')
    return uddg ? decodeURIComponent(uddg) : parsed.toString()
  } catch {
    return decoded
  }
}
```

### 3. HTML Parsing

Extracts results from both standard and lite DuckDuckGo interfaces:

```typescript
function parseHtmlResults(html: string, maxResults: number): SearchHit[] {
  const hits: SearchHit[] = []
  const linkRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  
  while ((match = linkRegex.exec(html)) && hits.length < maxResults) {
    const snippet = resultHtml.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i)
      ?? resultHtml.match(/<div[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i)
    
    const url = resolveDuckDuckGoUrl(match[1])
    if (!url.startsWith('http')) continue
    
    hits.push({
      title: stripTags(match[2]),
      url,
      content: snippet ? stripTags(snippet[1]) : '',
      score: maxResults - hits.length,
    })
  }
  
  return hits
}
```

## Benefits for Production Use

1. **Zero Cost** - No API fees or usage limits
2. **Reliability** - Multiple fallback mechanisms ensure search continuity
3. **Privacy** - No personal data collection or tracking
4. **Flexibility** - Easy to swap providers or add new ones
5. **Scalability** - Sequential processing prevents rate limiting
6. **Rich Results** - Extracts titles, descriptions, and content for comprehensive analysis

## Building Your Own Search Agent

To create a search agent using DuckDuckGo:

1. **Set up the search provider** - Implement the `SearchProvider` interface
2. **Configure query generation** - Build relevant search queries based on your domain
3. **Add result processing** - Parse and enrich search results
4. **Integrate with your pipeline** - Connect to your agent workflow
5. **Add fallback mechanisms** - Ensure reliability with multiple search methods

This implementation provides a solid foundation for building free, reliable search capabilities in your AI agents.