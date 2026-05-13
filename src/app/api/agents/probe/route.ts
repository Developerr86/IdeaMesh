import { getAI, getModel } from '@/lib/ai/client'
import { prosConsPrompt, critiquePrompt } from '@/lib/ai/prompts'
import { safeParseJSON } from '@/lib/utils'
import { PipelineContext, ProsConsOutput, CritiqueOutput } from '@/types/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { context }: { context: PipelineContext } = await req.json()

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

    const prosConsContent = prosConsResult.choices[0]?.message?.content ?? '{}'
    const critiqueContent = critiqueResult.choices[0]?.message?.content ?? '{}'

    const prosCons = safeParseJSON<ProsConsOutput>(prosConsContent, {
      pros: [],
      cons: [],
      opportunities: [],
      threats: [],
    })
    const critique = safeParseJSON<CritiqueOutput>(critiqueContent, {
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
