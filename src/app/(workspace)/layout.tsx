'use client'

import { usePipelineStore } from '@/store/pipelineStore'
import { StageRail } from '@/components/pipeline/StageRail'
import { StageId } from '@/types/pipeline'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Sparkles, RotateCcw, Save } from 'lucide-react'
import { UserMenu } from '@/components/ui/UserMenu'

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

  useEffect(() => {
    if (!pipeline) {
      router.replace('/')
    }
  }, [pipeline, router])

  if (!pipeline) return null

  const ideaType = pipeline.context.idea?.type || 'personal'
  const hiddenStageIds: StageId[] = ideaType === 'personal' ? ['pitchdeck'] : []

  const handleStageClick = (id: StageId) => {
    setCurrentStage(id)
    router.push(STAGE_ROUTES[id])
  }

  const handleReset = () => {
    resetPipeline()
    router.push('/')
  }

  const handleSave = () => {
    savePipeline()
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
            onClick={handleSave}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            <Save className="w-3 h-3" />
            Save
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

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
