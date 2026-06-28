# Scout Agent Search Implementation: How DuckDuckGo Powers Free Web Search

## Summary

The Scout agent in IdeaMesh implements a sophisticated web search capability that works entirely without Tavily API. It uses DuckDuckGo as the primary free search provider with multiple fallback mechanisms to ensure reliable competitor research.

## Key Components

### 1. Search Provider Architecture

The search system uses a pluggable provider pattern:

```typescript
// src/lib/search/index.ts
export function getSearchProvider(): SearchProvider {
  const name = resolveProviderName()
  
  if (name === 'tavily') return tavilyProvider
  if (name === 'duckduckgo') return duckDuckGoProvider
  
  // auto: prefer Tavily when key is present, otherwise DuckDuckGo (free)
  if (process.env.TAVILY_API_KEY) return tavilyProvider
  return duckDuckGoProvider
}
```

### 2. DuckDuckGo Provider Implementation

The DuckDuckGo provider combines two search methods:

**Primary Method (duck-duck-scrape):**
- Uses the `duck-duck-scrape` npm package
- Provides structured results with titles, URLs, and descriptions
- Supports safe search filtering

**Fallback Method (HTML parsing):**
- Parses DuckDuckGo's HTML pages directly
- Handles both standard (`html.duckduckgo.com`) and lite (`lite.duckduckgo.com`) interfaces
- Extracts results using regex patterns

### 3. Rate Limiting Strategy

DuckDuckGo rate-limits parallel requests, so the system uses sequential processing:

```typescript
// src/lib/search/index.ts
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
```

### 4. Query Generation

The Scout agent builds intelligent queries based on the idea:

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

### 5. Result Processing Pipeline

**MultiSearch with Fallback:**
1. Try primary provider (Tavily if API key present, else DuckDuckGo)
2. If primary fails, automatically fall back to DuckDuckGo
3. If all providers fail, throw error

**Result Processing:**
- Deduplicate by URL
- Score results based on position
- Sort by score (highest first)
- Optional content enrichment (page text extraction)

### 6. Scout Agent Integration

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

## How It Works Without Tavily

### 1. Automatic Provider Selection

When `TAVILY_API_KEY` is not set (or not configured), the system automatically uses DuckDuckGo:

```typescript
// Environment variable check
if (process.env.TAVILY_API_KEY) return tavilyProvider
return duckDuckGoProvider
```

### 2. DuckDuckGo-Specific Features

**URL Resolution:**
- Handles DuckDuckGo's redirect URLs with `uddg` parameters
- Converts relative URLs to absolute
- Decodes HTML entities

**HTML Parsing:**
- Extracts results from both standard and lite interfaces
- Uses regex patterns to find result links and snippets
- Handles edge cases and malformed HTML

**Safe Search:**
- Uses moderate safe search settings
- Filters inappropriate content
- Maintains search relevance

### 3. Error Handling and Fallbacks

**Multiple Fallback Layers:**
1. duck-duck-scrape package → HTML parsing (standard) → HTML parsing (lite)
2. Primary provider (Tavily/DuckDuckGo) → DuckDuckGo (if primary fails)
3. All providers fail → Error with clear message

**Retry Logic:**
- HTTP requests with retry (up to 2 retries)
- Timeout handling (12 seconds for HTML, 20 seconds for Tavily)
- Graceful degradation when services are unavailable

## Benefits of This Approach

### 1. Zero Cost
- No API key required
- No usage limits
- No subscription fees

### 2. Reliability
- Multiple fallback mechanisms
- Automatic provider switching
- Graceful error handling

### 3. Performance
- Sequential processing prevents rate limiting
- Efficient result deduplication
- Optional content enrichment

### 4. Privacy
- No personal data collection
- No tracking
- No logging of search queries

## Environment Configuration

### Without Tavily (Free Mode)

```env
# Web search - DuckDuckGo will be used automatically
SEARCH_PROVIDER=auto
# TAVILY_API_KEY= (not set)
SEARCH_ENRICH_PAGES=true
```

### With Tavily (Paid Mode)

```env
# Web search - Tavily takes precedence
SEARCH_PROVIDER=auto
TAVILY_API_KEY=tvly-your-api-key-here
SEARCH_ENRICH_PAGES=true
```

## Scout Agent Output

The Scout agent produces structured competitor research:

```typescript
export interface SearchResult {
  title: string
  url: string
  description: string
  source: 'github' | 'producthunt' | 'twitter' | 'web'
}

export interface ScoutOutput {
  results: SearchResult[]
  summary: string
}
```

## Key Technical Details

### 1. Headers and User Agent

```typescript
const DDG_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
}
```

### 2. Result Scoring

Results are scored based on their position in search results:

```typescript
return response.results.slice(0, maxResults).map((r, i) => ({
  title: stripTags(r.title),
  url: r.url,
  content: stripTags(r.description || r.rawDescription || ''),
  score: response.results.length - i,  // Higher score for earlier results
}))
```

### 3. Content Extraction

Optional page content fetching for deeper analysis:

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

## Production Considerations

### 1. Scalability
- Sequential processing limits concurrent searches
- Rate limiting prevents blocking
- Efficient deduplication reduces data transfer

### 2. Monitoring
- Provider name logging for debugging
- Error tracking and alerting
- Performance metrics

### 3. Maintenance
- Regular dependency updates
- Fallback mechanism testing
- Rate limit monitoring

## Conclusion

The Scout agent demonstrates how to build a robust, free web search capability using DuckDuckGo. The implementation combines:

1. **Multiple search methods** (package + HTML parsing)
2. **Intelligent fallbacks** (automatic provider switching)
3. **Rate limiting handling** (sequential processing)
4. **Error resilience** (graceful degradation)
5. **Rich result extraction** (titles, descriptions, content)

This approach provides a production-ready search solution that works without any API keys or costs, making it ideal for open-source projects and cost-sensitive applications.