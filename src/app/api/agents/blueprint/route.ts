import { getAI, getModel } from '@/lib/ai/client'
import { blueprintPrompt } from '@/lib/ai/prompts'
import { safeParseJSON } from '@/lib/utils'
import { PipelineContext, BlueprintOutput } from '@/types/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { context }: { context: PipelineContext } = await req.json()

    const completion = await getAI().chat.completions.create({
      model: getModel(),
      messages: [{ role: 'user', content: blueprintPrompt(context) }],
      temperature: 0.5,
      max_tokens: 4000,
    })

    const content = completion.choices[0]?.message?.content ?? '{}'
    const result = safeParseJSON<BlueprintOutput>(content, {
      projectName: '',
      elevatorPitch: '',
      targetAudience: '',
      coreFeatures: [],
      techStack: { frontend: [], backend: [], database: [], infrastructure: [], aiTools: [] },
      mcpSuggestions: [],
      codingTools: [],
      buildPhases: [],
      codingAgentPrompts: [],
      estimatedTimeline: '',
      mvpScope: [],
    })
    return Response.json({ result })
  } catch (err) {
    console.error('[blueprint]', err)
    return Response.json({ error: 'Blueprint agent failed' }, { status: 500 })
  }
}
