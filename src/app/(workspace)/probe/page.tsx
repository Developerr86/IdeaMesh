'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePipelineStore } from '@/store/pipelineStore'
import { ProbePanel } from '@/components/stages/ProbePanel'
import { ProsConsOutput, CritiqueOutput } from '@/types/pipeline'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { useAgentStream } from '@/hooks/useAgentStream'

export default function ProbePage() {
  const { pipeline, setStageStatus, setCurrentStage, updateContext } = usePipelineStore()
  const router = useRouter()
  const probeStream = useAgentStream<{ prosCons: ProsConsOutput; critique: CritiqueOutput }>()
  
  const isRunning = probeStream.isRunning
  const error = probeStream.error

  const ctx = pipeline?.context
  const stageStatus = pipeline?.stages.probe.status

  useEffect(() => {
    if (!pipeline) {
      router.replace('/')
      return
    }
  }, [pipeline, router])

  const runProbe = useCallback(async () => {
    if (!pipeline) return
    setStageStatus('probe', 'running')
    setCurrentStage('probe')

    probeStream.reset()

    try {
      await probeStream.runStream(
        '/api/agents/probe',
        { context: pipeline.context },
        (res) => {
          updateContext({
            prosCons: res.prosCons,
            critique: res.critique,
          })
          setStageStatus('probe', 'done')
        }
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Probe stage failed'
      setStageStatus('probe', 'error', message)
    }
  }, [pipeline, setStageStatus, setCurrentStage, updateContext, probeStream])

  useEffect(() => {
    if (!pipeline || stageStatus === 'done' || stageStatus === 'running') return
    const id = setTimeout(() => runProbe(), 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline?.id])

  if (!pipeline) return null

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-sm font-semibold text-white mb-1">Stage 3 — Probe</h1>
          <p className="text-xs text-white/30">Stress-testing the idea from every angle.</p>
        </div>
        {stageStatus === 'done' && (
          <button
            onClick={runProbe}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Re-run
          </button>
        )}
      </div>

      <ProbePanel
        prosCons={ctx?.prosCons}
        critique={ctx?.critique}
        prosConsActions={probeStream.actions}
        critiqueActions={probeStream.actions}
        isRunning={isRunning}
        isError={stageStatus === 'error'}
        errorMessage={error}
        onRetry={runProbe}
      />

      {stageStatus === 'done' && (
        <button
          onClick={() => { setCurrentStage('scout'); router.push('/scout') }}
          className="flex items-center gap-1.5 text-xs font-medium text-accent-coral hover:text-accent-coral/80 transition-colors"
        >
          Continue to Scout <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
