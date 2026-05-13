import { getAI, getModel } from '@/lib/ai/client'
import { pitchDeckPrompt } from '@/lib/ai/prompts'
import { safeParseJSON } from '@/lib/utils'
import { PipelineContext, PitchDeckOutput } from '@/types/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { context }: { context: PipelineContext } = await req.json()

    const completion = await getAI().chat.completions.create({
      model: getModel(),
      messages: [{ role: 'user', content: pitchDeckPrompt(context) }],
      temperature: 0.6,
      max_tokens: 4000,
    })

    const content = completion.choices[0]?.message?.content ?? '{}'
    const result = safeParseJSON<PitchDeckOutput>(content, { slides: [] })
    return Response.json({ result })
  } catch (err) {
    console.error('[pitchdeck]', err)
    return Response.json({ error: 'Pitch deck agent failed' }, { status: 500 })
  }
}
