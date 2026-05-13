export type StageId = 'seed' | 'mesh' | 'probe' | 'scout' | 'compare' | 'blueprint' | 'pitchdeck'

export type StageStatus = 'idle' | 'running' | 'done' | 'error'

export interface StageConfig {
  id: StageId
  label: string
  description: string
  accentColor: string
  agents: string[]
}

export const STAGES: StageConfig[] = [
  {
    id: 'seed',
    label: 'Seed',
    description: 'Define your idea',
    accentColor: 'text-white/60',
    agents: ['Input'],
  },
  {
    id: 'mesh',
    label: 'Mesh',
    description: 'Expand & question',
    accentColor: 'text-accent-purple',
    agents: ['Brainstorm', 'Q&A'],
  },
  {
    id: 'probe',
    label: 'Probe',
    description: 'Evaluate & critique',
    accentColor: 'text-accent-coral',
    agents: ['Pros/Cons', 'Critique'],
  },
  {
    id: 'scout',
    label: 'Scout',
    description: 'Find competitors',
    accentColor: 'text-accent-blue',
    agents: ['Web Search'],
  },
  {
    id: 'compare',
    label: 'Compare',
    description: 'Diff & find gaps',
    accentColor: 'text-accent-teal',
    agents: ['Comparison'],
  },
  {
    id: 'blueprint',
    label: 'Blueprint',
    description: 'Build plan',
    accentColor: 'text-accent-amber',
    agents: ['Synthesis'],
  },
  {
    id: 'pitchdeck',
    label: 'Pitch Deck',
    description: 'Investor presentation',
    accentColor: 'text-accent-green',
    agents: ['Pitch Deck'],
  },
]

export interface BrainstormOutput {
  expansions: string[]
  angles: string[]
  targetAudiences: string[]
  coreValueProposition: string
}

export interface QAOutput {
  questions: Array<{
    question: string
    category: 'scope' | 'audience' | 'technical' | 'business' | 'differentiation'
    options: string[]
  }>
}

export interface UserAnswers {
  [question: string]: string
}

export interface ProsConsOutput {
  pros: string[]
  cons: string[]
  opportunities: string[]
  threats: string[]
}

export interface CritiqueOutput {
  critique: string
  riskLevel: 'low' | 'medium' | 'high'
  tags: string[]
  keyAssumptions: string[]
}

export interface SearchResult {
  title: string
  url: string
  description: string
  source: 'github' | 'producthunt' | 'twitter' | 'web'
}

export interface ScoutOutput {
  results: SearchResult[]
  summary: string
}

export interface ComparisonOutput {
  competitors: Array<{
    name: string
    url: string
    overlap: string[]
    gaps: string[]
    differentiator: string
  }>
  ourEdge: string[]
  improvementSuggestions: string[]
  marketPositioning: string
}

export interface BlueprintOutput {
  projectName: string
  elevatorPitch: string
  targetAudience: string
  coreFeatures: string[]
  techStack: {
    frontend: string[]
    backend: string[]
    database: string[]
    infrastructure: string[]
    aiTools: string[]
  }
  mcpSuggestions: Array<{
    name: string
    purpose: string
    url: string
  }>
  codingTools: string[]
  buildPhases: Array<{
    phase: number
    name: string
    duration: string
    tasks: string[]
    deliverable: string
  }>
  codingAgentPrompts: Array<{
    label: string
    prompt: string
  }>
  estimatedTimeline: string
  mvpScope: string[]
}

export interface PitchDeckSlide {
  title: string
  subtitle?: string
  content: string[]
  layout: 'title-slide' | 'bullets' | 'two-column' | 'centered' | 'closing'
}

export interface PitchDeckOutput {
  slides: PitchDeckSlide[]
}

export interface PipelineContext {
  idea: {
    title: string
    description: string
    type: 'personal' | 'business'
  }
  userAnswers?: UserAnswers
  brainstorm?: BrainstormOutput
  qa?: QAOutput
  prosCons?: ProsConsOutput
  critique?: CritiqueOutput
  scout?: ScoutOutput
  comparison?: ComparisonOutput
  blueprint?: BlueprintOutput
  pitchDeck?: PitchDeckOutput
}

export interface StageState {
  status: StageStatus
  startedAt?: number
  completedAt?: number
  error?: string
}

export interface PipelineState {
  id: string
  createdAt: number
  currentStage: StageId
  stages: Record<StageId, StageState>
  context: PipelineContext
}
