'use client'

import { STAGES, StageId, StageStatus } from '@/types/pipeline'
import { usePipelineStore, type SavedPipelineMeta } from '@/store/pipelineStore'
import { cn } from '@/lib/utils'
import { Check, Circle, AlertCircle, Loader2, GitBranch, CornerUpLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

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

const STAGE_ROUTES: Record<StageId, string> = {
  seed: '/',
  mesh: '/mesh',
  probe: '/probe',
  scout: '/scout',
  compare: '/compare',
  blueprint: '/blueprint',
  pitchdeck: '/pitchdeck',
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

const STAGE_LABEL: Record<StageId, string> = Object.fromEntries(
  STAGES.map((s) => [s.id, s.label]),
) as Record<StageId, string>

export function StageRail({ currentStage, stages, onStageClick, hiddenStageIds }: StageRailProps) {
  const pipeline = usePipelineStore((s) => s.pipeline)
  const loadPipeline = usePipelineStore((s) => s.loadPipeline)
  const fetchBranches = usePipelineStore((s) => s.fetchBranches)
  const [branches, setBranches] = useState<SavedPipelineMeta[]>([])
  const router = useRouter()

  // Re-fetch siblings whenever the root or the active pipeline changes (a new
  // branch may have been created since last fetch). When there's no active
  // pipeline, the layout unmounts us anyway, so we don't need to clear here.
  const rootId = pipeline?.rootId
  useEffect(() => {
    if (!rootId) return
    let alive = true
    fetchBranches(rootId).then((b) => {
      if (alive) setBranches(b)
    })
    return () => {
      alive = false
    }
  }, [rootId, pipeline?.id, fetchBranches])

  // Branches forked at each spine stage, excluding the active pipeline.
  const branchesByForkStage = useMemo(() => {
    const map: Partial<Record<StageId, SavedPipelineMeta[]>> = {}
    for (const b of branches) {
      if (b.id === pipeline?.id) continue
      if (!b.forkedAtStage) continue // root handled separately
      ;(map[b.forkedAtStage] ??= []).push(b)
    }
    return map
  }, [branches, pipeline?.id])

  const root = useMemo(() => branches.find((b) => !b.parentId) ?? null, [branches])
  const isOnRoot = !!root && pipeline?.id === root.id

  // Lookup helpers for branch chip subtitles.
  const branchesById = useMemo(() => {
    const m = new Map<string, SavedPipelineMeta>()
    for (const b of branches) m.set(b.id, b)
    return m
  }, [branches])

  const visibleStages = STAGES.filter((s) => !hiddenStageIds?.includes(s.id))

  const handleBranchSwitch = async (id: string) => {
    if (id === pipeline?.id) return
    await loadPipeline(id)
    const next = usePipelineStore.getState().pipeline
    if (next) router.push(STAGE_ROUTES[next.currentStage])
  }

  return (
    <nav className="flex flex-col gap-1 w-full">
      {/* When we're on a branch, surface a chip to jump back to the root timeline. */}
      {root && !isOnRoot && (
        <BranchChip
          isRoot
          isActive={false}
          branch={root}
          parentName={null}
          onClick={() => handleBranchSwitch(root.id)}
        />
      )}

      {visibleStages.map((stage, i) => {
        const stageState = stages[stage.id]
        const isActive = currentStage === stage.id
        const isDone = stageState.status === 'done'
        const isRunning = stageState.status === 'running'
        const isError = stageState.status === 'error'
        const isClickable = isDone || isActive

        const Icon = STATUS_ICONS[stageState.status]
        const forkChildren = branchesByForkStage[stage.id] ?? []

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

            {/* Branches that forked at this stage — drawn as little organic limbs. */}
            {forkChildren.length > 0 && (
              <div className="ml-[10px] mt-1 mb-1 space-y-1">
                {forkChildren.map((branch) => {
                  const parent = branch.parentId ? branchesById.get(branch.parentId) ?? null : null
                  const parentName =
                    parent && parent.id !== root?.id
                      ? parent.branchName ?? `Branch @ ${parent.forkedAtStage ?? '?'}`
                      : null
                  return (
                    <BranchLimb
                      key={branch.id}
                      branch={branch}
                      parentName={parentName}
                      onClick={() => handleBranchSwitch(branch.id)}
                    />
                  )
                })}
              </div>
            )}

            {i < visibleStages.length - 1 && (
              <div className="ml-[22px] w-px h-2 bg-border" />
            )}
          </div>
        )
      })}

      {/* Tag the rail with the active branch name (only meaningful when not on root). */}
      {!isOnRoot && pipeline?.branchName && (
        <div className="mt-3 rounded-2xl border border-dashed border-accent-purple/40 bg-accent-purple/5 px-3 py-2">
          <p className="text-[9px] uppercase tracking-wider text-accent-purple/70">On branch</p>
          <p className="text-xs text-white/80 truncate">{pipeline.branchName}</p>
          {pipeline.forkedAtStage && (
            <p className="text-[10px] text-white/40 mt-0.5">
              forked at {STAGE_LABEL[pipeline.forkedAtStage]}
            </p>
          )}
        </div>
      )}
    </nav>
  )
}

interface BranchChipProps {
  branch: SavedPipelineMeta
  isActive: boolean
  isRoot?: boolean
  parentName: string | null
  onClick: () => void
}

// Compact chip for the "jump back to root" affordance.
function BranchChip({ branch, isActive, isRoot, parentName, onClick }: BranchChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all',
        'border border-dashed',
        isActive
          ? 'border-accent-purple/60 bg-accent-purple/10 text-accent-purple'
          : 'border-border hover:border-accent-purple/40 hover:bg-surface-2/50',
        'mb-2',
      )}
    >
      {isRoot ? (
        <CornerUpLeft className="w-3 h-3 text-white/40 flex-shrink-0" />
      ) : (
        <GitBranch className="w-3 h-3 text-white/40 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white/70 truncate">
          {isRoot ? 'Original timeline' : branch.branchName ?? 'Unnamed branch'}
        </p>
        <p className="text-[10px] text-white/30 truncate">
          {parentName ? `${parentName} → ` : ''}at {STAGE_LABEL[branch.stage]}
        </p>
      </div>
    </button>
  )
}

interface BranchLimbProps {
  branch: SavedPipelineMeta
  parentName: string | null
  onClick: () => void
}

// Stage-row branch limb: a soft dashed elbow followed by a clickable chip.
// The elbow visually conveys "this path forks off at the current stage".
function BranchLimb({ branch, parentName, onClick }: BranchLimbProps) {
  return (
    <div className="flex items-stretch gap-2">
      <div
        aria-hidden
        className="w-3 h-5 border-l border-b border-dashed border-accent-purple/35 rounded-bl-xl mt-1 flex-shrink-0"
      />
      <button
        onClick={onClick}
        className={cn(
          'flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-left transition-all',
          'border border-dashed border-accent-purple/25 bg-surface-1/40',
          'hover:border-accent-purple/60 hover:bg-accent-purple/5 hover:text-white/80',
          'text-white/45',
        )}
      >
        <GitBranch className="w-2.5 h-2.5 text-accent-purple/70 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium truncate">
            {branch.branchName ?? 'Unnamed branch'}
          </p>
          <p className="text-[9px] text-white/30 truncate">
            {parentName ? `via ${parentName} · ` : ''}now at {STAGE_LABEL[branch.stage]}
          </p>
        </div>
      </button>
    </div>
  )
}
