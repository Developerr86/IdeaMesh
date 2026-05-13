'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePipelineStore } from '@/store/pipelineStore'
import { BlueprintPanel } from '@/components/stages/BlueprintPanel'
import { BlueprintOutput } from '@/types/pipeline'
import { ChevronRight, RefreshCw } from 'lucide-react'

export default function BlueprintPage() {
  const { pipeline, setStageStatus, setCurrentStage, updateContext } = usePipelineStore()
  const router = useRouter()
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const stageStatus = pipeline?.stages.blueprint.status

  useEffect(() => {
    if (!pipeline) {
      router.replace('/')
      return
    }
  }, [pipeline, router])

  const runBlueprint = useCallback(async () => {
    if (!pipeline) return
    setIsRunning(true)
    setError(undefined)
    setStageStatus('blueprint', 'running')
    setCurrentStage('blueprint')

    try {
      const res = await fetch('/api/agents/blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: pipeline.context }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      updateContext({ blueprint: data.result as BlueprintOutput })
      setStageStatus('blueprint', 'done')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Blueprint agent failed'
      setError(message)
      setStageStatus('blueprint', 'error', message)
    } finally {
      setIsRunning(false)
    }
  }, [pipeline, setStageStatus, setCurrentStage, updateContext])

  useEffect(() => {
    if (!pipeline || stageStatus === 'done' || stageStatus === 'running') return
    const id = setTimeout(() => runBlueprint(), 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline?.id])

  if (!pipeline) return null

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-sm font-semibold text-white mb-1">Stage 6 — Blueprint</h1>
          <p className="text-xs text-white/30">
            {stageStatus === 'done'
              ? 'Your complete build plan is ready.'
              : 'Synthesising everything into a build plan...'}
          </p>
        </div>
        {stageStatus === 'done' && (
          <button
            onClick={runBlueprint}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Re-run
          </button>
        )}
      </div>

      <BlueprintPanel
        blueprint={pipeline.context.blueprint}
        isRunning={isRunning}
        isError={stageStatus === 'error'}
        errorMessage={error}
        onRetry={runBlueprint}
      />

      {stageStatus === 'done' && pipeline.context.idea.type === 'business' && (
        <button
          onClick={() => { setCurrentStage('pitchdeck'); router.push('/pitchdeck') }}
          className="flex items-center gap-1.5 text-xs font-medium text-accent-green hover:text-accent-green/80 transition-colors"
        >
          Generate Pitch Deck <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
