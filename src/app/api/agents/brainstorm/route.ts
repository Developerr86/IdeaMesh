import { getAI, getModel } from '@/lib/ai/client'
import { brainstormPrompt } from '@/lib/ai/prompts'
import { safeParseJSON } from '@/lib/utils'
import { BrainstormOutput, PipelineContext } from '@/types/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { context }: { context: PipelineContext } = await req.json()

    const completion = await getAI().chat.completions.create({
      model: getModel(),
      messages: [{ role: 'user', content: brainstormPrompt(context) }],
      temperature: 0.8,
      max_tokens: 1500,
    })

    const content = completion.choices[0]?.message?.content ?? '{}'
    const result = safeParseJSON<BrainstormOutput>(content, {
      expansions: [],
      angles: [],
      targetAudiences: [],
      coreValueProposition: '',
    })
    return Response.json({ result })
  } catch (err) {
    console.error('[brainstorm]', err)
    return Response.json({ error: 'Brainstorm agent failed' }, { status: 500 })
  }
}
