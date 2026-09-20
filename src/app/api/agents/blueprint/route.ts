import { enforceAgentRateLimit } from '@/lib/rateLimit'
import { getAI, getModel } from '@/lib/ai/client'
import { blueprintCorePrompt, blueprintPhasesPrompt, blueprintAgentPromptsPrompt } from '@/lib/ai/prompts'
import { safeParseJSON } from '@/lib/utils'
import { PipelineContext, BlueprintOutput } from '@/types/pipeline'
import { createAgentStream } from '@/lib/stream'

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
  const rateLimit = await enforceAgentRateLimit('blueprint', 5)
  if (rateLimit) return rateLimit
  const { stream, emitAction, emitResult, emitError, close } = createAgentStream<BlueprintOutput>()

  ;(async () => {
    try {
      const body = (await req.json()) as Partial<{ context: PipelineContext }>

      if (!body.context) {
        emitError('Missing required field: context')
        return close()
      }

      const { context } = body
      const ai = getAI()
      const model = getModel()

      emitAction('Drafting core architecture and features', 'brain')

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
        }).then(res => {
          emitAction('Sequencing implementation phases', 'code')
          return res
        })
      ])

      const coreRaw = coreCompletion.choices[0]?.message?.content ?? ''
      if (!coreRaw || coreRaw === '{}') {
        console.error('[blueprint] empty core response from model')
        emitError('Blueprint core agent returned empty or invalid response')
        return close()
      }

      const phasesRaw = phasesCompletion.choices[0]?.message?.content ?? ''
      if (!phasesRaw || phasesRaw === '{}') {
        console.error('[blueprint] empty phases response from model')
        emitError('Blueprint phases agent returned empty or invalid response')
        return close()
      }

      const core = safeParseJSON<CoreBlueprint>(coreRaw, coreFallback)
      const phasesData = safeParseJSON<PhasesResult>(phasesRaw, { buildPhases: [] })

      emitAction('Generating specific agent prompts', 'code')

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

      const promptsRaw = promptsCompletion.choices[0]?.message?.content ?? ''
      if (!promptsRaw || promptsRaw === '{}') {
        console.error('[blueprint] empty prompts response from model')
        emitError('Blueprint prompts agent returned empty or invalid response')
        return close()
      }

      const promptsData = safeParseJSON<PromptsResult>(promptsRaw, { codingAgentPrompts: [] })

      const result: BlueprintOutput = {
        ...core,
        buildPhases: phasesData.buildPhases,
        codingAgentPrompts: promptsData.codingAgentPrompts,
      }

      emitResult(result)
    } catch (err) {
      console.error('[blueprint]', err)
      emitError(err instanceof Error ? err.message : 'Blueprint agent failed')
    } finally {
      close()
    }
  })()

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
