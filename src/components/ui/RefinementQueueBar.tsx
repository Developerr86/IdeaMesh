'use client'

import { useState, useMemo } from 'react'
import { useEditModeStore } from '@/store/editModeStore'
import { usePipelineStore } from '@/store/pipelineStore'
import { setAtPath, parsePath } from '@/lib/jsonPath'
import { cn } from '@/lib/utils'
import {
  Sparkles,
  ChevronUp,
  ChevronDown,
  X,
  Loader2,
  GitBranch,
  StickyNote,
  Trash2,
} from 'lucide-react'
import type { PipelineContext, StageId } from '@/types/pipeline'

// Stages whose completion would be invalidated if the named stage changes.
// If any of these are 'done', proceeding with refinements creates a single branch.
const DOWNSTREAM_STAGES: Record<StageId, StageId[]> = {
  seed: ['mesh', 'probe', 'scout', 'compare', 'blueprint', 'pitchdeck'],
  mesh: ['probe', 'scout', 'compare', 'blueprint', 'pitchdeck'],
  probe: ['scout', 'compare', 'blueprint', 'pitchdeck'],
  scout: ['compare', 'blueprint', 'pitchdeck'],
  compare: ['blueprint', 'pitchdeck'],
  blueprint: ['pitchdeck'],
  pitchdeck: [],
}

type Phase = 'idle' | 'confirming' | 'forking' | 'refining' | 'error'

