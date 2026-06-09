import { search, SafeSearchType } from 'duck-duck-scrape'
import { fetchWithRetry } from './http'
import type { SearchHit, SearchProvider } from './types'

const DDG_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 10)))
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

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

function parseHtmlResults(html: string, maxResults: number): SearchHit[] {
  const hits: SearchHit[] = []
  const linkRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = linkRegex.exec(html)) && hits.length < maxResults) {
    const nextLinkIndex = html.indexOf('class="result__a"', linkRegex.lastIndex)
    const resultHtml = html.slice(
      match.index,
      nextLinkIndex === -1 ? Math.min(html.length, match.index + 6000) : nextLinkIndex,
    )

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

function parseLiteResults(html: string, maxResults: number): SearchHit[] {
  const hits: SearchHit[] = []
  const linkRegex = /<a[^>]+class=['"]result-link['"][^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = linkRegex.exec(html)) && hits.length < maxResults) {
    const afterLink = html.slice(match.index, html.indexOf('</table>', match.index))
    const snippet = afterLink.match(/<td class=['"]result-snippet['"]>([\s\S]*?)<\/td>/i)
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
