export const MAX_REFINEMENT_LENGTH = 2000
const INJECTION_PATTERNS = [
  /ignore (all|any|the) (previous|prior|above) instructions?/i,
  /(?:system|developer) (?:message|prompt|instructions?):/i,
  /reveal (?:your|the) (?:system )?prompt/i,
  /act as (?:the )?(?:system|developer)/i,
]
export function validateRefinementInstruction(value: string): string | null {
  const text = value.trim()
  if (!text) return 'Instruction is required'
  if (text.length > MAX_REFINEMENT_LENGTH) return `Instruction too long (max ${MAX_REFINEMENT_LENGTH} chars)`
  if (INJECTION_PATTERNS.some((pattern) => pattern.test(text))) return 'Instruction contains unsupported prompt-control language'
  return null
}
