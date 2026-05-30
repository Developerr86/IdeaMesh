import { getAI, getModel } from '@/lib/ai/client'
import { pitchDeckPrompt } from '@/lib/ai/prompts'
import { safeParseJSON } from '@/lib/utils'
import { PipelineContext, PitchDeckOutput } from '@/types/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<{ context: PipelineContext }>

    if (!body.context) {
      return Response.json({ error: 'Missing required field: context' }, { status: 400 })
    }

    const { context } = body

    const completion = await getAI().chat.completions.create({
      model: getModel(),
      messages: [{ role: 'user', content: pitchDeckPrompt(context) }],
      temperature: 0.6,
      max_tokens: 4000,
    })

    const raw = completion.choices[0]?.message?.content ?? ''
    if (!raw || raw === '{}') {
      console.error('[pitchdeck] empty response from model')
      return Response.json({ error: 'Pitch deck agent returned empty or invalid response' }, { status: 502 })
    }

    const result = safeParseJSON<PitchDeckOutput>(raw, { slides: [] })
    return Response.json({ result })
  } catch (err) {
    console.error('[pitchdeck]', err)
    return Response.json({ error: 'Pitch deck agent failed' }, { status: 500 })
  }
}
