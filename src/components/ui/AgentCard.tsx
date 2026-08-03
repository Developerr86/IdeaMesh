'use client'

import { cn } from '@/lib/utils'
import { Loader2, RotateCcw, Search, Globe, Brain, Code, Check } from 'lucide-react'
import type { AgentAction } from '@/lib/stream'

interface AgentCardProps {
  agentName: string
  accentColor?: string
  isRunning?: boolean
  isError?: boolean
  errorMessage?: string
  onRetry?: () => void
  actions?: AgentAction[]
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
  actions,
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
          <>
            {isRunning && actions && actions.length > 0 ? (
              <ActionHistory actions={actions} />
            ) : (
              children
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ActionHistory({ actions }: { actions: AgentAction[] }) {
  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'search': return <Search className="w-3.5 h-3.5 text-white/40" />
      case 'globe': return <Globe className="w-3.5 h-3.5 text-white/40" />
      case 'brain': return <Brain className="w-3.5 h-3.5 text-white/40" />
      case 'code': return <Code className="w-3.5 h-3.5 text-white/40" />
      case 'check': return <Check className="w-3.5 h-3.5 text-white/40" />
      default: return <Brain className="w-3.5 h-3.5 text-white/40" />
    }
  }

  return (
    <div className="py-2 pl-2">
      <div className="space-y-0">
        {actions.map((action, idx) => (
          <div key={action.id} className="relative flex items-start gap-3">
            {/* Vertical line connecting icons */}
            {idx !== actions.length - 1 && (
              <div className="absolute left-[7px] top-6 bottom-[-8px] w-px bg-border" />
            )}
            
            <div className="relative z-10 flex-shrink-0 mt-1.5 bg-surface-1">
              {getIcon(action.icon)}
            </div>
            
            <div className="py-1 text-xs text-white/70">
              {action.message}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
