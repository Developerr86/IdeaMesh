import { getAI, getModel } from '@/lib/ai/client'
import { comparisonPrompt } from '@/lib/ai/prompts'
import { safeParseJSON } from '@/lib/utils'
import { PipelineContext, ComparisonOutput } from '@/types/pipeline'
import { createAgentStream } from '@/lib/stream'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  const { stream, emitAction, emitResult, emitError, close } = createAgentStream<ComparisonOutput>()

  ;(async () => {
    try {
      const body = (await req.json()) as Partial<{ context: PipelineContext }>

      if (!body.context) {
        emitError('Missing required field: context')
        return close()
      }

      const { context } = body
      emitAction('Analyzing scout results and identifying competitors', 'brain')

      const completion = await getAI().chat.completions.create({
        model: getModel(),
        messages: [{ role: 'user', content: comparisonPrompt(context) }],
        temperature: 0.6,
        max_tokens: 2000,
      })

      emitAction('Synthesizing market positioning and edges', 'code')

      const raw = completion.choices[0]?.message?.content ?? ''
      if (!raw || raw === '{}') {
        console.error('[compare] empty response from model')
        emitError('Compare agent returned empty or invalid response')
        return close()
      }

      const result = safeParseJSON<ComparisonOutput>(raw, {
        competitors: [],
        ourEdge: [],
        improvementSuggestions: [],
        marketPositioning: '',
      })
      emitResult(result)
    } catch (err) {
      console.error('[compare]', err)
      emitError(err instanceof Error ? err.message : 'Compare agent failed')
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
