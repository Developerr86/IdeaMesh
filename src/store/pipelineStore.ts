import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  StageId,
  StageStatus,
  PipelineState,
  PipelineContext,
  StageState,
  STAGES,
} from '@/types/pipeline'
import { createClient } from '@/lib/supabase/client'

const DATA_PREFIX = 'ideamesh-data-'

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function defaultStageStates(): Record<StageId, StageState> {
  return {
    seed: { status: 'idle' },
    mesh: { status: 'idle' },
    probe: { status: 'idle' },
    scout: { status: 'idle' },
    compare: { status: 'idle' },
    blueprint: { status: 'idle' },
    pitchdeck: { status: 'idle' },
  }
}

// Ordered stage ids — used to compute which stages are "downstream" of a fork point.
const STAGE_ORDER: StageId[] = STAGES.map((s) => s.id)

function stageIndex(id: StageId): number {
  return STAGE_ORDER.indexOf(id)
}

// Deep clone via structuredClone with a JSON fallback for older runtimes.
function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

export interface SavedPipelineMeta {
  id: string
  title: string
  description: string
  createdAt: number
  lastModified: number
  stage: StageId
  rootId: string
  parentId?: string
  branchName?: string
  forkedAtStage?: StageId
}

interface PipelineStore {
  pipeline: PipelineState | null
  savedPipelines: SavedPipelineMeta[]

  initPipeline: (title: string, description: string, ideaType?: 'personal' | 'business') => void
  resetPipeline: () => void
  setStageStatus: (stage: StageId, status: StageStatus, error?: string) => void
  setCurrentStage: (stage: StageId) => void
  updateContext: (patch: Partial<PipelineContext>) => void
  getPipeline: () => PipelineState | null

  // Branch the current pipeline at `targetStage`. Returns the new branch id, or null
  // if there is no active pipeline. Persists the parent first so the FK is valid.
  branchPipeline: (targetStage: StageId, branchName?: string) => Promise<string | null>

  savePipeline: () => Promise<void>
  loadPipeline: (id: string) => Promise<void>
  deletePipeline: (id: string) => Promise<void>
  fetchSavedPipelines: () => Promise<void>
  // Returns every pipeline (root + branches) sharing the given rootId, ordered by createdAt asc.
  fetchBranches: (rootId: string) => Promise<SavedPipelineMeta[]>
}

async function getAuthUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Reset every stage strictly after `forkStage` back to idle, so the new branch
// can re-run the downstream pipeline with the edited upstream state.
function resetDownstream(
  stages: Record<StageId, StageState>,
  forkStage: StageId,
): Record<StageId, StageState> {
  const forkIdx = stageIndex(forkStage)
  const out = { ...stages }
  for (const id of STAGE_ORDER) {
    if (stageIndex(id) > forkIdx) out[id] = { status: 'idle' }
  }
  return out
}

// Drop downstream context keys when branching, so a re-run actually regenerates them.
function trimDownstreamContext(
  context: PipelineContext,
  forkStage: StageId,
): PipelineContext {
  const forkIdx = stageIndex(forkStage)
  const next: PipelineContext = { idea: context.idea }
  if (context.userAnswers) next.userAnswers = context.userAnswers
  if (forkIdx >= stageIndex('mesh')) {
    if (context.brainstorm) next.brainstorm = context.brainstorm
    if (context.qa) next.qa = context.qa
    if (context.selectedExpansions) next.selectedExpansions = context.selectedExpansions
  }
  if (forkIdx >= stageIndex('probe')) {
    if (context.prosCons) next.prosCons = context.prosCons
    if (context.critique) next.critique = context.critique
  }
  if (forkIdx >= stageIndex('scout') && context.scout) next.scout = context.scout
  if (forkIdx >= stageIndex('compare') && context.comparison) next.comparison = context.comparison
  if (forkIdx >= stageIndex('blueprint') && context.blueprint) next.blueprint = context.blueprint
  if (forkIdx >= stageIndex('pitchdeck') && context.pitchDeck) next.pitchDeck = context.pitchDeck
  return next
}

function metaFromPipeline(p: PipelineState): SavedPipelineMeta {
  return {
    id: p.id,
    title: p.context.idea.title,
    description: p.context.idea.description.slice(0, 100),
    createdAt: p.createdAt,
    lastModified: Date.now(),
    stage: p.currentStage,
    rootId: p.rootId,
    parentId: p.parentId,
    branchName: p.branchName,
    forkedAtStage: p.forkedAtStage,
  }
}

