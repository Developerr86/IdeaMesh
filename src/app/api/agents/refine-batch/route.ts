import { getAI, getModel } from '@/lib/ai/client'
import { safeParseJSON } from '@/lib/utils'
import { getAtPath } from '@/lib/jsonPath'
import { PipelineContext, StageId } from '@/types/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 90

interface RefinementAsk {
  targetPath: string
  label: string
  instruction: string
}

interface BatchRefineRequest {
  fullContext: PipelineContext
  stage: StageId
  refinements: RefinementAsk[]
}

interface RefinementResult {
  targetPath: string
  value: unknown
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

function contextSummary(ctx: PipelineContext): string {
  const parts: string[] = []
  parts.push(`Idea: ${ctx.idea.title} — ${ctx.idea.description}`)
  parts.push(`Type: ${ctx.idea.type}`)
  if (ctx.brainstorm) parts.push(`Value prop: ${ctx.brainstorm.coreValueProposition}`)
  if (ctx.prosCons) {
    parts.push(`Top strength: ${ctx.prosCons.pros[0] ?? '(n/a)'}`)
    parts.push(`Top weakness: ${ctx.prosCons.cons[0] ?? '(n/a)'}`)
  }
  if (ctx.critique) parts.push(`Risk level: ${ctx.critique.riskLevel}`)
  return parts.join('\n')
}

// Same shape validator as /api/agents/refine — see comments there.
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

function buildPrompt(
  req: BatchRefineRequest,
  enriched: Array<RefinementAsk & { currentValue: unknown; shape: string; key: string }>,
): string {
  const items = enriched
    .map(
      (r) =>
        `### Refinement ${r.key} — ${r.label}
Path: ${r.targetPath}
Shape (must be preserved exactly): ${r.shape}
Current value:
${JSON.stringify(r.currentValue, null, 2)}
User feedback:
${r.instruction}`,
    )
    .join('\n\n')

  return `You are a precise content-refinement agent. The user has queued several pieces of feedback on a single pipeline stage. Apply ALL of them in one coherent pass — refinements may interact (e.g. one item asks to soften a claim, another asks to sharpen a related item; keep them consistent with each other).

## Project context (do not edit, just respect)
${contextSummary(req.fullContext)}

## Stage being edited
${req.stage}

## Refinements to apply
${items}

## Output rules — read carefully
1. Output ONLY a single JSON object: {"refinements": [{"key": "<key>", "value": <refined value>}, ...]}.
2. Include ONE entry per refinement above, using the same "key" identifier ("${enriched.map((r) => r.key).join('", "')}").
3. Each refined value MUST have the same JSON type and schema shape as the current value of that refinement (string -> string, array -> array of the same element type, object -> object with the SAME keys).
4. Do NOT add, remove, or rename object keys. Do NOT change array length unless the user explicitly asked for more or fewer items.
5. Apply each user instruction faithfully; do not invent unrelated changes.
6. Keep the set of refinements internally coherent.
7. No markdown fences. No prose. No commentary. Just the JSON object.

Respond now with the single JSON object.`
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<BatchRefineRequest>

    if (!body.fullContext || !body.stage || !Array.isArray(body.refinements)) {
      return Response.json(
        { error: 'Missing required fields: fullContext, stage, refinements' },
        { status: 400 },
      )
    }
    if (body.refinements.length === 0) {
      return Response.json({ error: 'No refinements provided' }, { status: 400 })
    }
    if (body.refinements.length > 50) {
      return Response.json({ error: 'Too many refinements (max 50)' }, { status: 400 })
    }

    const fullReq = body as BatchRefineRequest

    // Enrich each ask with currentValue + shape; assign a short key for the model.
    const enriched: Array<RefinementAsk & { currentValue: unknown; shape: string; key: string }> = []
    for (let i = 0; i < fullReq.refinements.length; i++) {
      const r = fullReq.refinements[i]
      if (!r.targetPath || !r.instruction) {
        return Response.json(
          { error: `Refinement #${i + 1} missing targetPath or instruction` },
          { status: 400 },
        )
      }
      if (r.instruction.length > 2000) {
        return Response.json(
          { error: `Refinement #${i + 1} instruction too long (max 2000 chars)` },
          { status: 400 },
        )
      }
      const currentValue = getAtPath(fullReq.fullContext, r.targetPath)
      if (currentValue === undefined) {
        return Response.json(
          { error: `No value at path: ${r.targetPath}` },
          { status: 400 },
        )
      }
      enriched.push({
        ...r,
        currentValue,
        shape: describeShape(currentValue),
        key: `r${i + 1}`,
      })
    }

    const prompt = buildPrompt(fullReq, enriched)

    const completion = await getAI().chat.completions.create({
      model: getModel(),
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 3000,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const parsed = safeParseJSON<{ refinements: Array<{ key: string; value: unknown }> }>(raw, {
      refinements: [],
    })

    if (!Array.isArray(parsed.refinements) || parsed.refinements.length === 0) {
      console.error('[refine-batch] empty response', { raw })
      return Response.json({ error: 'Model returned empty or invalid response' }, { status: 502 })
    }

    // Match returned keys back to original paths and shape-validate each one.
    const results: RefinementResult[] = []
    for (const e of enriched) {
      const match = parsed.refinements.find((r) => r.key === e.key)
      if (!match) {
        console.error('[refine-batch] missing key in response', { key: e.key, raw })
        return Response.json(
          { error: `Model did not return a refinement for ${e.label}` },
          { status: 502 },
        )
      }
      if (!sameShape(e.currentValue, match.value)) {
        console.error('[refine-batch] shape mismatch', {
          path: e.targetPath,
          currentValue: e.currentValue,
          refined: match.value,
        })
        return Response.json(
          { error: `Refined value for "${e.label}" did not match the original schema` },
          { status: 502 },
        )
      }
      results.push({ targetPath: e.targetPath, value: match.value })
    }

    return Response.json({ refinements: results })
  } catch (err) {
    console.error('[refine-batch]', err)
    return Response.json({ error: 'Batch refinement failed' }, { status: 500 })
  }
}
