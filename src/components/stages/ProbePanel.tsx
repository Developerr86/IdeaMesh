'use client'

import { ProsConsOutput, CritiqueOutput } from '@/types/pipeline'
import { AgentCard } from '@/components/ui/AgentCard'
import { Tag } from '@/components/ui/Tag'
import { EditableBlock } from '@/components/ui/EditableBlock'
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

interface QuadrantProps {
  title: string
  titleColor: string
  symbol: string
  symbolColor: string
  items: string[]
  field: 'pros' | 'cons' | 'opportunities' | 'threats'
  labelSingular: string
}

function Quadrant({ title, titleColor, symbol, symbolColor, items, field, labelSingular }: QuadrantProps) {
  return (
    <EditableBlock
      stage="probe"
      path={`prosCons.${field}`}
      label={title}
      variant="block"
    >
      <p className={`text-xs font-medium ${titleColor} mb-2`}>{title}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i}>
            <EditableBlock
              stage="probe"
              path={`prosCons.${field}[${i}]`}
              label={`${labelSingular} #${i + 1}`}
              variant="inline"
            >
              <span className="text-xs text-white/60 flex gap-1.5">
                <span className={`${symbolColor} flex-shrink-0`}>{symbol}</span>
                {item}
              </span>
            </EditableBlock>
          </li>
        ))}
      </ul>
    </EditableBlock>
  )
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
            <Quadrant
              title="Strengths"
              titleColor="text-accent-green"
              symbol="+"
              symbolColor="text-accent-green"
              items={prosCons.pros}
              field="pros"
              labelSingular="Strength"
            />
            <Quadrant
              title="Weaknesses"
              titleColor="text-accent-coral"
              symbol="−"
              symbolColor="text-accent-coral"
              items={prosCons.cons}
              field="cons"
              labelSingular="Weakness"
            />
            <Quadrant
              title="Opportunities"
              titleColor="text-accent-blue"
              symbol="↑"
              symbolColor="text-accent-blue"
              items={prosCons.opportunities}
              field="opportunities"
              labelSingular="Opportunity"
            />
            <Quadrant
              title="Threats"
              titleColor="text-accent-amber"
              symbol="!"
              symbolColor="text-accent-amber"
              items={prosCons.threats}
              field="threats"
              labelSingular="Threat"
            />
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
            <EditableBlock
              stage="probe"
              path="critique.critique"
              label="Critique narrative"
              variant="block"
            >
              <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line">{critique.critique}</p>
            </EditableBlock>
            <EditableBlock stage="probe" path="critique.tags" label="Risk tags" variant="block">
              <div className="flex flex-wrap gap-1.5">
                {critique.tags.map((tag, i) => <Tag key={i} variant="coral">{tag}</Tag>)}
              </div>
            </EditableBlock>
            {critique.keyAssumptions.length > 0 && (
              <EditableBlock
                stage="probe"
                path="critique.keyAssumptions"
                label="Key assumptions"
                variant="block"
              >
                <p className="text-xs font-medium text-white/40 mb-2 uppercase tracking-wider">Key assumptions</p>
                <ul className="space-y-1">
                  {critique.keyAssumptions.map((a, i) => (
                    <li key={i}>
                      <EditableBlock
                        stage="probe"
                        path={`critique.keyAssumptions[${i}]`}
                        label={`Assumption #${i + 1}`}
                        variant="inline"
                      >
                        <span className="text-xs text-white/50 flex gap-1.5">
                          <span className="text-white/20">?</span>{a}
                        </span>
                      </EditableBlock>
                    </li>
                  ))}
                </ul>
              </EditableBlock>
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
