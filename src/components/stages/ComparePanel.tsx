'use client'

import { ComparisonOutput } from '@/types/pipeline'
import { AgentCard } from '@/components/ui/AgentCard'
import { Tag } from '@/components/ui/Tag'
import { Skeleton } from '@/components/ui/Skeleton'
import { StreamContainer } from '@/components/ui/StreamContainer'
import { StreamText, StreamBlock } from '@/components/ui/StreamText'
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
          <StreamContainer className="space-y-5">
            <StreamBlock>
              <p className="text-xs font-medium text-white/40 mb-2 uppercase tracking-wider">Market positioning</p>
              <p className="text-sm text-white/70 leading-relaxed"><StreamText>{comparison.marketPositioning}</StreamText></p>
            </StreamBlock>

            <StreamBlock>
              <p className="text-xs font-medium text-accent-teal mb-2 uppercase tracking-wider">Our edge</p>
              <ul className="space-y-1.5">
                {comparison.ourEdge.map((e, i) => (
                  <StreamBlock key={i} as="li" className="text-xs text-white/60 flex gap-1.5">
                    <span className="text-accent-teal flex-shrink-0">✓</span><StreamText>{e}</StreamText>
                  </StreamBlock>
                ))}
              </ul>
            </StreamBlock>

            <StreamBlock>
              <p className="text-xs font-medium text-accent-amber mb-2 uppercase tracking-wider">Improvement suggestions</p>
              <ul className="space-y-1.5">
                {comparison.improvementSuggestions.map((s, i) => (
                  <StreamBlock key={i} as="li" className="text-xs text-white/60 flex gap-1.5">
                    <span className="text-accent-amber flex-shrink-0">→</span><StreamText>{s}</StreamText>
                  </StreamBlock>
                ))}
              </ul>
            </StreamBlock>

            <StreamBlock>
              <p className="text-xs font-medium text-white/40 mb-2 uppercase tracking-wider">Competitors</p>
              <div className="space-y-3">
                {comparison.competitors.map((comp, i) => (
                  <StreamBlock key={i} className="p-3 rounded-lg bg-surface-2 border border-border space-y-2">
                    <div className="flex items-center gap-2">
                      <a
                        href={comp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-white/80 hover:text-white flex items-center gap-1"
                      >
                        <StreamText>{comp.name}</StreamText> <ExternalLink className="w-3 h-3 text-white/30" />
                      </a>
                    </div>
                    <p className="text-xs text-white/40 italic"><StreamText>{comp.differentiator}</StreamText></p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-accent-coral mb-1">Overlaps</p>
                        <div className="flex flex-wrap gap-1">
                          {comp.overlap.map((o, j) => <Tag key={j} variant="coral"><StreamText>{o}</StreamText></Tag>)}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-accent-green mb-1">Gaps we fill</p>
                        <div className="flex flex-wrap gap-1">
                          {comp.gaps.map((g, j) => <Tag key={j} variant="green"><StreamText>{g}</StreamText></Tag>)}
                        </div>
                      </div>
                    </div>
                  </StreamBlock>
                ))}
              </div>
            </StreamBlock>
          </StreamContainer>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-3 w-32 mb-2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
            
            <div className="space-y-2">
              <Skeleton className="h-3 w-24 mb-2" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-4/5" />
            </div>

            <div className="space-y-2">
              <Skeleton className="h-3 w-40 mb-2" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>

            <div className="space-y-3">
              <Skeleton className="h-3 w-24 mb-2" />
              {[1, 2].map((i) => (
                <div key={i} className="p-3 rounded-lg bg-surface-2 border border-border space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Skeleton className="h-2 w-16 mb-2" />
                      <div className="flex gap-1.5"><Skeleton className="h-5 w-16 rounded-md" /><Skeleton className="h-5 w-20 rounded-md" /></div>
                    </div>
                    <div>
                      <Skeleton className="h-2 w-20 mb-2" />
                      <div className="flex gap-1.5"><Skeleton className="h-5 w-14 rounded-md" /><Skeleton className="h-5 w-24 rounded-md" /></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </AgentCard>
    </div>
  )
}