export function RefinementQueueBar() {
  const pipeline = usePipelineStore((s) => s.pipeline)
  const updateContext = usePipelineStore((s) => s.updateContext)
  const branchPipeline = usePipelineStore((s) => s.branchPipeline)
  const queue = useEditModeStore((s) => s.queue)
  const removeFromQueue = useEditModeStore((s) => s.removeFromQueue)
  const clearQueueFor = useEditModeStore((s) => s.clearQueueFor)
  const rekeyQueueFor = useEditModeStore((s) => s.rekeyQueueFor)

  const [expanded, setExpanded] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Only consider queue items for the active pipeline AND the active stage.
  // Each stage has its own "proceed" cycle.
  const activeStage = pipeline?.currentStage
  const items = useMemo(() => {
    if (!pipeline || !activeStage) return []
    return queue.filter((q) => q.pipelineId === pipeline.id && q.stage === activeStage)
  }, [queue, pipeline, activeStage])

  if (!pipeline || !activeStage || items.length === 0) return null

  const willFork = DOWNSTREAM_STAGES[activeStage].some(
    (s) => pipeline.stages[s].status === 'done',
  )
  const isBusy = phase === 'forking' || phase === 'refining'

  const handleProceed = async () => {
    setPhase('forking')
    setErrorMsg(null)
    try {
      const sourcePipelineId = pipeline.id
      // 1. Branch if any downstream is done. We capture and use the latest
      //    pipeline state from the store (branchPipeline mutates it). After
      //    forking we re-key the queue items onto the new branch so they stay
      //    visible & retry-able if the subsequent refine call fails.
      if (willFork) {
        const newId = await branchPipeline(activeStage, `Refine @ ${activeStage}`)
        if (newId) rekeyQueueFor(sourcePipelineId, newId, activeStage)
      }

      // 2. Run the batch refinement against whichever pipeline is now active.
      setPhase('refining')
      const activePipeline = usePipelineStore.getState().pipeline
      if (!activePipeline) throw new Error('No active pipeline')

      const res = await fetch('/api/agents/refine-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullContext: activePipeline.context,
          stage: activeStage,
          refinements: items.map((q) => ({
            targetPath: q.path,
            label: q.label,
            instruction: q.instruction,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Batch refine failed')

      // 3. Apply every returned refinement to the (possibly forked) pipeline's
      //    context, then commit one updateContext + savePipeline.
      let nextCtx = usePipelineStore.getState().pipeline?.context as PipelineContext
      const touchedTopKeys = new Set<keyof PipelineContext>()
      for (const r of data.refinements as Array<{ targetPath: string; value: unknown }>) {
        const segs = parsePath(r.targetPath)
        if (segs.length === 0) continue
        touchedTopKeys.add(segs[0] as keyof PipelineContext)
        nextCtx = setAtPath(nextCtx, r.targetPath, r.value)
      }
      const patch: Partial<PipelineContext> = {}
      for (const key of touchedTopKeys) {
        ;(patch as Record<string, unknown>)[key as string] = nextCtx[key]
      }
      updateContext(patch)
      await usePipelineStore.getState().savePipeline()

      // 4. Clear the queue for the now-active pipeline+stage (which is either
      //    the source pipeline or the freshly-forked branch, depending on willFork).
      clearQueueFor(activePipeline.id, activeStage)
      setExpanded(false)
      setPhase('idle')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Refinement failed')
      setPhase('error')
    }
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(640px,calc(100vw-2rem))]">
      <div
        className={cn(
          'rounded-2xl border border-accent-purple/40 bg-surface-1/95 backdrop-blur',
          'shadow-2xl shadow-black/40 overflow-hidden',
        )}
      >
        {/* Header row */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <StickyNote className="w-3.5 h-3.5 text-accent-amber flex-shrink-0" />
            <p className="text-xs font-medium text-white/80 truncate">
              {items.length} refinement{items.length === 1 ? '' : 's'} queued
              <span className="text-white/30"> · {activeStage} stage</span>
            </p>
            {willFork && (
              <span className="flex items-center gap-1 text-[10px] text-accent-purple/80 flex-shrink-0">
                <GitBranch className="w-2.5 h-2.5" />
                will fork
              </span>
            )}
          </div>

          <button
            onClick={() => setExpanded((v) => !v)}
            disabled={isBusy}
            className="text-white/40 hover:text-white/70 transition-colors disabled:opacity-40"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => clearQueueFor(pipeline.id, activeStage)}
            disabled={isBusy}
            className="text-white/30 hover:text-accent-coral/80 transition-colors disabled:opacity-40"
            aria-label="Clear all"
            title="Clear all queued refinements"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {phase === 'confirming' ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPhase('idle')}
                disabled={isBusy}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium text-white/60 hover:text-white/90 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleProceed}
                disabled={isBusy}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium',
                  'bg-accent-purple text-white hover:bg-accent-purple/80 transition-colors',
                )}
              >
                <Sparkles className="w-3 h-3" />
                {willFork ? 'Fork & apply' : 'Apply'}
              </button>
            </div>
          ) : isBusy ? (
            <div className="flex items-center gap-1.5 text-[11px] text-accent-purple">
              <Loader2 className="w-3 h-3 animate-spin" />
              {phase === 'forking' ? 'Forking…' : 'Refining…'}
            </div>
          ) : (
            <button
              onClick={() => setPhase('confirming')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium',
                'bg-accent-purple/20 text-accent-purple hover:bg-accent-purple/30 transition-colors',
              )}
            >
              <Sparkles className="w-3 h-3" />
              Proceed with refinements
            </button>
          )}
        </div>

        {/* Confirmation explainer */}
        {phase === 'confirming' && (
          <div className="px-4 pb-3 -mt-1">
            <p className="text-[11px] text-white/50 leading-relaxed">
              {willFork ? (
                <>
                  This will <span className="text-accent-purple">fork a new branch</span> from{' '}
                  <span className="text-white/70">{activeStage}</span> so the original timeline
                  stays intact, then apply all {items.length} refinement{items.length === 1 ? '' : 's'} together.
                </>
              ) : (
                <>
                  This will apply all {items.length} refinement{items.length === 1 ? '' : 's'} together in one pass.
                  No fork is needed because no downstream stage has run yet.
                </>
              )}
            </p>
          </div>
        )}

        {/* Error banner */}
        {phase === 'error' && errorMsg && (
          <div className="px-4 pb-3 -mt-1 flex items-center justify-between gap-3">
            <p className="text-[11px] text-accent-coral truncate">{errorMsg}</p>
            <button
              onClick={() => setPhase('idle')}
              className="text-[11px] text-white/50 hover:text-white/80 transition-colors flex-shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Expanded list of queued items */}
        {expanded && (
          <div className="border-t border-border max-h-56 overflow-y-auto">
            <ul className="divide-y divide-border">
              {items.map((q) => (
                <li key={q.id} className="px-4 py-2 flex items-start gap-2">
                  <StickyNote className="w-3 h-3 text-accent-amber mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-white/70 truncate">{q.label}</p>
                    <p className="text-[10px] text-white/45 leading-snug whitespace-pre-wrap break-words">
                      {q.instruction}
                    </p>
                  </div>
                  <button
                    onClick={() => removeFromQueue(q.id)}
                    disabled={isBusy}
                    className="text-white/30 hover:text-accent-coral/80 transition-colors flex-shrink-0 disabled:opacity-40"
                    aria-label="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
