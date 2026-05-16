import { create } from 'zustand'
import type { StageId } from '@/types/pipeline'

// Identifies a single editable region in the current stage's JSON output.
// `path` is the dotted/indexed path into PipelineContext (e.g. "prosCons.cons[0]").
// `stage` is the stage that owns this path — used by the refinement agent to scope
// schema validation and to know whether to auto-branch.
export interface EditTarget {
  stage: StageId
  path: string
  // Human-readable label for the popover header ("Weakness #2").
  label: string
  // Current value at the path; either a primitive or a sub-object.
  value: unknown
  // Bounding rect of the clicked element; used to position the floating popover.
  anchorRect: { top: number; left: number; width: number; height: number }
}

// A queued user-feedback note targeting a specific path. Multiple of these
// accumulate before a single batched refinement call is made. Keyed by
// (pipelineId, stage, path) — re-queueing at the same target replaces the prior
// note rather than stacking duplicates.
export interface QueuedRefinement {
  id: string
  pipelineId: string
  stage: StageId
  path: string
  label: string
  instruction: string
  createdAt: number
}

interface EditModeStore {
  isEditMode: boolean
  toggleEditMode: () => void
  setEditMode: (on: boolean) => void

  activeEdit: EditTarget | null
  openEdit: (target: EditTarget) => void
  closeEdit: () => void

  queue: QueuedRefinement[]
  enqueue: (item: Omit<QueuedRefinement, 'id' | 'createdAt'>) => void
  removeFromQueue: (id: string) => void
  clearQueueFor: (pipelineId: string, stage: StageId) => void
  // Re-associate every queue item at (oldPipelineId, stage) with newPipelineId.
  // Called after a fork so the user keeps visibility / retry-ability on the
  // new branch if the subsequent refine call fails.
  rekeyQueueFor: (oldPipelineId: string, newPipelineId: string, stage: StageId) => void
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export const useEditModeStore = create<EditModeStore>((set) => ({
  isEditMode: false,
  toggleEditMode: () => set((s) => ({ isEditMode: !s.isEditMode, activeEdit: null })),
  setEditMode: (on) => set({ isEditMode: on, activeEdit: on ? null : null }),

  activeEdit: null,
  openEdit: (target) => set({ activeEdit: target }),
  closeEdit: () => set({ activeEdit: null }),

  queue: [],
  enqueue: (item) =>
    set((s) => {
      // Upsert by (pipelineId, stage, path).
      const idx = s.queue.findIndex(
        (q) =>
          q.pipelineId === item.pipelineId && q.stage === item.stage && q.path === item.path,
      )
      const next: QueuedRefinement = {
        ...item,
        id: idx >= 0 ? s.queue[idx].id : genId(),
        createdAt: idx >= 0 ? s.queue[idx].createdAt : Date.now(),
      }
      if (idx >= 0) {
        const copy = s.queue.slice()
        copy[idx] = next
        return { queue: copy }
      }
      return { queue: [...s.queue, next] }
    }),
  removeFromQueue: (id) => set((s) => ({ queue: s.queue.filter((q) => q.id !== id) })),
  clearQueueFor: (pipelineId, stage) =>
    set((s) => ({
      queue: s.queue.filter((q) => !(q.pipelineId === pipelineId && q.stage === stage)),
    })),
  rekeyQueueFor: (oldPipelineId, newPipelineId, stage) =>
    set((s) => ({
      queue: s.queue.map((q) =>
        q.pipelineId === oldPipelineId && q.stage === stage
          ? { ...q, pipelineId: newPipelineId }
          : q,
      ),
    })),
}))
