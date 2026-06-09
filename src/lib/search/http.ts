const DEFAULT_TIMEOUT_MS = 12_000
const DEFAULT_RETRIES = 2
const FETCH_USER_AGENT =
  'Mozilla/5.0 (compatible; IdeaMesh/1.0; +https://github.com/ideamesh)'

export interface FetchOptions {
  timeoutMs?: number
  retries?: number
  headers?: Record<string, string>
}

export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES, headers } = options
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': FETCH_USER_AGENT, ...headers },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      })
      return res
    } catch (err) {
      lastError = err
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)))
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Fetch failed')
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return false

    const host = parsed.hostname.toLowerCase()
    if (host === 'localhost' || host.endsWith('.local')) return false
    if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|::1|fc00:|fd)/.test(host)) {
      return false
    }
    return true
  } catch {
    return false
  }
}

function extractMetaDescription(html: string): string | null {
  const match = html.match(
    /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["']/i,
  )
  return match?.[1]?.trim() ?? null
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export async function fetchPageText(url: string, maxChars = 2000): Promise<string | null> {
  if (!isSafeUrl(url)) return null

  try {
    const res = await fetchWithRetry(url, { timeoutMs: 10_000, retries: 1 })
    if (!res.ok) return null

    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return null
    }

    const html = await res.text()
    const meta = extractMetaDescription(html)
    const body = htmlToText(html)
    const text = meta ? `${meta}\n\n${body}` : body
    return text.slice(0, maxChars) || null
  } catch {
    return null
  }
}
