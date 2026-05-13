import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  StageId,
  StageStatus,
  PipelineState,
  PipelineContext,
  StageState,
} from '@/types/pipeline'

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

  savePipeline: () => void
  loadPipeline: (id: string) => void
  deletePipeline: (id: string) => void
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

      savePipeline: () => {
        const { pipeline, savedPipelines } = get()
        if (!pipeline) return

        localStorage.setItem(DATA_PREFIX + pipeline.id, JSON.stringify(pipeline))

        const existing = savedPipelines.findIndex((s) => s.id === pipeline.id)
        const meta: SavedPipelineMeta = {
          id: pipeline.id,
          title: pipeline.context.idea.title,
          description: pipeline.context.idea.description.slice(0, 100),
          createdAt: pipeline.createdAt,
          lastModified: Date.now(),
          stage: pipeline.currentStage,
        }

        if (existing >= 0) {
          const updated = [...savedPipelines]
          updated[existing] = meta
          set({ savedPipelines: updated })
        } else {
          set({ savedPipelines: [meta, ...savedPipelines] })
        }
      },

      loadPipeline: (id) => {
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
      },

      deletePipeline: (id) => {
        localStorage.removeItem(DATA_PREFIX + id)
        set((state) => ({
          savedPipelines: state.savedPipelines.filter((s) => s.id !== id),
        }))
      },
    }),
    {
      name: 'ideamesh-pipeline',
      version: 2,
      migrate: (persisted, version) => {
        if (version < 2) {
          return { ...(persisted as object), savedPipelines: [] } as unknown as PipelineStore
        }
        return persisted as PipelineStore
      },
    }
  )
)
