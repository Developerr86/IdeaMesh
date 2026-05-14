'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePipelineStore } from '@/store/pipelineStore'
import { MeshPanel } from '@/components/stages/MeshPanel'
import { UserAnswers, BrainstormOutput, QAOutput } from '@/types/pipeline'
import { ChevronRight, RefreshCw } from 'lucide-react'

export default function MeshPage() {
  const { pipeline, setStageStatus, setCurrentStage, updateContext } = usePipelineStore()
  const router = useRouter()
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const ctx = pipeline?.context
  const stageStatus = pipeline?.stages.mesh.status

  useEffect(() => {
    if (!pipeline) {
      router.replace('/')
      return
    }
  }, [pipeline, router])

  const runMesh = useCallback(async () => {
    if (!pipeline) return
    setIsRunning(true)
    setError(undefined)
    setStageStatus('mesh', 'running')
    setCurrentStage('mesh')

    try {
      const [brainstormRes, qaRes] = await Promise.all([
        fetch('/api/agents/brainstorm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context: pipeline.context }),
        }),
        fetch('/api/agents/qa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context: pipeline.context }),
        }),
      ])

      const [brainstormData, qaData] = await Promise.all([
        brainstormRes.json(),
        qaRes.json(),
      ])

      if (brainstormData.error) throw new Error(brainstormData.error)
      if (qaData.error) throw new Error(qaData.error)

      updateContext({
        brainstorm: brainstormData.result as BrainstormOutput,
        qa: qaData.result as QAOutput,
      })
      setStageStatus('mesh', 'done')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Mesh stage failed'
      setError(message)
      setStageStatus('mesh', 'error', message)
    } finally {
      setIsRunning(false)
    }
  }, [pipeline, setStageStatus, setCurrentStage, updateContext])

  useEffect(() => {
    if (!pipeline || stageStatus === 'done' || stageStatus === 'running') return
    const id = setTimeout(() => runMesh(), 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline?.id])

  function handleAnswersSubmit(answers: UserAnswers) {
    updateContext({ userAnswers: answers })
  }

  function handleContinue() {
    setCurrentStage('probe')
    router.push('/probe')
  }

  if (!pipeline) return null

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-sm font-semibold text-white mb-1">Stage 2 — Mesh</h1>
          <p className="text-xs text-white/30">Expanding your idea and surfacing the right questions.</p>
        </div>
        {stageStatus === 'done' && (
          <button
            onClick={runMesh}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Re-run
          </button>
        )}
      </div>

      <MeshPanel
        brainstorm={ctx?.brainstorm}
        qa={ctx?.qa}
        userAnswers={ctx?.userAnswers ?? {}}
        isRunning={isRunning}
        isError={stageStatus === 'error'}
        errorMessage={error}
        onRetry={runMesh}
        onAnswersSubmit={handleAnswersSubmit}
        onContinue={handleContinue}
      />

      {/* Show Continue once answers are submitted (has keys) or the user skipped Q&A (userAnswers defined but empty) */}
      {ctx?.userAnswers != null && (
        <button
          onClick={handleContinue}
          className="flex items-center gap-1.5 text-xs font-medium text-accent-purple hover:text-accent-purple/80 transition-colors"
        >
          Continue to Probe <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
