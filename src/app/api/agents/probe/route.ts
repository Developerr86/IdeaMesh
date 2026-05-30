import { getAI, getModel } from '@/lib/ai/client'
import { prosConsPrompt, critiquePrompt } from '@/lib/ai/prompts'
import { safeParseJSON } from '@/lib/utils'
import { PipelineContext, ProsConsOutput, CritiqueOutput } from '@/types/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<{ context: PipelineContext }>

    if (!body.context) {
      return Response.json({ error: 'Missing required field: context' }, { status: 400 })
    }

    const { context } = body

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
      }),
    ])

    const prosConsRaw = prosConsResult.choices[0]?.message?.content ?? ''
    const critiqueRaw = critiqueResult.choices[0]?.message?.content ?? ''

    if (!prosConsRaw || prosConsRaw === '{}') {
      console.error('[probe] empty pros/cons response from model')
      return Response.json({ error: 'Pros/Cons agent returned empty or invalid response' }, { status: 502 })
    }
    if (!critiqueRaw || critiqueRaw === '{}') {
      console.error('[probe] empty critique response from model')
      return Response.json({ error: 'Critique agent returned empty or invalid response' }, { status: 502 })
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

    return Response.json({ prosCons, critique })
  } catch (err) {
    console.error('[probe]', err)
    return Response.json({ error: 'Probe agents failed' }, { status: 500 })
  }
}
