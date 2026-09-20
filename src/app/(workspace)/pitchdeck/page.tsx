'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePipelineStore } from '@/store/pipelineStore'
import { PitchDeckPanel } from '@/components/stages/PitchDeckPanel'
import { PitchDeckOutput } from '@/types/pipeline'
import { RefreshCw } from 'lucide-react'
import { useAgentStream } from '@/hooks/useAgentStream'

export default function PitchDeckPage() {
  const { pipeline, setStageStatus, setCurrentStage, updateContext } = usePipelineStore()
  const router = useRouter()
  const pitchdeckStream = useAgentStream<PitchDeckOutput>()
  
  const isRunning = pitchdeckStream.isRunning
  const error = pitchdeckStream.error

  const stageStatus = pipeline?.stages.pitchdeck.status

  useEffect(() => {
    if (!pipeline) {
      router.replace('/')
      return
    }
  }, [pipeline, router])

  const runPitchDeck = useCallback(async () => {
    if (!pipeline) return
    setStageStatus('pitchdeck', 'running')
    setCurrentStage('pitchdeck')

    pitchdeckStream.reset()

    try {
      await pitchdeckStream.runStream(
        '/api/agents/pitchdeck',
        { context: pipeline.context },
        (res) => {
          updateContext({ pitchDeck: res })
          setStageStatus('pitchdeck', 'done')
        }
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Pitch deck agent failed'
      setStageStatus('pitchdeck', 'error', message)
    }
  }, [pipeline, setStageStatus, setCurrentStage, updateContext, pitchdeckStream])

  useEffect(() => {
    if (!pipeline || stageStatus === 'done' || stageStatus === 'running') return
    const id = setTimeout(() => runPitchDeck(), 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline?.id])

  if (!pipeline) return null

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-sm font-semibold text-white mb-1">Stage 7 — Pitch Deck</h1>
          <p className="text-xs text-white/30">
            {stageStatus === 'done'
              ? 'Your pitch deck is ready to present.'
              : 'Generating an investor-ready pitch deck...'}
          </p>
        </div>
        {stageStatus === 'done' && (
          <button
            onClick={runPitchDeck}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Re-run
          </button>
        )}
      </div>

      <PitchDeckPanel
        deck={pipeline.context.pitchDeck}
        pitchdeckActions={pitchdeckStream.actions}
        isRunning={isRunning}
        isError={stageStatus === 'error'}
        errorMessage={error}
        onRetry={runPitchDeck}
      />
    </div>
  )
}
