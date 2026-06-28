import { getAI, getModel } from '@/lib/ai/client'
import { qaPrompt } from '@/lib/ai/prompts'
import { safeParseJSON } from '@/lib/utils'
import { QAOutput, PipelineContext } from '@/types/pipeline'

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
      messages: [{ role: 'user', content: qaPrompt(context) }],
      temperature: 0.7,
      max_tokens: 1500,
    })

    const raw = completion.choices[0]?.message?.content ?? ''
    if (!raw || raw === '{}') {
      console.error('[qa] empty response from model')
      return Response.json({ error: 'Q&A agent returned empty or invalid response' }, { status: 502 })
    }

    const result = safeParseJSON<QAOutput>(raw, { questions: [] })
    return Response.json({ result })
  } catch (err) {
    console.error('[qa]', err)
    return Response.json({ error: 'Q&A agent failed' }, { status: 500 })
  }
}
