import OpenAI from 'openai'

let _ai: OpenAI | null = null
let _model: string | null = null

export function getAI(): OpenAI {
  const apiKey = process.env.LLM_API_KEY
  if (!apiKey) {
    throw new Error('LLM_API_KEY is not configured. Set it in .env.local')
  }
  if (!_ai) {
    _ai = new OpenAI({
      apiKey,
      baseURL: process.env.LLM_BASE_URL || undefined,
    })
  }
  return _ai
}

export function getModel(): string {
  if (!_model) {
    const model = process.env.LLM_MODEL
    if (!model) {
      throw new Error('LLM_MODEL is not configured. Set it in .env.local')
    }
    _model = model
  }
  return _model
}
