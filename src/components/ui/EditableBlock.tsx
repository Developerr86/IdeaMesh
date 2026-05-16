'use client'

import { useRef, type ReactNode } from 'react'
import { useEditModeStore } from '@/store/editModeStore'
import { usePipelineStore } from '@/store/pipelineStore'
import { getAtPath } from '@/lib/jsonPath'
import { cn } from '@/lib/utils'
import type { StageId } from '@/types/pipeline'
import { Pencil, X, StickyNote } from 'lucide-react'

interface EditableBlockProps {
  // Stage this block lives in — used by the refinement agent.
  stage: StageId
  // JSON path into PipelineContext (e.g. "prosCons.cons[0]").
  path: string
  // Human-readable label for the popover header.
  label: string
  // Visual hint: render as inline (list item) or block (whole card).
  variant?: 'inline' | 'block'
  className?: string
  children: ReactNode
}

// Wraps a UI region so that when global edit-mode is on, hovering shows a
// "click to refine" affordance and clicking opens the localized chat popover.
// Independently of edit-mode, when a queued refinement targets this block's
// path, a sticky-note chip is rendered below the children so the user sees
// the pending feedback at a glance.
export function EditableBlock({
  stage,
  path,
  label,
  variant = 'inline',
  className,
  children,
}: EditableBlockProps) {
  const isEditMode = useEditModeStore((s) => s.isEditMode)
  const openEdit = useEditModeStore((s) => s.openEdit)
  const activeEdit = useEditModeStore((s) => s.activeEdit)
  const removeFromQueue = useEditModeStore((s) => s.removeFromQueue)
  const pipeline = usePipelineStore((s) => s.pipeline)
  const queuedItem = useEditModeStore((s) =>
    s.queue.find(
      (q) => q.pipelineId === (pipeline?.id ?? '') && q.stage === stage && q.path === path,
    ),
  )
  const ref = useRef<HTMLDivElement>(null)

  const isActive = activeEdit?.path === path && activeEdit?.stage === stage

  const handleClick = (e: React.MouseEvent) => {
    if (!isEditMode) return
    e.stopPropagation()
    if (!ref.current || !pipeline) return
    const rect = ref.current.getBoundingClientRect()
    const value = getAtPath(pipeline.context, path)
    openEdit({
      stage,
      path,
      label,
      value,
      anchorRect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
    })
  }

  // When edit-mode is off and there's no note attached, this is a pure pass-through.
  if (!isEditMode && !queuedItem) {
    return <div className={className}>{children}</div>
  }

  return (
    <div
      ref={ref}
      onClick={handleClick}
      role={isEditMode ? 'button' : undefined}
      tabIndex={isEditMode ? 0 : undefined}
      onKeyDown={(e) => {
        if (!isEditMode) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick(e as unknown as React.MouseEvent)
        }
      }}
      className={cn(
        'relative group transition-all',
        isEditMode && 'cursor-pointer',
        variant === 'inline'
          ? 'rounded-md -mx-1 px-1 py-0.5'
          : 'rounded-xl -m-1 p-1',
        // Outline only when edit mode is on.
        isEditMode && [
          'outline outline-1 outline-dashed outline-offset-2',
          isActive
            ? 'outline-accent-purple/80 bg-accent-purple/5'
            : 'outline-accent-purple/25 hover:outline-accent-purple/70 hover:bg-accent-purple/5',
        ],
        className,
      )}
    >
      {children}

      {isEditMode && (
        <span
          className={cn(
            'pointer-events-none absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full',
            'bg-accent-purple/80 text-white flex items-center justify-center',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            isActive && 'opacity-100',
          )}
        >
          <Pencil className="w-2 h-2" />
        </span>
      )}

      {queuedItem && (
        <StickyNoteChip
          instruction={queuedItem.instruction}
          onRemove={(e) => {
            e.stopPropagation()
            removeFromQueue(queuedItem.id)
          }}
        />
      )}
    </div>
  )
}

interface StickyNoteChipProps {
  instruction: string
  onRemove: (e: React.MouseEvent) => void
}

function StickyNoteChip({ instruction, onRemove }: StickyNoteChipProps) {
  return (
    <div
      role="note"
      className={cn(
        'mt-1.5 flex items-start gap-1.5 rounded-lg px-2 py-1.5',
        // Hand-drawn-ish paper feel: warm amber tint, dashed border, slight tilt.
        'bg-accent-amber-muted border border-dashed border-accent-amber/40',
        '-rotate-[0.4deg] origin-left',
      )}
    >
      <StickyNote className="w-3 h-3 text-accent-amber mt-0.5 flex-shrink-0" />
      <p className="flex-1 text-[10px] leading-snug text-amber-100/80 whitespace-pre-wrap break-words">
        {instruction}
      </p>
      <button
        type="button"
        onClick={onRemove}
        className="text-white/30 hover:text-white/70 transition-colors flex-shrink-0"
        aria-label="Remove note"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}
