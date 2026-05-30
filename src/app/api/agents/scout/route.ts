import { getAI, getModel } from '@/lib/ai/client'
import { scoutSummaryPrompt } from '@/lib/ai/prompts'
import { multiSearch } from '@/lib/search/tavily'
import { safeParseJSON } from '@/lib/utils'
import { PipelineContext, ScoutOutput } from '@/types/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<{ context: PipelineContext }>

    if (!body.context) {
      return Response.json({ error: 'Missing required field: context' }, { status: 400 })
    }

    const { context } = body
    const { title, description } = context.idea

    const queries = [
      `${title} open source GitHub`,
      `${title} Product Hunt`,
      `${description.split(' ').slice(0, 6).join(' ')} software tool`,
      `${title} alternative competitor`,
    ]

    const searchResults = await multiSearch(queries)

    const rawText = searchResults
      .slice(0, 10)
      .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 400)}`)
      .join('\n\n---\n\n')

    const completion = await getAI().chat.completions.create({
      model: getModel(),
      messages: [{ role: 'user', content: scoutSummaryPrompt(context, rawText) }],
      temperature: 0.5,
      max_tokens: 2000,
    })

    const raw = completion.choices[0]?.message?.content ?? ''
    if (!raw || raw === '{}') {
      console.error('[scout] empty response from model')
      return Response.json({ error: 'Scout agent returned empty or invalid response' }, { status: 502 })
    }

    const result = safeParseJSON<ScoutOutput>(raw, { results: [], summary: '' })
    return Response.json({ result })
  } catch (err) {
    console.error('[scout]', err)
    return Response.json({ error: 'Scout agent failed' }, { status: 500 })
  }
}
