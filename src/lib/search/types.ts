export interface SearchHit {
  title: string
  url: string
  content: string
  score?: number
}

export interface SearchProvider {
  name: string
  search(query: string, maxResults?: number): Promise<SearchHit[]>
}

export type SearchProviderName = 'auto' | 'tavily' | 'duckduckgo' | 'bing'
