import type { SearchHit, SearchProvider } from './types'

export const tavilyProvider: SearchProvider = {
  name: 'tavily',

  async search(query: string, maxResults = 5): Promise<SearchHit[]> {
    const apiKey = process.env.TAVILY_API_KEY
    if (!apiKey) {
      throw new Error('TAVILY_API_KEY is not configured')
    }

    const postRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        search_depth: 'basic',
      }),
      signal: AbortSignal.timeout(20_000),
    })

    if (!postRes.ok) {
      throw new Error(`Tavily search failed: ${postRes.status}`)
    }

    const data = (await postRes.json()) as { results: Array<{ title: string; url: string; content: string; score?: number }> }
    return data.results.map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
    }))
  },
}

// Keep legacy export name for any external references
export type TavilyResult = SearchHit
