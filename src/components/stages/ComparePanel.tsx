'use client'

import { ComparisonOutput } from '@/types/pipeline'
import { AgentCard } from '@/components/ui/AgentCard'
import { Tag } from '@/components/ui/Tag'
import { ExternalLink } from 'lucide-react'

interface ComparePanelProps {
  comparison?: ComparisonOutput
  isRunning: boolean
  isError?: boolean
  errorMessage?: string
  onRetry?: () => void
}

export function ComparePanel({ comparison, isRunning, isError, errorMessage, onRetry }: ComparePanelProps) {
  return (
    <div className="space-y-4">
      <AgentCard
        agentName="Comparison Agent"
        accentColor="text-accent-teal"
        isRunning={isRunning && !comparison}
        isError={isError}
        errorMessage={errorMessage}
        onRetry={onRetry}
      >
        {comparison ? (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium text-white/40 mb-2 uppercase tracking-wider">Market positioning</p>
              <p className="text-sm text-white/70 leading-relaxed">{comparison.marketPositioning}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-accent-teal mb-2 uppercase tracking-wider">Our edge</p>
              <ul className="space-y-1.5">
                {comparison.ourEdge.map((e, i) => (
                  <li key={i} className="text-xs text-white/60 flex gap-1.5">
                    <span className="text-accent-teal flex-shrink-0">✓</span>{e}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-medium text-accent-amber mb-2 uppercase tracking-wider">Improvement suggestions</p>
              <ul className="space-y-1.5">
                {comparison.improvementSuggestions.map((s, i) => (
                  <li key={i} className="text-xs text-white/60 flex gap-1.5">
                    <span className="text-accent-amber flex-shrink-0">→</span>{s}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-medium text-white/40 mb-2 uppercase tracking-wider">Competitors</p>
              <div className="space-y-3">
                {comparison.competitors.map((comp, i) => (
                  <div key={i} className="p-3 rounded-lg bg-surface-2 border border-border space-y-2">
                    <div className="flex items-center gap-2">
                      <a
                        href={comp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-white/80 hover:text-white flex items-center gap-1"
                      >
                        {comp.name} <ExternalLink className="w-3 h-3 text-white/30" />
                      </a>
                    </div>
                    <p className="text-xs text-white/40 italic">{comp.differentiator}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-accent-coral mb-1">Overlaps</p>
                        <div className="flex flex-wrap gap-1">
                          {comp.overlap.map((o, j) => <Tag key={j} variant="coral">{o}</Tag>)}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-accent-green mb-1">Gaps we fill</p>
                        <div className="flex flex-wrap gap-1">
                          {comp.gaps.map((g, j) => <Tag key={j} variant="green">{g}</Tag>)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-24 flex items-center justify-center">
            <p className="text-xs text-white/20">Comparing...</p>
          </div>
        )}
      </AgentCard>
    </div>
  )
}
