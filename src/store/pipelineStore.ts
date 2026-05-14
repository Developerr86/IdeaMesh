import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  StageId,
  StageStatus,
  PipelineState,
  PipelineContext,
  StageState,
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

export interface SavedPipelineMeta {
  id: string
  title: string
  description: string
  createdAt: number
  lastModified: number
  stage: StageId
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

  savePipeline: () => Promise<void>
  loadPipeline: (id: string) => Promise<void>
  deletePipeline: (id: string) => Promise<void>
  fetchSavedPipelines: () => Promise<void>
}

async function getAuthUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export const usePipelineStore = create<PipelineStore>()(
  persist(
    (set, get) => ({
      pipeline: null,
      savedPipelines: [],

      initPipeline: (title, description, ideaType = 'personal') => {
        const pipeline: PipelineState = {
          id: generateId(),
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

      savePipeline: async () => {
        const { pipeline, savedPipelines } = get()
        if (!pipeline) return

        const now = Date.now()
        const meta: SavedPipelineMeta = {
          id: pipeline.id,
          title: pipeline.context.idea.title,
          description: pipeline.context.idea.description.slice(0, 100),
          createdAt: pipeline.createdAt,
          lastModified: now,
          stage: pipeline.currentStage,
        }

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
            set({ pipeline: { ...parsed, stages, context } })
          } catch {
            console.error('[store] failed to load pipeline', id)
          }
        }
      },

      deletePipeline: async (id) => {
        const user = await getAuthUser()

        if (user) {
          const supabase = createClient()
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
        const { data } = await supabase
          .from('pipelines')
          .select('id, title, idea_type, current_stage, created_at, updated_at')
          .order('updated_at', { ascending: false })

        if (data) {
          const metas: SavedPipelineMeta[] = data.map((p) => ({
            id: p.id as string,
            title: p.title as string,
            description: '',
            createdAt: new Date(p.created_at as string).getTime(),
            lastModified: new Date(p.updated_at as string).getTime(),
            stage: p.current_stage as StageId,
          }))
          set({ savedPipelines: metas })
        }
      },
    }),
    {
      name: 'ideamesh-pipeline',
      version: 3,
      migrate: (persisted, version) => {
        if (version < 3) {
          return { ...(persisted as object), savedPipelines: [] } as unknown as PipelineStore
        }
        return persisted as PipelineStore
      },
      // Only persist the pipeline in-session state; savedPipelines come from Supabase
      partialize: (state) => ({ pipeline: state.pipeline, savedPipelines: state.savedPipelines }),
    }
  )
)
