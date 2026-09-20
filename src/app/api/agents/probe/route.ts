import { enforceAgentRateLimit } from '@/lib/rateLimit'
import { getAI, getModel } from '@/lib/ai/client'
import { prosConsPrompt, critiquePrompt } from '@/lib/ai/prompts'
import { safeParseJSON } from '@/lib/utils'
import { PipelineContext, ProsConsOutput, CritiqueOutput } from '@/types/pipeline'
import { createAgentStream } from '@/lib/stream'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  const rateLimit = await enforceAgentRateLimit('probe', 10)
  if (rateLimit) return rateLimit
  const { stream, emitAction, emitResult, emitError, close } = createAgentStream<{ prosCons: ProsConsOutput; critique: CritiqueOutput }>()

  ;(async () => {
    try {
      const body = (await req.json()) as Partial<{ context: PipelineContext }>

      if (!body.context) {
        emitError('Missing required field: context')
        return close()
      }

      const { context } = body
      emitAction('Running SWOT analysis', 'brain')

      const [prosConsResult, critiqueResult] = await Promise.all([
        getAI().chat.completions.create({
          model: getModel(),
          messages: [{ role: 'user', content: prosConsPrompt(context) }],
          temperature: 0.6,
          max_tokens: 1200,
        }),
        getAI().chat.completions.create({
          model: getModel(),
          messages: [{ role: 'user', content: critiquePrompt(context) }],
          temperature: 0.7,
          max_tokens: 1200,
        }).then(res => {
          emitAction('Evaluating feasibility and risks', 'code')
          return res
        })
      ])

      const prosConsRaw = prosConsResult.choices[0]?.message?.content ?? ''
      const critiqueRaw = critiqueResult.choices[0]?.message?.content ?? ''

      if (!prosConsRaw || prosConsRaw === '{}') {
        console.error('[probe] empty pros/cons response from model')
        emitError('Pros/Cons agent returned empty or invalid response')
        return close()
      }
      if (!critiqueRaw || critiqueRaw === '{}') {
        console.error('[probe] empty critique response from model')
        emitError('Critique agent returned empty or invalid response')
        return close()
      }

      const prosCons = safeParseJSON<ProsConsOutput>(prosConsRaw, {
        pros: [],
        cons: [],
        opportunities: [],
        threats: [],
      })
      const critique = safeParseJSON<CritiqueOutput>(critiqueRaw, {
        critique: '',
        riskLevel: 'medium',
        tags: [],
        keyAssumptions: [],
      })

      emitResult({ prosCons, critique })
    } catch (err) {
      console.error('[probe]', err)
      emitError(err instanceof Error ? err.message : 'Probe agents failed')
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
