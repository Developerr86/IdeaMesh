'use client'

import { BlueprintOutput } from '@/types/pipeline'
import { AgentCard } from '@/components/ui/AgentCard'
import { Tag } from '@/components/ui/Tag'
import { Copy, Check } from 'lucide-react'
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
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-white mb-1">{blueprint.projectName}</h2>
              <p className="text-sm text-white/60 leading-relaxed">{blueprint.elevatorPitch}</p>
              <div className="mt-2">
                <Tag variant="amber">{blueprint.targetAudience}</Tag>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-white/40 mb-2 uppercase tracking-wider">MVP Features</p>
              <ul className="space-y-1.5">
                {blueprint.mvpScope.map((f, i) => (
                  <li key={i} className="text-xs text-white/60 flex gap-1.5">
                    <span className="text-accent-amber">•</span>{f}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-medium text-white/40 mb-3 uppercase tracking-wider">Tech stack</p>
              <div className="space-y-2">
                {Object.entries(blueprint.techStack).map(([layer, items]) => (
                  <div key={layer} className="flex items-start gap-3">
                    <span className="text-[10px] text-white/30 uppercase tracking-wider w-20 flex-shrink-0 mt-0.5">
                      {layer}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {items.map((item, i) => <Tag key={i}>{item}</Tag>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {blueprint.mcpSuggestions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-white/40 mb-2 uppercase tracking-wider">MCP servers</p>
                <div className="space-y-2">
                  {blueprint.mcpSuggestions.map((mcp, i) => (
                    <div key={i} className="flex gap-3 p-2.5 bg-surface-2 rounded-lg border border-border">
                      <div>
                        <p className="text-xs font-medium text-white/80">{mcp.name}</p>
                        <p className="text-xs text-white/40">{mcp.purpose}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-white/40 mb-3 uppercase tracking-wider">
                Build phases · {blueprint.estimatedTimeline}
              </p>
              <div className="space-y-3">
                {blueprint.buildPhases.map((phase) => (
                  <div key={phase.phase} className="border border-border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-surface-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-accent-amber">Phase {phase.phase}</span>
                        <span className="text-xs font-medium text-white/80">{phase.name}</span>
                      </div>
                      <span className="text-[10px] text-white/30">{phase.duration}</span>
                    </div>
                    <div className="px-3 py-2.5">
                      <ul className="space-y-1 mb-2">
                        {phase.tasks.map((task, j) => (
                          <li key={j} className="text-xs text-white/50 flex gap-1.5">
                            <span className="text-white/20">—</span>{task}
                          </li>
                        ))}
                      </ul>
                      <p className="text-[10px] font-medium text-accent-teal">↳ {phase.deliverable}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-white/40 mb-3 uppercase tracking-wider">Coding agent prompts</p>
              <div className="space-y-2">
                {blueprint.codingAgentPrompts.map((item, i) => (
                  <div key={i} className="p-3 bg-surface-2 rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <Tag variant="purple">{item.label}</Tag>
                      <CopyButton text={item.prompt} />
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed font-mono">{item.prompt}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-24 flex items-center justify-center">
            <p className="text-xs text-white/20">Generating blueprint...</p>
          </div>
        )}
      </AgentCard>
    </div>
  )
}
