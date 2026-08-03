import { getAI, getModel } from '@/lib/ai/client'
import { qaPrompt } from '@/lib/ai/prompts'
import { safeParseJSON } from '@/lib/utils'
import { QAOutput, PipelineContext } from '@/types/pipeline'
import { createAgentStream } from '@/lib/stream'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  const { stream, emitAction, emitResult, emitError, close } = createAgentStream<QAOutput>()

  ;(async () => {
    try {
      const body = (await req.json()) as Partial<{ context: PipelineContext }>

      if (!body.context) {
        emitError('Missing required field: context')
        return close()
      }

      const { context } = body
      emitAction('Identifying missing context and edge cases', 'brain')

      const completion = await getAI().chat.completions.create({
        model: getModel(),
        messages: [{ role: 'user', content: qaPrompt(context) }],
        temperature: 0.7,
        max_tokens: 1500,
      })
      
      emitAction('Formulating clarifying questions', 'code')

      const raw = completion.choices[0]?.message?.content ?? ''
      if (!raw || raw === '{}') {
        console.error('[qa] empty response from model')
        emitError('Q&A agent returned empty or invalid response')
        return close()
      }

      const result = safeParseJSON<QAOutput>(raw, { questions: [] })
      emitResult(result)
    } catch (err) {
      console.error('[qa]', err)
      emitError(err instanceof Error ? err.message : 'Q&A agent failed')
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
