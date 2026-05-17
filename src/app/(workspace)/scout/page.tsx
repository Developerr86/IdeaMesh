'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePipelineStore } from '@/store/pipelineStore'
import { ScoutPanel } from '@/components/stages/ScoutPanel'
import { ScoutOutput } from '@/types/pipeline'
import { ChevronRight, RefreshCw } from 'lucide-react'

export default function ScoutPage() {
  const { pipeline, setStageStatus, setCurrentStage, updateContext } = usePipelineStore()
  const router = useRouter()
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const stageStatus = pipeline?.stages.scout.status

  useEffect(() => {
    if (!pipeline) {
      router.replace('/')
      return
    }
  }, [pipeline, router])

  const runScout = useCallback(async () => {
    if (!pipeline) return
    setIsRunning(true)
    setError(undefined)
    setStageStatus('scout', 'running')
    setCurrentStage('scout')

    try {
      const res = await fetch('/api/agents/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: pipeline.context }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      updateContext({ scout: data.result as ScoutOutput })
      setStageStatus('scout', 'done')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Scout stage failed'
      setError(message)
      setStageStatus('scout', 'error', message)
    } finally {
      setIsRunning(false)
    }
  }, [pipeline, setStageStatus, setCurrentStage, updateContext])

  useEffect(() => {
    if (!pipeline || stageStatus === 'done' || stageStatus === 'running') return
    const id = setTimeout(() => runScout(), 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline?.id])

  if (!pipeline) return null

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-sm font-semibold text-white mb-1">Stage 4 — Scout</h1>
          <p className="text-xs text-white/30">Finding similar projects and competitors across the web.</p>
        </div>
        {stageStatus === 'done' && (
          <button
            onClick={runScout}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Re-run
          </button>
        )}
      </div>

      <ScoutPanel
        scout={pipeline.context.scout}
        isRunning={isRunning}
        isError={stageStatus === 'error'}
        errorMessage={error}
        onRetry={runScout}
      />

      {stageStatus === 'done' && (
        <button
          onClick={() => { setCurrentStage('compare'); router.push('/compare') }}
          className="flex items-center gap-1.5 text-xs font-medium text-accent-blue hover:text-accent-blue/80 transition-colors"
        >
          Continue to Compare <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
