import { getAI, getModel } from '@/lib/ai/client'
import { comparisonPrompt } from '@/lib/ai/prompts'
import { safeParseJSON } from '@/lib/utils'
import { PipelineContext, ComparisonOutput } from '@/types/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { context }: { context: PipelineContext } = await req.json()

    const completion = await getAI().chat.completions.create({
      model: getModel(),
      messages: [{ role: 'user', content: comparisonPrompt(context) }],
      temperature: 0.6,
      max_tokens: 2000,
    })

    const content = completion.choices[0]?.message?.content ?? '{}'
    const result = safeParseJSON<ComparisonOutput>(content, {
      competitors: [],
      ourEdge: [],
      improvementSuggestions: [],
      marketPositioning: '',
    })
    return Response.json({ result })
  } catch (err) {
    console.error('[compare]', err)
    return Response.json({ error: 'Compare agent failed' }, { status: 500 })
  }
}
