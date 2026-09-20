import { fetchWithRetry } from './http'
import type { SearchHit, SearchProvider } from './types'

const HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; rv:60.0) Gecko/20100101 Firefox/60.0',
}
function decodeHtml(v: string) { return v.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>') }
function stripTags(v: string) { return decodeHtml(v.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()) }
function resolveUrl(href: string): string | null {
  const decoded = decodeHtml(href)
  if (!decoded.includes('bing.com/ck/a')) return decoded.startsWith('http') ? decoded : null
  try {
    const enc = new URL(decoded, 'https://www.bing.com').searchParams.get('u')
    if (!enc) return null
    const real = Buffer.from(enc.replace(/^a1/, '').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    return real.startsWith('http') ? real : null
  } catch { return null }
}
function parseBing(html: string, maxResults: number): SearchHit[] {
  const hits: SearchHit[] = []
  const re = /<h2[^>]*>\s*<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && hits.length < maxResults) {
    const url = resolveUrl(m[1])
    if (!url || /(\.|\/\/)bing\.com\//.test(url) || url.includes('go.microsoft.com')) continue
    const snippet = html.slice(re.lastIndex, re.lastIndex + 3000).match(/<p[^>]*>([\s\S]*?)<\/p>/i)
    hits.push({ title: stripTags(m[2]), url, content: snippet ? stripTags(snippet[1]) : '', score: maxResults - hits.length })
  }
  return hits
}
export const bingProvider: SearchProvider = {
  name: 'bing',
  async search(query, maxResults = 5) {
    try {
      const res = await fetchWithRetry(`https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${maxResults}&setlang=en-US`, { timeoutMs: 8_000, retries: 1, headers: HEADERS })
      return res.ok ? parseBing(await res.text(), maxResults) : []
    } catch (error) { console.warn('[search:bing] failed:', error); return [] }
  },
}