export const usePipelineStore = create<PipelineStore>()(
  persist(
    (set, get) => ({
      pipeline: null,
      savedPipelines: [],

      initPipeline: (title, description, ideaType = 'personal') => {
        const id = generateId()
        const pipeline: PipelineState = {
          id,
          rootId: id,
          createdAt: Date.now(),
          currentStage: 'seed',
          stages: defaultStageStates(),
          context: {
            idea: { title, description, type: ideaType },
          },
        }
        pipeline.stages.seed.status = 'done'
        pipeline.stages.seed.completedAt = Date.now()
        set({ pipeline })
      },

      resetPipeline: () => {
        const { pipeline, savePipeline } = get()
        if (pipeline) {
          savePipeline()
        }
        set({ pipeline: null })
      },

      setStageStatus: (stage, status, error) => {
        set((state) => {
          if (!state.pipeline) return state
          const stages = { ...state.pipeline.stages }
          stages[stage] = {
            ...stages[stage],
            status,
            ...(status === 'running' ? { startedAt: Date.now() } : {}),
            ...(status === 'done' || status === 'error' ? { completedAt: Date.now() } : {}),
            ...(error ? { error } : {}),
          }
          return { pipeline: { ...state.pipeline, stages } }
        })
        if (status === 'done' || status === 'error') {
          get().savePipeline()
        }
      },

      setCurrentStage: (stage) => {
        set((state) => {
          if (!state.pipeline) return state
          return { pipeline: { ...state.pipeline, currentStage: stage } }
        })
      },

      updateContext: (patch) => {
        set((state) => {
          if (!state.pipeline) return state
          return {
            pipeline: {
              ...state.pipeline,
              context: { ...state.pipeline.context, ...patch },
            },
          }
        })
      },

      getPipeline: () => get().pipeline,

      branchPipeline: async (targetStage, branchName) => {
        const current = get().pipeline
        if (!current) return null

        // Persist parent FIRST so the FK reference is valid when we insert the branch.
        await get().savePipeline()

        const newId = generateId()
        const trimmedStages = resetDownstream(current.stages, targetStage)
        const trimmedContext = trimDownstreamContext(current.context, targetStage)

        const branch: PipelineState = {
          id: newId,
          rootId: current.rootId,
          parentId: current.id,
          branchName: branchName ?? `Branch @ ${targetStage}`,
          forkedAtStage: targetStage,
          createdAt: Date.now(),
          currentStage: targetStage,
          stages: deepClone(trimmedStages),
          context: deepClone(trimmedContext),
        }

        set({ pipeline: branch })
        await get().savePipeline()
        return newId
      },

      savePipeline: async () => {
        const { pipeline, savedPipelines } = get()
        if (!pipeline) return

        const meta = metaFromPipeline(pipeline)

        const existing = savedPipelines.findIndex((s) => s.id === pipeline.id)
        if (existing >= 0) {
          const updated = [...savedPipelines]
          updated[existing] = meta
          set({ savedPipelines: updated })
        } else {
          set({ savedPipelines: [meta, ...savedPipelines] })
        }

        const user = await getAuthUser()

        if (user) {
          const supabase = createClient()
          await supabase.from('pipelines').upsert({
            id: pipeline.id,
            user_id: user.id,
            title: pipeline.context.idea.title,
            idea_type: pipeline.context.idea.type,
            current_stage: pipeline.currentStage,
            stages: pipeline.stages,
            context: pipeline.context,
            root_id: pipeline.rootId,
            parent_id: pipeline.parentId ?? null,
            branch_name: pipeline.branchName ?? null,
            forked_at_stage: pipeline.forkedAtStage ?? null,
          })
        } else {
          localStorage.setItem(DATA_PREFIX + pipeline.id, JSON.stringify(pipeline))
        }
      },

      loadPipeline: async (id) => {
        const user = await getAuthUser()

        if (user) {
          const supabase = createClient()
          const { data } = await supabase
            .from('pipelines')
            .select('*')
            .eq('id', id)
            .single()

          if (data) {
            const stages = { ...defaultStageStates(), ...(data.stages as Record<StageId, StageState>) }
            const context: PipelineContext = {
              ...(data.context as PipelineContext),
              idea: {
                ...(data.context as PipelineContext).idea,
                type: data.idea_type === 'business' ? 'business' : 'personal',
              },
            }
            set({
              pipeline: {
                id: data.id,
                createdAt: new Date(data.created_at as string).getTime(),
                currentStage: data.current_stage as StageId,
                stages,
                context,
                rootId: (data.root_id as string | null) ?? (data.id as string),
                parentId: (data.parent_id as string | null) ?? undefined,
                branchName: (data.branch_name as string | null) ?? undefined,
                forkedAtStage: (data.forked_at_stage as StageId | null) ?? undefined,
              },
            })
          }
        } else {
          const raw = localStorage.getItem(DATA_PREFIX + id)
          if (!raw) return
          try {
            const parsed: PipelineState = JSON.parse(raw)
            const stages = { ...defaultStageStates(), ...parsed.stages }
            const context: PipelineContext = {
              ...parsed.context,
              idea: {
                ...parsed.context.idea,
                type: (parsed.context.idea as { type?: string }).type === 'business' ? 'business' : 'personal',
              },
            }
            // Backfill rootId for pre-branching pipelines.
            const rootId = parsed.rootId ?? parsed.id
            set({ pipeline: { ...parsed, stages, context, rootId } })
          } catch {
            console.error('[store] failed to load pipeline', id)
          }
        }
      },

      deletePipeline: async (id) => {
        const user = await getAuthUser()

        if (user) {
          const supabase = createClient()
          // FK is ON DELETE CASCADE, so descendant branches are removed automatically.
          await supabase.from('pipelines').delete().eq('id', id)
        } else {
          localStorage.removeItem(DATA_PREFIX + id)
        }

        set((state) => ({
          savedPipelines: state.savedPipelines.filter((s) => s.id !== id),
        }))
      },

      fetchSavedPipelines: async () => {
        const user = await getAuthUser()

        if (!user) return

        const supabase = createClient()
        // Only return root pipelines for the saved-list view; branches are shown
        // nested via fetchBranches().
        const { data } = await supabase
          .from('pipelines')
          .select('id, title, idea_type, current_stage, created_at, updated_at, root_id, parent_id, branch_name, forked_at_stage')
          .is('parent_id', null)
          .order('updated_at', { ascending: false })

        if (data) {
          const metas: SavedPipelineMeta[] = data.map((p) => ({
            id: p.id as string,
            title: p.title as string,
            description: '',
            createdAt: new Date(p.created_at as string).getTime(),
            lastModified: new Date(p.updated_at as string).getTime(),
            stage: p.current_stage as StageId,
            rootId: (p.root_id as string | null) ?? (p.id as string),
            parentId: (p.parent_id as string | null) ?? undefined,
            branchName: (p.branch_name as string | null) ?? undefined,
            forkedAtStage: (p.forked_at_stage as StageId | null) ?? undefined,
          }))
          set({ savedPipelines: metas })
        }
      },

      fetchBranches: async (rootId) => {
        const user = await getAuthUser()
        if (!user) {
          // Local fallback: scan the in-memory savedPipelines list.
          return get().savedPipelines.filter((p) => p.rootId === rootId)
        }
        const supabase = createClient()
        const { data } = await supabase
          .from('pipelines')
          .select('id, title, idea_type, current_stage, created_at, updated_at, root_id, parent_id, branch_name, forked_at_stage')
          .eq('root_id', rootId)
          .order('created_at', { ascending: true })

        if (!data) return []
        return data.map((p) => ({
          id: p.id as string,
          title: p.title as string,
          description: '',
          createdAt: new Date(p.created_at as string).getTime(),
          lastModified: new Date(p.updated_at as string).getTime(),
          stage: p.current_stage as StageId,
          rootId: (p.root_id as string | null) ?? (p.id as string),
          parentId: (p.parent_id as string | null) ?? undefined,
          branchName: (p.branch_name as string | null) ?? undefined,
          forkedAtStage: (p.forked_at_stage as StageId | null) ?? undefined,
        }))
      },
    }),
    {
      name: 'ideamesh-pipeline',
      version: 4,
      migrate: (persisted, version) => {
        if (version < 3) {
          return { ...(persisted as object), savedPipelines: [] } as unknown as PipelineStore
        }
        if (version < 4) {
          // v4: every PipelineState now requires `rootId`. Backfill for any in-flight pipeline.
          const state = persisted as Partial<PipelineStore>
          if (state.pipeline && !state.pipeline.rootId) {
            state.pipeline = { ...state.pipeline, rootId: state.pipeline.id }
          }
          if (Array.isArray(state.savedPipelines)) {
            state.savedPipelines = state.savedPipelines.map((p) =>
              p.rootId ? p : { ...p, rootId: p.id },
            )
          }
          return state as unknown as PipelineStore
        }
        return persisted as PipelineStore
      },
      partialize: (state) => ({ pipeline: state.pipeline, savedPipelines: state.savedPipelines }),
    },
  ),
)
