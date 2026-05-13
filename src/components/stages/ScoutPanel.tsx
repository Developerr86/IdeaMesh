'use client'

import { ScoutOutput } from '@/types/pipeline'
import { AgentCard } from '@/components/ui/AgentCard'
import { Tag } from '@/components/ui/Tag'
import { ExternalLink, GitFork, Globe, MessageCircle } from 'lucide-react'

interface ScoutPanelProps {
  scout?: ScoutOutput
  isRunning: boolean
  isError?: boolean
  errorMessage?: string
  onRetry?: () => void
}

const SOURCE_ICONS = {
  github: GitFork,
  producthunt: Globe,
  twitter: MessageCircle,
  web: Globe,
}

const SOURCE_COLORS = {
  github: 'default' as const,
  producthunt: 'coral' as const,
  twitter: 'blue' as const,
  web: 'default' as const,
}

export function ScoutPanel({ scout, isRunning, isError, errorMessage, onRetry }: ScoutPanelProps) {
  return (
    <div className="space-y-4">
      <AgentCard
        agentName="Web Search Agent"
        accentColor="text-accent-blue"
        isRunning={isRunning && !scout}
        isError={isError}
        errorMessage={errorMessage}
        onRetry={onRetry}
      >
        {scout ? (
          <div className="space-y-4">
            <p className="text-sm text-white/70 leading-relaxed">{scout.summary}</p>
            <div className="space-y-2">
              {scout.results.map((result, i) => {
                const Icon = SOURCE_ICONS[result.source] ?? Globe
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-lg bg-surface-2 border border-border"
                  >
                    <Icon className="w-4 h-4 text-white/30 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-accent-blue hover:underline truncate"
                        >
                          {result.title}
                        </a>
                        <ExternalLink className="w-3 h-3 text-white/20 flex-shrink-0" />
                      </div>
                      <p className="text-xs text-white/50 leading-relaxed">{result.description}</p>
                      <div className="mt-1.5">
                        <Tag variant={SOURCE_COLORS[result.source]}>{result.source}</Tag>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="h-24 flex items-center justify-center">
            <p className="text-xs text-white/20">Searching the web...</p>
          </div>
        )}
      </AgentCard>
    </div>
  )
}
