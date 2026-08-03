import { getAI, getModel } from '@/lib/ai/client'
import { pitchDeckPrompt } from '@/lib/ai/prompts'
import { safeParseJSON } from '@/lib/utils'
import { PipelineContext, PitchDeckOutput } from '@/types/pipeline'
import { createAgentStream } from '@/lib/stream'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  const { stream, emitAction, emitResult, emitError, close } = createAgentStream<PitchDeckOutput>()

  ;(async () => {
    try {
      const body = (await req.json()) as Partial<{ context: PipelineContext }>

      if (!body.context) {
        emitError('Missing required field: context')
        return close()
      }

      const { context } = body
      emitAction('Synthesizing project context into narrative arc', 'brain')

      const completion = await getAI().chat.completions.create({
        model: getModel(),
        messages: [{ role: 'user', content: pitchDeckPrompt(context) }],
        temperature: 0.6,
        max_tokens: 4000,
      })

      emitAction('Structuring final pitch deck slides', 'code')

      const raw = completion.choices[0]?.message?.content ?? ''
      if (!raw || raw === '{}') {
        console.error('[pitchdeck] empty response from model')
        emitError('Pitch deck agent returned empty or invalid response')
        return close()
      }

      const result = safeParseJSON<PitchDeckOutput>(raw, { slides: [] })
      emitResult(result)
    } catch (err) {
      console.error('[pitchdeck]', err)
      emitError(err instanceof Error ? err.message : 'Pitch deck agent failed')
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
