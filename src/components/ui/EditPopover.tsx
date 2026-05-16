'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useEditModeStore, type EditTarget } from '@/store/editModeStore'
import { usePipelineStore } from '@/store/pipelineStore'
import { cn } from '@/lib/utils'
import { StickyNote, X, Plus } from 'lucide-react'

const POPOVER_WIDTH = 340
const POPOVER_GAP = 10

// Outer mount point — single instance lives in the workspace layout. Switches the
// keyed inner component when the target changes so internal state resets naturally.
export function EditPopover() {
  const activeEdit = useEditModeStore((s) => s.activeEdit)
  if (!activeEdit) return null
  return <EditPopoverInner key={`${activeEdit.stage}:${activeEdit.path}`} target={activeEdit} />
}

function EditPopoverInner({ target }: { target: EditTarget }) {
  const closeEdit = useEditModeStore((s) => s.closeEdit)
  const enqueue = useEditModeStore((s) => s.enqueue)
  // Find an existing queued refinement for this target so the popover lets the
  // user edit (rather than duplicate) what they previously queued.
  const existing = useEditModeStore((s) =>
    s.queue.find(
      (q) =>
        q.path === target.path &&
        q.stage === target.stage &&
        q.pipelineId === (usePipelineStore.getState().pipeline?.id ?? ''),
    ),
  )

  const [instruction, setInstruction] = useState(existing?.instruction ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Focus the textarea once mounted.
  useEffect(() => {
    const t = setTimeout(() => textareaRef.current?.focus(), 30)
    return () => clearTimeout(t)
  }, [])

  // Close on Esc + on outside click.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeEdit()
    }
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        closeEdit()
      }
    }
    window.addEventListener('keydown', onKey)
    const t = setTimeout(() => window.addEventListener('mousedown', onClick), 50)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
      clearTimeout(t)
    }
  }, [closeEdit])

  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1024
  const rawLeft = target.anchorRect.left + target.anchorRect.width + POPOVER_GAP
  const left =
    rawLeft + POPOVER_WIDTH > viewportW - 12
      ? Math.max(12, target.anchorRect.left - POPOVER_WIDTH - POPOVER_GAP)
      : rawLeft
  const top = Math.max(12, target.anchorRect.top)

  const handleQueue = () => {
    const text = instruction.trim()
    if (!text) return
    const pipeline = usePipelineStore.getState().pipeline
    if (!pipeline) return
    enqueue({
      pipelineId: pipeline.id,
      stage: target.stage,
      path: target.path,
      label: target.label,
      instruction: text,
    })
    closeEdit()
  }

  return createPortal(
    <div
      ref={popoverRef}
      style={{ top, left, width: POPOVER_WIDTH }}
      className={cn(
        'fixed z-50 rounded-2xl border border-accent-purple/30 bg-surface-1/95 backdrop-blur',
        'shadow-2xl shadow-black/40 p-3 animate-fade-up',
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <StickyNote className="w-3 h-3 text-accent-amber flex-shrink-0" />
          <p className="text-[11px] font-semibold text-white/80 truncate">
            {existing ? 'Edit note: ' : 'Note on: '}
            {target.label}
          </p>
        </div>
        <button
          onClick={closeEdit}
          className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0"
          aria-label="Close"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      <div className="mb-2 max-h-24 overflow-y-auto rounded-lg bg-surface-2 px-2 py-1.5">
        <p className="text-[10px] text-white/40 line-clamp-4 whitespace-pre-wrap">
          {formatPreview(target.value)}
        </p>
      </div>

      <textarea
        ref={textareaRef}
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            handleQueue()
          }
        }}
        placeholder="What should change here? e.g. mention the regulatory angle…"
        rows={3}
        className={cn(
          'w-full resize-none rounded-lg bg-surface-2 border border-border',
          'px-2 py-1.5 text-xs text-white/80 placeholder:text-white/20',
          'focus:outline-none focus:border-accent-purple/60 transition-colors',
        )}
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[10px] text-white/30 truncate">
          {existing ? 'Updating queued note' : 'Cmd/Ctrl + Enter to add'}
        </p>
        <button
          onClick={handleQueue}
          disabled={!instruction.trim()}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium',
            'bg-accent-purple/20 text-accent-purple hover:bg-accent-purple/30',
            'disabled:opacity-40 disabled:cursor-not-allowed transition-colors',
          )}
        >
          <Plus className="w-3 h-3" />
          {existing ? 'Update note' : 'Queue refinement'}
        </button>
      </div>
    </div>,
    document.body,
  )
}

function formatPreview(value: unknown): string {
  if (value == null) return '(empty)'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
