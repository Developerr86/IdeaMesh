'use client'

import { cn } from '@/lib/utils'
import { Loader2, RotateCcw } from 'lucide-react'

interface AgentCardProps {
  agentName: string
  accentColor?: string
  isRunning?: boolean
  isError?: boolean
  errorMessage?: string
  onRetry?: () => void
  children: React.ReactNode
  className?: string
}

export function AgentCard({
  agentName,
  accentColor = 'text-white/50',
  isRunning = false,
  isError = false,
  errorMessage,
  onRetry,
  children,
  className,
}: AgentCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface-1 overflow-hidden',
        isError && 'border-accent-coral/30',
        className
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-block w-1.5 h-1.5 rounded-full',
              isRunning ? 'bg-accent-purple animate-pulse' : isError ? 'bg-accent-coral' : 'bg-accent-green'
            )}
          />
          <span className={cn('text-xs font-medium', accentColor)}>{agentName}</span>
        </div>
        {isRunning && <Loader2 className="w-3.5 h-3.5 animate-spin text-white/30" />}
      </div>

      <div className="p-4">
        {isError ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-xs text-accent-coral text-center">{errorMessage || 'An error occurred'}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Retry
              </button>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
