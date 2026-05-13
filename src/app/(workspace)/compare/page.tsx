'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePipelineStore } from '@/store/pipelineStore'
import { ComparePanel } from '@/components/stages/ComparePanel'
import { ComparisonOutput } from '@/types/pipeline'
import { ChevronRight, RefreshCw } from 'lucide-react'

export default function ComparePage() {
  const { pipeline, setStageStatus, setCurrentStage, updateContext } = usePipelineStore()
  const router = useRouter()
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const stageStatus = pipeline?.stages.compare.status

  useEffect(() => {
    if (!pipeline) {
      router.replace('/')
      return
    }
  }, [pipeline, router])

  const runCompare = useCallback(async () => {
    if (!pipeline) return
    setIsRunning(true)
    setError(undefined)
    setStageStatus('compare', 'running')
    setCurrentStage('compare')

    try {
      const res = await fetch('/api/agents/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: pipeline.context }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      updateContext({ comparison: data.result as ComparisonOutput })
      setStageStatus('compare', 'done')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Compare stage failed'
      setError(message)
      setStageStatus('compare', 'error', message)
    } finally {
      setIsRunning(false)
    }
  }, [pipeline, setStageStatus, setCurrentStage, updateContext])

  useEffect(() => {
    if (!pipeline || stageStatus === 'done' || stageStatus === 'running') return
    const id = setTimeout(() => runCompare(), 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline?.id])

  if (!pipeline) return null

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-sm font-semibold text-white mb-1">Stage 5 — Compare</h1>
          <p className="text-xs text-white/30">Positioning your idea against what exists.</p>
        </div>
        {stageStatus === 'done' && (
          <button
            onClick={runCompare}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Re-run
          </button>
        )}
      </div>

      <ComparePanel
        comparison={pipeline.context.comparison}
        isRunning={isRunning}
        isError={stageStatus === 'error'}
        errorMessage={error}
        onRetry={runCompare}
      />

      {stageStatus === 'done' && (
        <button
          onClick={() => { setCurrentStage('blueprint'); router.push('/blueprint') }}
          className="flex items-center gap-1.5 text-xs font-medium text-accent-teal hover:text-accent-teal/80 transition-colors"
        >
          Generate Blueprint <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
