import { getAI, getModel } from '@/lib/ai/client'
import { qaPrompt } from '@/lib/ai/prompts'
import { safeParseJSON } from '@/lib/utils'
import { QAOutput, PipelineContext } from '@/types/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { context }: { context: PipelineContext } = await req.json()

    const completion = await getAI().chat.completions.create({
      model: getModel(),
      messages: [{ role: 'user', content: qaPrompt(context) }],
      temperature: 0.7,
      max_tokens: 800,
    })

    const content = completion.choices[0]?.message?.content ?? '{}'
    const result = safeParseJSON<QAOutput>(content, { questions: [] })
    return Response.json({ result })
  } catch (err) {
    console.error('[qa]', err)
    return Response.json({ error: 'Q&A agent failed' }, { status: 500 })
  }
}
