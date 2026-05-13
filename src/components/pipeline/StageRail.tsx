'use client'

import { STAGES, StageId, StageStatus } from '@/types/pipeline'
import { cn } from '@/lib/utils'
import { Check, Circle, AlertCircle, Loader2 } from 'lucide-react'

interface StageRailProps {
  currentStage: StageId
  stages: Record<StageId, { status: StageStatus }>
  onStageClick: (id: StageId) => void
  hiddenStageIds?: StageId[]
}

const STATUS_ICONS = {
  done: Check,
  running: Loader2,
  error: AlertCircle,
  idle: Circle,
}

const STAGE_ACCENT: Record<StageId, string> = {
  seed: 'text-white/60',
  mesh: 'text-accent-purple',
  probe: 'text-accent-coral',
  scout: 'text-accent-blue',
  compare: 'text-accent-teal',
  blueprint: 'text-accent-amber',
  pitchdeck: 'text-accent-green',
}

const STAGE_DOT: Record<StageId, string> = {
  seed: 'bg-white/40',
  mesh: 'bg-accent-purple',
  probe: 'bg-accent-coral',
  scout: 'bg-accent-blue',
  compare: 'bg-accent-teal',
  blueprint: 'bg-accent-amber',
  pitchdeck: 'bg-accent-green',
}

export function StageRail({ currentStage, stages, onStageClick, hiddenStageIds }: StageRailProps) {
  const visibleStages = STAGES.filter((s) => !hiddenStageIds?.includes(s.id))

  return (
    <nav className="flex flex-col gap-1 w-full">
      {visibleStages.map((stage, i) => {
        const stageState = stages[stage.id]
        const isActive = currentStage === stage.id
        const isDone = stageState.status === 'done'
        const isRunning = stageState.status === 'running'
        const isError = stageState.status === 'error'
        const isClickable = isDone || isActive

        const Icon = STATUS_ICONS[stageState.status]

        return (
          <div key={stage.id}>
            <button
              onClick={() => isClickable && onStageClick(stage.id)}
              disabled={!isClickable}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all',
                isActive && 'bg-surface-2',
                isClickable && !isActive && 'hover:bg-surface-2/50 cursor-pointer',
                !isClickable && 'opacity-35 cursor-default',
              )}
            >
              <div
                className={cn(
                  'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center',
                  isDone && 'bg-accent-green/20',
                  isRunning && 'bg-accent-purple/20',
                  isError && 'bg-accent-coral/20',
                  !isDone && !isRunning && !isError && 'bg-surface-3',
                )}
              >
                <Icon
                  className={cn(
                    'w-3 h-3',
                    isDone && 'text-accent-green',
                    isRunning && 'text-accent-purple animate-spin',
                    isError && 'text-accent-coral',
                    !isDone && !isRunning && !isError && 'text-white/20',
                  )}
                />
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-xs font-medium truncate',
                    isActive ? STAGE_ACCENT[stage.id] : isDone ? 'text-white/70' : 'text-white/30',
                  )}
                >
                  {stage.label}
                </p>
                {isActive && (
                  <p className="text-[10px] text-white/30 truncate">{stage.description}</p>
                )}
              </div>

              {isActive && (
                <span className={cn('w-1 h-1 rounded-full flex-shrink-0', STAGE_DOT[stage.id])} />
              )}
            </button>

            {i < visibleStages.length - 1 && (
              <div className="ml-[22px] w-px h-2 bg-border" />
            )}
          </div>
        )
      })}
    </nav>
  )
}
