import { getAI, getModel } from '@/lib/ai/client'
import { scoutSummaryPrompt } from '@/lib/ai/prompts'
import {
  buildScoutQueries,
  enrichHits,
  formatHitsForPrompt,
  multiSearchWithFallback,
} from '@/lib/search'
import { safeParseJSON } from '@/lib/utils'
import { PipelineContext, ScoutOutput } from '@/types/pipeline'
import { createAgentStream } from '@/lib/stream'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  const { stream, emitAction, emitResult, emitError, close } = createAgentStream<ScoutOutput>()

  // Run asynchronously without awaiting so we can return the stream immediately
  ;(async () => {
    try {
      const body = (await req.json()) as Partial<{ context: PipelineContext }>

      if (!body.context) {
        emitError('Missing required field: context')
        return close()
      }

      const { context } = body
      emitAction('Analyzing context and building queries', 'brain')
      const queries = buildScoutQueries(context)
      
      const { hits: searchResults, providerName } = await multiSearchWithFallback(
        queries,
        (msg, icon) => emitAction(msg, icon)
      )

      console.info(`[scout] ${searchResults.length} hits via ${providerName} (${queries.length} queries)`)
      const enriched = await enrichHits(searchResults, 5, (msg, icon) => emitAction(msg, icon))
      
      emitAction('Synthesizing search results', 'brain')
      const rawText = formatHitsForPrompt(enriched)

      const completion = await getAI().chat.completions.create({
        model: getModel(),
        messages: [{ role: 'user', content: scoutSummaryPrompt(context, rawText) }],
        temperature: 0.5,
        max_tokens: 2000,
      })

      const raw = completion.choices[0]?.message?.content ?? ''
      if (!raw || raw === '{}') {
        console.error('[scout] empty response from model')
        emitError('Scout agent returned empty or invalid response')
        return close()
      }

      const result = safeParseJSON<ScoutOutput>(raw, { results: [], summary: '' })
      emitResult(result)
    } catch (err) {
      console.error('[scout]', err)
      emitError(err instanceof Error ? err.message : 'Scout agent failed')
    } finally {
      close()
    }
  })()

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
