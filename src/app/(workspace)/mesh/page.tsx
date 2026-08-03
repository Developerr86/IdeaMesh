'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePipelineStore } from '@/store/pipelineStore'
import { MeshPanel } from '@/components/stages/MeshPanel'
import { UserAnswers, BrainstormOutput, QAOutput } from '@/types/pipeline'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { useAgentStream } from '@/hooks/useAgentStream'

export default function MeshPage() {
  const { pipeline, setStageStatus, setCurrentStage, updateContext, savePipeline } = usePipelineStore()
  const router = useRouter()
  const brainstormStream = useAgentStream<BrainstormOutput>()
  const qaStream = useAgentStream<QAOutput>()
  
  const isRunning = brainstormStream.isRunning || qaStream.isRunning
  const error = brainstormStream.error || qaStream.error

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
    setStageStatus('mesh', 'running')
    setCurrentStage('mesh')
    
    brainstormStream.reset()
    qaStream.reset()

    try {
      let bData: BrainstormOutput | undefined
      let qData: QAOutput | undefined

      await Promise.all([
        brainstormStream.runStream(
          '/api/agents/brainstorm',
          { context: pipeline.context },
          (res) => { bData = res }
        ),
        qaStream.runStream(
          '/api/agents/qa',
          { context: pipeline.context },
          (res) => { qData = res }
        )
      ])

      if (bData && qData) {
        updateContext({
          brainstorm: bData,
          qa: qData,
        })
        setStageStatus('mesh', 'done')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Mesh stage failed'
      setStageStatus('mesh', 'error', message)
    }
  }, [pipeline, setStageStatus, setCurrentStage, updateContext, brainstormStream, qaStream])

  useEffect(() => {
    if (!pipeline || stageStatus === 'done' || stageStatus === 'running') return
    const id = setTimeout(() => runMesh(), 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline?.id])

  async function handleAnswersSubmit(answers: UserAnswers) {
    updateContext({ userAnswers: answers })
    await savePipeline()
  }

  function handleToggleExpansion(expansion: string) {
    const current = ctx?.selectedExpansions ?? []
    const next = current.includes(expansion)
      ? current.filter((e) => e !== expansion)
      : [...current, expansion]
    updateContext({ selectedExpansions: next })
  }

  function handleContinue() {
    setCurrentStage('probe')
    router.push('/probe')
  }

  if (!pipeline) return null

  return (
    <div className="space-y-6">
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
        brainstormActions={brainstormStream.actions}
        qaActions={qaStream.actions}
        userAnswers={ctx?.userAnswers ?? {}}
        selectedExpansions={ctx?.selectedExpansions ?? []}
        onToggleExpansion={handleToggleExpansion}
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
