import { isSupabaseConfigured } from './supabase/config'
import { createClient } from './supabase/server'
export async function enforceAgentRateLimit(bucket: string, limit = 10): Promise<Response | null> {
  if (!isSupabaseConfigured()) return null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 })
  const { data, error } = await supabase.rpc('reserve_agent_request', { p_bucket: bucket, p_limit: limit, p_window_seconds: 60 })
  if (error) { console.error('[rate-limit]', error); return Response.json({ error: 'Rate limiter unavailable' }, { status: 503 }) }
  if (!data) return Response.json({ error: 'Too many requests; try again shortly' }, { status: 429, headers: { 'Retry-After': '60' } })
  return null
}
