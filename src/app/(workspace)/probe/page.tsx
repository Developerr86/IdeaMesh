'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePipelineStore } from '@/store/pipelineStore'
import { ProbePanel } from '@/components/stages/ProbePanel'
import { ProsConsOutput, CritiqueOutput } from '@/types/pipeline'
import { ChevronRight, RefreshCw } from 'lucide-react'

export default function ProbePage() {
  const { pipeline, setStageStatus, setCurrentStage, updateContext } = usePipelineStore()
  const router = useRouter()
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | undefined>()

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
    setIsRunning(true)
    setError(undefined)
    setStageStatus('probe', 'running')
    setCurrentStage('probe')

    try {
      const res = await fetch('/api/agents/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: pipeline.context }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      updateContext({
        prosCons: data.prosCons as ProsConsOutput,
        critique: data.critique as CritiqueOutput,
      })
      setStageStatus('probe', 'done')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Probe stage failed'
      setError(message)
      setStageStatus('probe', 'error', message)
    } finally {
      setIsRunning(false)
    }
  }, [pipeline, setStageStatus, setCurrentStage, updateContext])

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
