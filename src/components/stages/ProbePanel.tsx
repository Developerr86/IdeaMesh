'use client'

import { ProsConsOutput, CritiqueOutput } from '@/types/pipeline'
import { AgentCard } from '@/components/ui/AgentCard'
import { Tag } from '@/components/ui/Tag'
import { EditableBlock } from '@/components/ui/EditableBlock'
import { Skeleton } from '@/components/ui/Skeleton'
import { StreamContainer } from '@/components/ui/StreamContainer'
import { StreamText, StreamBlock } from '@/components/ui/StreamText'
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
    <StreamBlock>
      <EditableBlock
        stage="probe"
        path={`prosCons.${field}`}
        label={title}
        variant="block"
      >
        <p className={`text-xs font-medium ${titleColor} mb-2`}>{title}</p>
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <StreamBlock key={i} as="li">
              <EditableBlock
                stage="probe"
                path={`prosCons.${field}[${i}]`}
                label={`${labelSingular} #${i + 1}`}
                variant="inline"
              >
                <span className="text-xs text-white/60 flex gap-1.5">
                  <span className={`${symbolColor} flex-shrink-0`}>{symbol}</span>
                  <StreamText>{item}</StreamText>
                </span>
              </EditableBlock>
            </StreamBlock>
          ))}
        </ul>
      </EditableBlock>
    </StreamBlock>
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
          <StreamContainer className="grid grid-cols-2 gap-4">
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
          </StreamContainer>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-20 mb-3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ))}
          </div>
        )}
      </AgentCard>

      <AgentCard
        agentName="Critique Agent"
        accentColor="text-accent-coral"
        isRunning={isRunning && !critique}
      >
        {critique ? (
          <StreamContainer className="space-y-3">
            <StreamBlock className="flex items-center gap-2">
              <ShieldAlert className={`w-4 h-4 ${RISK_COLOR[critique.riskLevel]}`} />
              <span className={`text-xs font-medium ${RISK_COLOR[critique.riskLevel]}`}>
                {critique.riskLevel.charAt(0).toUpperCase() + critique.riskLevel.slice(1)} risk
              </span>
            </StreamBlock>
            <StreamBlock>
              <EditableBlock
                stage="probe"
                path="critique.critique"
                label="Critique narrative"
                variant="block"
              >
                <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line"><StreamText>{critique.critique}</StreamText></p>
              </EditableBlock>
            </StreamBlock>
            <StreamBlock>
              <EditableBlock stage="probe" path="critique.tags" label="Risk tags" variant="block">
                <div className="flex flex-wrap gap-1.5">
                  {critique.tags.map((tag, i) => <Tag key={i} variant="coral"><StreamText>{tag}</StreamText></Tag>)}
                </div>
              </EditableBlock>
            </StreamBlock>
            {critique.keyAssumptions.length > 0 && (
              <StreamBlock>
                <EditableBlock
                  stage="probe"
                  path="critique.keyAssumptions"
                  label="Key assumptions"
                  variant="block"
                >
                  <p className="text-xs font-medium text-white/40 mb-2 uppercase tracking-wider">Key assumptions</p>
                  <ul className="space-y-1">
                    {critique.keyAssumptions.map((a, i) => (
                      <StreamBlock key={i} as="li">
                        <EditableBlock
                          stage="probe"
                          path={`critique.keyAssumptions[${i}]`}
                          label={`Assumption #${i + 1}`}
                          variant="inline"
                        >
                          <span className="text-xs text-white/50 flex gap-1.5">
                            <span className="text-white/20">?</span><StreamText>{a}</StreamText>
                          </span>
                        </EditableBlock>
                      </StreamBlock>
                    ))}
                  </ul>
                </EditableBlock>
              </StreamBlock>
            )}
          </StreamContainer>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/5" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16 rounded-md" />
              <Skeleton className="h-6 w-20 rounded-md" />
              <Skeleton className="h-6 w-24 rounded-md" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-32 mb-2" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        )}
      </AgentCard>
    </div>
  )
}
