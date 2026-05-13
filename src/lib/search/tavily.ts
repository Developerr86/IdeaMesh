export interface TavilyResult {
  title: string
  url: string
  content: string
  score: number
}

export interface TavilyResponse {
  results: TavilyResult[]
  answer?: string
}

export async function tavilySearch(query: string, maxResults = 5): Promise<TavilyResult[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: maxResults,
      search_depth: 'advanced',
    }),
  })

  if (!res.ok) {
    throw new Error(`Tavily search failed: ${res.status}`)
  }

  const data: TavilyResponse = await res.json()
  return data.results
}

export async function multiSearch(queries: string[]): Promise<TavilyResult[]> {
  const results = await Promise.all(queries.map((q) => tavilySearch(q, 4)))
  const flat = results.flat()
  const seen = new Set<string>()
  return flat.filter((r) => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })
}
