import { getAI, getModel } from '@/lib/ai/client'
import { blueprintCorePrompt, blueprintPhasesPrompt, blueprintAgentPromptsPrompt } from '@/lib/ai/prompts'
import { safeParseJSON } from '@/lib/utils'
import { PipelineContext, BlueprintOutput } from '@/types/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

type CoreBlueprint = Omit<BlueprintOutput, 'buildPhases' | 'codingAgentPrompts'>
type PhasesResult = { buildPhases: BlueprintOutput['buildPhases'] }
type PromptsResult = { codingAgentPrompts: BlueprintOutput['codingAgentPrompts'] }

const coreFallback: CoreBlueprint = {
  projectName: '',
  elevatorPitch: '',
  targetAudience: '',
  coreFeatures: [],
  techStack: { frontend: [], backend: [], database: [], infrastructure: [], aiTools: [] },
  mcpSuggestions: [],
  codingTools: [],
  estimatedTimeline: '',
  mvpScope: [],
}

export async function POST(req: Request) {
  try {
    const { context }: { context: PipelineContext } = await req.json()
    const ai = getAI()
    const model = getModel()

    // Round 1 — parallel: core architecture + build phases
    const [coreCompletion, phasesCompletion] = await Promise.all([
      ai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: blueprintCorePrompt(context) }],
        temperature: 0.5,
        max_tokens: 3000,
      }),
      ai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: blueprintPhasesPrompt(context) }],
        temperature: 0.5,
        max_tokens: 4000,
      }),
    ])

    const core = safeParseJSON<CoreBlueprint>(
      coreCompletion.choices[0]?.message?.content ?? '{}',
      coreFallback,
    )
    const phasesData = safeParseJSON<PhasesResult>(
      phasesCompletion.choices[0]?.message?.content ?? '{}',
      { buildPhases: [] },
    )

    // Round 2 — sequential: coding agent prompts (uses core + phases for rich context)
    const promptsCompletion = await ai.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: blueprintAgentPromptsPrompt(context, core, phasesData.buildPhases),
        },
      ],
      temperature: 0.6,
      max_tokens: 6000,
    })

    const promptsData = safeParseJSON<PromptsResult>(
      promptsCompletion.choices[0]?.message?.content ?? '{}',
      { codingAgentPrompts: [] },
    )

    const result: BlueprintOutput = {
      ...core,
      buildPhases: phasesData.buildPhases,
      codingAgentPrompts: promptsData.codingAgentPrompts,
    }

    return Response.json({ result })
  } catch (err) {
    console.error('[blueprint]', err)
    return Response.json({ error: 'Blueprint agent failed' }, { status: 500 })
  }
}
