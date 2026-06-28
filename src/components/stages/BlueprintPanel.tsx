'use client'

import { BlueprintOutput } from '@/types/pipeline'
import { AgentCard } from '@/components/ui/AgentCard'
import { Tag } from '@/components/ui/Tag'
import { Skeleton } from '@/components/ui/Skeleton'
import { StreamContainer } from '@/components/ui/StreamContainer'
import { StreamText, StreamBlock } from '@/components/ui/StreamText'
import { Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

interface BlueprintPanelProps {
  blueprint?: BlueprintOutput
  isRunning: boolean
  isError?: boolean
  errorMessage?: string
  onRetry?: () => void
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="p-1 rounded hover:bg-surface-2 text-white/30 hover:text-white/60 transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-accent-green" /> : <Copy className="w-3 h-3" />}
    </button>
  )
}

function AgentPromptCarousel({ prompts }: { prompts: BlueprintOutput['codingAgentPrompts'] }) {
  const [idx, setIdx] = useState(0)
  const total = prompts.length
  if (total === 0) return null

  const item = prompts[idx]
  const hasPrev = idx > 0
  const hasNext = idx < total - 1
  const hasGhost1 = idx + 1 < total
  const hasGhost2 = idx + 2 < total

  return (
    <div>
      {/* Card stack */}
      <div className="relative mb-6">
        {/* Ghost card 2 — furthest back */}
        {hasGhost2 && (
          <div className="absolute top-1.5 left-4 right-4 h-full rounded-lg border border-border bg-surface-2 opacity-20" />
        )}
        {/* Ghost card 1 — middle */}
        {hasGhost1 && (
          <div className="absolute top-1 left-2 right-2 h-full rounded-lg border border-border bg-surface-2 opacity-40" />
        )}
        {/* Active card */}
        <div className="relative z-10 p-3 bg-surface-2 rounded-lg border border-border">
          <div className="flex items-start justify-between gap-2 mb-2.5">
            <Tag variant="purple">{item.label}</Tag>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px] text-white/25 font-mono tabular-nums">
                {idx + 1} / {total}
              </span>
              <CopyButton text={item.prompt} />
            </div>
          </div>
          <p className="text-xs text-white/50 leading-relaxed font-mono whitespace-pre-wrap">
            {item.prompt}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={() => setIdx((i) => i - 1)}
          disabled={!hasPrev}
          className="flex items-center gap-1 text-xs text-white/30 hover:text-white/70 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Prev
        </button>

        {/* Dot indicators */}
        <div className="flex items-center gap-1.5">
          {prompts.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`rounded-full transition-all duration-200 ${
                i === idx
                  ? 'w-4 h-1.5 bg-accent-purple'
                  : 'w-1.5 h-1.5 bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => setIdx((i) => i + 1)}
          disabled={!hasNext}
          className="flex items-center gap-1 text-xs text-white/30 hover:text-white/70 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

export function BlueprintPanel({ blueprint, isRunning, isError, errorMessage, onRetry }: BlueprintPanelProps) {
  if (!blueprint && !isRunning && !isError) return null

  return (
    <div className="space-y-4">
      <AgentCard
        agentName="Blueprint Agent"
        accentColor="text-accent-amber"
        isRunning={isRunning && !blueprint}
        isError={isError}
        errorMessage={errorMessage}
        onRetry={onRetry}
      >
        {blueprint ? (
          <StreamContainer className="space-y-6">
            {/* Header */}
            <StreamBlock>
              <h2 className="text-base font-semibold text-white mb-1"><StreamText>{blueprint.projectName}</StreamText></h2>
              <p className="text-sm text-white/60 leading-relaxed"><StreamText>{blueprint.elevatorPitch}</StreamText></p>
              <div className="mt-2">
                <Tag variant="amber"><StreamText>{blueprint.targetAudience}</StreamText></Tag>
              </div>
            </StreamBlock>

            {/* MVP Features */}
            <StreamBlock>
              <p className="text-xs font-medium text-white/40 mb-2 uppercase tracking-wider">MVP Features</p>
              <ul className="space-y-1.5">
                {blueprint.mvpScope.map((f, i) => (
                  <StreamBlock key={i} as="li" className="text-xs text-white/60 flex gap-1.5">
                    <span className="text-accent-amber">•</span><StreamText>{f}</StreamText>
                  </StreamBlock>
                ))}
              </ul>
            </StreamBlock>

            {/* Tech Stack */}
            <StreamBlock>
              <p className="text-xs font-medium text-white/40 mb-3 uppercase tracking-wider">Tech stack</p>
              <div className="space-y-2">
                {Object.entries(blueprint.techStack).map(([layer, items]) => (
                  <StreamBlock key={layer} className="flex items-start gap-3">
                    <span className="text-[10px] text-white/30 uppercase tracking-wider w-20 flex-shrink-0 mt-0.5">
                      <StreamText>{layer}</StreamText>
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {items.map((item, i) => <Tag key={i}><StreamText>{item}</StreamText></Tag>)}
                    </div>
                  </StreamBlock>
                ))}
              </div>
            </StreamBlock>

            {/* MCP Servers */}
            {blueprint.mcpSuggestions.length > 0 && (
              <StreamBlock>
                <p className="text-xs font-medium text-white/40 mb-2 uppercase tracking-wider">MCP servers</p>
                <div className="space-y-2">
                  {blueprint.mcpSuggestions.map((mcp, i) => (
                    <StreamBlock key={i} className="flex gap-3 p-2.5 bg-surface-2 rounded-lg border border-border">
                      <div>
                        <p className="text-xs font-medium text-white/80"><StreamText>{mcp.name}</StreamText></p>
                        <p className="text-xs text-white/40"><StreamText>{mcp.purpose}</StreamText></p>
                      </div>
                    </StreamBlock>
                  ))}
                </div>
              </StreamBlock>
            )}

            {/* Build Phases */}
            <StreamBlock>
              <p className="text-xs font-medium text-white/40 mb-3 uppercase tracking-wider">
                Build phases · <StreamText>{blueprint.estimatedTimeline}</StreamText>
              </p>
              <div className="space-y-3">
                {blueprint.buildPhases.map((phase) => (
                  <StreamBlock key={phase.phase} className="border border-border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-surface-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-accent-amber">Phase {phase.phase}</span>
                        <span className="text-xs font-medium text-white/80"><StreamText>{phase.name}</StreamText></span>
                      </div>
                      <span className="text-[10px] text-white/30"><StreamText>{phase.duration}</StreamText></span>
                    </div>
                    <div className="px-3 py-2.5">
                      <ul className="space-y-1 mb-2">
                        {phase.tasks.map((task, j) => (
                          <li key={j} className="text-xs text-white/50 flex gap-1.5">
                            <span className="text-white/20">—</span><StreamText>{task}</StreamText>
                          </li>
                        ))}
                      </ul>
                      <p className="text-[10px] font-medium text-accent-teal">↳ <StreamText>{phase.deliverable}</StreamText></p>
                    </div>
                  </StreamBlock>
                ))}
              </div>
            </StreamBlock>

            {/* Coding Agent Prompts — carousel */}
            {blueprint.codingAgentPrompts.length > 0 && (
              <StreamBlock>
                <p className="text-xs font-medium text-white/40 mb-3 uppercase tracking-wider">
                  Coding agent prompts
                </p>
                <AgentPromptCarousel prompts={blueprint.codingAgentPrompts} />
              </StreamBlock>
            )}
          </StreamContainer>
        ) : (
          <div className="space-y-8">
            <div className="space-y-3">
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-6 w-32 rounded-full mt-2" />
            </div>

            <div className="space-y-3">
              <Skeleton className="h-3 w-32 mb-2" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-4/5" />
            </div>

            <div className="space-y-3">
              <Skeleton className="h-3 w-24 mb-3" />
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-3 w-20 flex-shrink-0" />
                  <div className="flex gap-2 flex-wrap">
                    <Skeleton className="h-5 w-16 rounded-md" />
                    <Skeleton className="h-5 w-24 rounded-md" />
                    <Skeleton className="h-5 w-20 rounded-md" />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <Skeleton className="h-3 w-40 mb-3" />
              {[1, 2].map((i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <div className="flex justify-between mb-3">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-3 w-full mb-2" />
                  <Skeleton className="h-3 w-5/6" />
                </div>
              ))}
            </div>
          </div>
        )}
      </AgentCard>
    </div>
  )
}
