'use client'

import { ProsConsOutput, CritiqueOutput } from '@/types/pipeline'
import { AgentCard } from '@/components/ui/AgentCard'
import { Tag } from '@/components/ui/Tag'
import { ShieldAlert } from 'lucide-react'

interface ProbePanelProps {
  prosCons?: ProsConsOutput
  critique?: CritiqueOutput
  isRunning: boolean
  isError?: boolean
  errorMessage?: string
  onRetry?: () => void
}

const RISK_COLOR = {
  low: 'text-accent-green',
  medium: 'text-accent-amber',
  high: 'text-accent-coral',
}

export function ProbePanel({ prosCons, critique, isRunning, isError, errorMessage, onRetry }: ProbePanelProps) {
  return (
    <div className="space-y-4">
      <AgentCard
        agentName="Pros / Cons Agent"
        accentColor="text-accent-coral"
        isRunning={isRunning && !prosCons}
        isError={isError}
        errorMessage={errorMessage}
        onRetry={onRetry}
      >
        {prosCons ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-accent-green mb-2">Strengths</p>
              <ul className="space-y-1.5">
                {prosCons.pros.map((p, i) => (
                  <li key={i} className="text-xs text-white/60 flex gap-1.5">
                    <span className="text-accent-green flex-shrink-0">+</span>{p}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-accent-coral mb-2">Weaknesses</p>
              <ul className="space-y-1.5">
                {prosCons.cons.map((c, i) => (
                  <li key={i} className="text-xs text-white/60 flex gap-1.5">
                    <span className="text-accent-coral flex-shrink-0">−</span>{c}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-accent-blue mb-2">Opportunities</p>
              <ul className="space-y-1.5">
                {prosCons.opportunities.map((o, i) => (
                  <li key={i} className="text-xs text-white/60 flex gap-1.5">
                    <span className="text-accent-blue flex-shrink-0">↑</span>{o}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-accent-amber mb-2">Threats</p>
              <ul className="space-y-1.5">
                {prosCons.threats.map((t, i) => (
                  <li key={i} className="text-xs text-white/60 flex gap-1.5">
                    <span className="text-accent-amber flex-shrink-0">!</span>{t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="h-24 flex items-center justify-center">
            <p className="text-xs text-white/20">Evaluating...</p>
          </div>
        )}
      </AgentCard>

      <AgentCard
        agentName="Critique Agent"
        accentColor="text-accent-coral"
        isRunning={isRunning && !critique}
      >
        {critique ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className={`w-4 h-4 ${RISK_COLOR[critique.riskLevel]}`} />
              <span className={`text-xs font-medium ${RISK_COLOR[critique.riskLevel]}`}>
                {critique.riskLevel.charAt(0).toUpperCase() + critique.riskLevel.slice(1)} risk
              </span>
            </div>
            <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line">{critique.critique}</p>
            <div className="flex flex-wrap gap-1.5">
              {critique.tags.map((tag, i) => <Tag key={i} variant="coral">{tag}</Tag>)}
            </div>
            {critique.keyAssumptions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-white/40 mb-2 uppercase tracking-wider">Key assumptions</p>
                <ul className="space-y-1">
                  {critique.keyAssumptions.map((a, i) => (
                    <li key={i} className="text-xs text-white/50 flex gap-1.5">
                      <span className="text-white/20">?</span>{a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="h-24 flex items-center justify-center">
            <p className="text-xs text-white/20">Critiquing...</p>
          </div>
        )}
      </AgentCard>
    </div>
  )
}
