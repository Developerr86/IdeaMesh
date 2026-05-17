'use client'

import { usePipelineStore } from '@/store/pipelineStore'
import { StageRail } from '@/components/pipeline/StageRail'
import { STAGES, StageId } from '@/types/pipeline'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Sparkles, RotateCcw, Save, Pencil, Check, Loader2 } from 'lucide-react'
import { UserMenu } from '@/components/ui/UserMenu'
import { useEditModeStore } from '@/store/editModeStore'
import { EditPopover } from '@/components/ui/EditPopover'
import { RefinementQueueBar } from '@/components/ui/RefinementQueueBar'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

const STAGE_ORDER = STAGES.map((s) => s.id)

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', y: 0 }),
  center: { x: 0, y: 0 },
  exit:  (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', y: 0 }),
}

const STAGE_ROUTES: Record<StageId, string> = {
  seed: '/',
  mesh: '/mesh',
  probe: '/probe',
  scout: '/scout',
  compare: '/compare',
  blueprint: '/blueprint',
  pitchdeck: '/pitchdeck',
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { pipeline, resetPipeline, setCurrentStage, savePipeline } = usePipelineStore()
  const router = useRouter()
  const pathname = usePathname()
  const isEditMode = useEditModeStore((s) => s.isEditMode)
  const toggleEditMode = useEditModeStore((s) => s.toggleEditMode)
  const [direction, setDirection] = useState(1)

  useEffect(() => {
    if (!pipeline) {
      router.replace('/')
    }
  }, [pipeline, router])

  // Tri-state save feedback. Derived (not effect-driven): we record the
  // pipeline references that were last successfully persisted in `lastSaved`,
  // and the saved state is true iff the current references still match.
  // Any user mutation produces new references, so the comparison falls back to
  // 'idle' on the very next render — no manual reset needed.
  type SaveState = 'idle' | 'saving' | 'saved'
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<{ context: unknown; stages: unknown } | null>(null)

  if (!pipeline) return null

  const isPersisted =
    lastSaved !== null &&
    lastSaved.context === pipeline.context &&
    lastSaved.stages === pipeline.stages
  const saveState: SaveState = isSaving ? 'saving' : isPersisted ? 'saved' : 'idle'

  const ideaType = pipeline.context.idea?.type || 'personal'
  const hiddenStageIds: StageId[] = ideaType === 'personal' ? ['pitchdeck'] : []

  const handleStageClick = (id: StageId) => {
    const from = STAGE_ORDER.indexOf(pipeline.currentStage)
    const to   = STAGE_ORDER.indexOf(id)
    setDirection(to > from ? 1 : -1)
    setCurrentStage(id)
    router.push(STAGE_ROUTES[id])
  }

  const handleReset = () => {
    resetPipeline()
    router.push('/')
  }

  const handleSave = async () => {
    if (isSaving || isPersisted) return
    setIsSaving(true)
    try {
      await savePipeline()
      // Record the snapshot we just persisted; saveState will derive to 'saved'
      // until pipeline.context or pipeline.stages get new references.
      setLastSaved({ context: pipeline.context, stages: pipeline.stages })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent-purple" />
          <span className="text-xs font-semibold text-gradient-purple">IdeaMesh</span>
        </div>
        <div className="flex-1 mx-6 max-w-xs">
          <p className="text-xs font-medium text-white/60 truncate">{pipeline.context.idea.title}</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleEditMode}
            className={cn(
              'flex items-center gap-1.5 text-xs transition-colors',
              isEditMode
                ? 'text-accent-purple'
                : 'text-white/30 hover:text-white/60',
            )}
            aria-pressed={isEditMode}
          >
            <Pencil className="w-3 h-3" />
            {isEditMode ? 'Editing' : 'Edit'}
          </button>
          <button
            onClick={handleSave}
            disabled={saveState !== 'idle'}
            className={cn(
              'flex items-center gap-1.5 text-xs transition-colors',
              saveState === 'saved'
                ? 'text-accent-green/80 cursor-default'
                : saveState === 'saving'
                  ? 'text-white/40 cursor-progress'
                  : 'text-white/30 hover:text-white/60',
            )}
          >
            {saveState === 'saving' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : saveState === 'saved' ? (
              <Check className="w-3 h-3" />
            ) : (
              <Save className="w-3 h-3" />
            )}
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Save'}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            New idea
          </button>
          <UserMenu />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-48 flex-shrink-0 border-r border-border p-3 overflow-y-auto">
          <StageRail
            currentStage={pipeline.currentStage}
            stages={pipeline.stages}
            onStageClick={handleStageClick}
            hiddenStageIds={hiddenStageIds}
          />
        </aside>

        <main className="flex-1 overflow-hidden relative">
          <AnimatePresence custom={direction} mode="sync" initial={false}>
            <motion.div
              key={pathname}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-0 overflow-y-auto p-6"
            >
              <div className="max-w-2xl mx-auto">
                {children}
              </div>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <EditPopover />
      <RefinementQueueBar />
    </div>
  )
}
