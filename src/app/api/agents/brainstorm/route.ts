import { getAI, getModel } from '@/lib/ai/client'
import { brainstormPrompt } from '@/lib/ai/prompts'
import { safeParseJSON } from '@/lib/utils'
import { BrainstormOutput, PipelineContext } from '@/types/pipeline'
import { createAgentStream } from '@/lib/stream'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const FALLBACK: BrainstormOutput = {
  expansions: [],
  angles: [],
  targetAudiences: [],
  coreValueProposition: '',
}

export async function POST(req: Request) {
  const { stream, emitAction, emitResult, emitError, close } = createAgentStream<BrainstormOutput>()

  ;(async () => {
    try {
      const body = (await req.json()) as Partial<{ context: PipelineContext }>

      if (!body.context) {
        emitError('Missing required field: context')
        return close()
      }

      const { context } = body
      emitAction('Analyzing seed constraints', 'brain')
      
      const completion = await getAI().chat.completions.create({
        model: getModel(),
        messages: [{ role: 'user', content: brainstormPrompt(context) }],
        temperature: 0.8,
        max_tokens: 1500,
      })

      emitAction('Generating feature expansions', 'code')

      const raw = completion.choices[0]?.message?.content ?? ''
      if (!raw || raw === '{}') {
        console.error('[brainstorm] empty response from model')
        emitError('Brainstorm agent returned empty or invalid response')
        return close()
      }

      const result = safeParseJSON<BrainstormOutput>(raw, FALLBACK)
      emitResult(result)
    } catch (err) {
      console.error('[brainstorm]', err)
      emitError(err instanceof Error ? err.message : 'Brainstorm agent failed')
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
