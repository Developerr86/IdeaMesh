import { getAI, getModel } from '@/lib/ai/client'
import { safeParseJSON } from '@/lib/utils'
import { getAtPath } from '@/lib/jsonPath'
import { PipelineContext, StageId } from '@/types/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface RefineRequest {
  fullContext: PipelineContext
  targetPath: string
  userInstruction: string
  stage: StageId
}

// Heuristically describe the JSON value's shape so the LLM knows what to emit
// without us hardcoding every leaf type.
function describeShape(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return 'string'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (Array.isArray(value)) {
    if (value.length === 0) return 'array of <unknown>'
    return `array of ${describeShape(value[0])}`
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `  "${k}": ${describeShape(v)}`)
      .join(',\n')
    return `object {\n${entries}\n}`
  }
  return typeof value
}

// Produces a concise summary of the upstream context so the refinement stays
// faithful to the project's intent without exploding the prompt.
function contextSummary(ctx: PipelineContext): string {
  const parts: string[] = []
  parts.push(`Idea: ${ctx.idea.title} — ${ctx.idea.description}`)
  parts.push(`Type: ${ctx.idea.type}`)
  if (ctx.brainstorm) {
    parts.push(`Value prop: ${ctx.brainstorm.coreValueProposition}`)
  }
  if (ctx.prosCons) {
    parts.push(`Top strength: ${ctx.prosCons.pros[0] ?? '(n/a)'}`)
    parts.push(`Top weakness: ${ctx.prosCons.cons[0] ?? '(n/a)'}`)
  }
  if (ctx.critique) {
    parts.push(`Risk level: ${ctx.critique.riskLevel}`)
  }
  return parts.join('\n')
}

function buildPrompt(req: RefineRequest, currentValue: unknown): string {
  const shape = describeShape(currentValue)
  const currentJson = JSON.stringify(currentValue, null, 2)

  return `You are a precise content-refinement agent. The user is editing one specific node inside a larger pipeline's JSON output, and wants it rewritten according to their instruction.

## Project context (do not edit, just respect)
${contextSummary(req.fullContext)}

## What you are editing
Stage: ${req.stage}
JSON path: ${req.targetPath}
Current value (its EXACT schema must be preserved):
${currentJson}

## Schema shape (must be matched exactly)
${shape}

## User's instruction
${req.userInstruction}

## Output rules — read carefully
1. Output ONLY a single JSON object: {"value": <refined value>}.
2. The refined value MUST have the same JSON type as the current value (string -> string, array -> array of the same element type, object -> object with the SAME keys and matching value types).
3. Do NOT add, remove, or rename object keys. Do NOT change array length unless the user explicitly asked for more or fewer items.
4. Apply the user's instruction faithfully but do not invent unrelated changes.
5. No markdown fences. No prose. No commentary. Just the JSON.

Respond now with the single JSON object.`
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<RefineRequest>

    if (!body.fullContext || !body.targetPath || !body.userInstruction || !body.stage) {
      return Response.json(
        { error: 'Missing required fields: fullContext, targetPath, userInstruction, stage' },
        { status: 400 },
      )
    }
    if (body.userInstruction.length > 2000) {
      return Response.json({ error: 'Instruction too long (max 2000 chars)' }, { status: 400 })
    }

    const fullReq = body as RefineRequest
    const currentValue = getAtPath(fullReq.fullContext, fullReq.targetPath)
    if (currentValue === undefined) {
      return Response.json({ error: `No value at path: ${fullReq.targetPath}` }, { status: 400 })
    }

    const prompt = buildPrompt(fullReq, currentValue)

    const completion = await getAI().chat.completions.create({
      model: getModel(),
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 1200,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const parsed = safeParseJSON<{ value: unknown }>(raw, { value: null })

    if (parsed.value === null || parsed.value === undefined) {
      console.error('[refine] empty value from model', { raw })
      return Response.json({ error: 'Model returned empty or invalid response' }, { status: 502 })
    }

    if (!sameShape(currentValue, parsed.value)) {
      console.error('[refine] shape mismatch', {
        currentValue,
        refined: parsed.value,
        path: fullReq.targetPath,
      })
      return Response.json(
        { error: 'Refined value did not match the original schema. Please try again.' },
        { status: 502 },
      )
    }

    return Response.json({ value: parsed.value })
  } catch (err) {
    console.error('[refine]', err)
    return Response.json({ error: 'Refinement agent failed' }, { status: 500 })
  }
}

// Validates that the refined value preserves the original JSON shape.
// - Primitives: same typeof.
// - Arrays: array (element-type checks intentionally skipped — element shapes are
//   verified loosely so the model can vary list items naturally).
// - Objects: same set of keys (no additions, no removals).
function sameShape(original: unknown, refined: unknown): boolean {
  if (original === null) return refined === null
  if (Array.isArray(original)) return Array.isArray(refined)
  if (typeof original === 'object') {
    if (refined === null || typeof refined !== 'object' || Array.isArray(refined)) return false
    const a = Object.keys(original as Record<string, unknown>).sort()
    const b = Object.keys(refined as Record<string, unknown>).sort()
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
  }
  return typeof original === typeof refined
}
