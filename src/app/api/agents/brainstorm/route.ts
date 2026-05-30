import { getAI, getModel } from '@/lib/ai/client'
import { brainstormPrompt } from '@/lib/ai/prompts'
import { safeParseJSON } from '@/lib/utils'
import { BrainstormOutput, PipelineContext } from '@/types/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const FALLBACK: BrainstormOutput = {
  expansions: [],
  angles: [],
  targetAudiences: [],
  coreValueProposition: '',
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<{ context: PipelineContext }>

    if (!body.context) {
      return Response.json({ error: 'Missing required field: context' }, { status: 400 })
    }

    const { context } = body

    const completion = await getAI().chat.completions.create({
      model: getModel(),
      messages: [{ role: 'user', content: brainstormPrompt(context) }],
      temperature: 0.8,
      max_tokens: 1500,
    })

    const raw = completion.choices[0]?.message?.content ?? ''
    if (!raw || raw === '{}') {
      console.error('[brainstorm] empty response from model')
      return Response.json({ error: 'Brainstorm agent returned empty or invalid response' }, { status: 502 })
    }

    const result = safeParseJSON<BrainstormOutput>(raw, FALLBACK)
    return Response.json({ result })
  } catch (err) {
    console.error('[brainstorm]', err)
    return Response.json({ error: 'Brainstorm agent failed' }, { status: 500 })
  }
}
