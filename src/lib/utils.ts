import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function safeParseJSON<T>(str: string, fallback: T): T {
  // Pass 1: strip markdown fences
  try {
    const cleaned = str.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    return JSON.parse(cleaned) as T
  } catch {
    // Pass 2: extract the outermost {...} or [...] block from mixed-content responses
    // (some LLMs append commentary after the closing brace)
    try {
      const match = str.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
      if (match) return JSON.parse(match[0]) as T
    } catch {
      // fall through
    }
    return fallback
  }
}
