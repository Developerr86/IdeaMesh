'use client'

import { BrainstormOutput, QAOutput, UserAnswers } from '@/types/pipeline'
import { AgentCard } from '@/components/ui/AgentCard'
import { Tag } from '@/components/ui/Tag'
import { EditableBlock } from '@/components/ui/EditableBlock'
import { useState, useMemo } from 'react'
import { ChevronRight, ArrowLeft, RefreshCw, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MeshPanelProps {
  brainstorm?: BrainstormOutput
  qa?: QAOutput
  userAnswers: UserAnswers
  selectedExpansions: string[]
  onToggleExpansion: (expansion: string) => void
  isRunning: boolean
  isError?: boolean
  errorMessage?: string
  onRetry?: () => void
  onAnswersSubmit: (answers: UserAnswers) => Promise<void> | void
  onContinue: () => void
}

export function MeshPanel({
  brainstorm,
  qa,
  userAnswers,
  selectedExpansions,
  onToggleExpansion,
  isRunning,
  isError,
  errorMessage,
  onRetry,
  onAnswersSubmit,
  onContinue,
}: MeshPanelProps) {
  const hasQuestions = (qa?.questions?.length ?? 0) > 0
  const [phase, setPhase] = useState<'brainstorm' | 'qna'>(
    hasQuestions ? 'qna' : 'brainstorm',
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [localAnswers, setLocalAnswers] = useState<UserAnswers>(userAnswers)
  const [customMode, setCustomMode] = useState(false)

  // Save-state for the final "Save & continue" button is derived (not setState-
  // from-effect): we compare the persisted `userAnswers` prop to `localAnswers`.
  //   - Equal & non-empty -> 'saved'
  //   - In-flight         -> 'saving'
  //   - Otherwise         -> 'idle'
  // Editing any answer mutates localAnswers, the equality check fails, and the
  // button automatically re-arms.
  type SaveState = 'idle' | 'saving' | 'saved'
  const [isSaving, setIsSaving] = useState(false)

  const totalQuestions = qa?.questions?.length ?? 0
  const currentQuestion = qa?.questions?.[currentIndex]
  const isLastQuestion = currentIndex >= totalQuestions - 1

  const selectedSet = useMemo(() => new Set(selectedExpansions), [selectedExpansions])

  const isFullySaved = useMemo(() => {
    const persistedKeys = Object.keys(userAnswers)
    if (persistedKeys.length === 0) return false
    const localKeys = Object.keys(localAnswers).filter((k) => localAnswers[k]?.trim())
    if (persistedKeys.length !== localKeys.length) return false
    return persistedKeys.every((k) => userAnswers[k] === localAnswers[k])
  }, [userAnswers, localAnswers])

  const saveState: SaveState = isSaving ? 'saving' : isFullySaved ? 'saved' : 'idle'

  function selectOption(question: string, option: string) {
    setLocalAnswers((prev) => ({ ...prev, [question]: option }))
    setCustomMode(false)
  }

  function setCustomAnswer(question: string, value: string) {
    setLocalAnswers((prev) => ({ ...prev, [question]: value }))
  }

  function nextQuestion() {
    if (isLastQuestion) return
    setCurrentIndex((i) => i + 1)
    setCustomMode(false)
  }

  function prevQuestion() {
    if (currentIndex === 0) return
    setCurrentIndex((i) => i - 1)
    setCustomMode(false)
  }

  async function handleSaveAnswers() {
    if (isSaving || isFullySaved) return
    setIsSaving(true)
    try {
      await onAnswersSubmit(localAnswers)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {phase === 'brainstorm' && (
        <AgentCard
          agentName="Brainstorm Agent"
          accentColor="text-accent-purple"
          isRunning={isRunning && !brainstorm}
          isError={isError && !brainstorm}
          errorMessage={errorMessage}
          onRetry={onRetry}
        >
          {brainstorm ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-white/40 mb-2 uppercase tracking-wider">Core value</p>
                <EditableBlock
                  stage="mesh"
                  path="brainstorm.coreValueProposition"
                  label="Core value"
                  variant="block"
                >
                  <p className="text-sm text-white/80 leading-relaxed">{brainstorm.coreValueProposition}</p>
                </EditableBlock>
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-xs font-medium text-white/40 uppercase tracking-wider">Expansions</p>
                  <p className="text-[10px] text-white/25">
                    Tap to opt in · {selectedSet.size}/{brainstorm.expansions.length} selected
                  </p>
                </div>
                <ul className="space-y-1.5">
                  {brainstorm.expansions.map((e, i) => {
                    const isSelected = selectedSet.has(e)
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => onToggleExpansion(e)}
                          className={cn(
                            'w-full text-left flex items-start gap-2 rounded-lg border px-2.5 py-2 transition-all',
                            isSelected
                              ? 'border-accent-purple/50 bg-accent-purple-muted text-white/90'
                              : 'border-border bg-surface-1 text-white/55 hover:border-white/20 hover:text-white/75',
                          )}
                          aria-pressed={isSelected}
                        >
                          <span
                            className={cn(
                              'mt-0.5 flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors',
                              isSelected
                                ? 'border-accent-purple bg-accent-purple text-white'
                                : 'border-white/20 bg-transparent text-transparent',
                            )}
                          >
                            <Check className="w-2.5 h-2.5" strokeWidth={3} />
                          </span>
                          <span className="text-sm leading-snug">{e}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div>
                <p className="text-xs font-medium text-white/40 mb-2 uppercase tracking-wider">Target audiences</p>
                <div className="flex flex-wrap gap-1.5">
                  {brainstorm.targetAudiences.map((a, i) => (
                    <EditableBlock
                      key={i}
                      stage="mesh"
                      path={`brainstorm.targetAudiences[${i}]`}
                      label={`Audience #${i + 1}`}
                      variant="inline"
                    >
                      <Tag variant="purple">{a}</Tag>
                    </EditableBlock>
                  ))}
                </div>
              </div>

              {/* Q&A transition — only show button when we have actual questions */}
              {qa && hasQuestions && (
                <button
                  onClick={() => setPhase('qna')}
                  className="flex items-center gap-1.5 text-xs font-medium text-accent-purple hover:text-accent-purple/80 transition-colors pt-2"
                >
                  Proceed to Q&A Agent <ChevronRight className="w-3 h-3" />
                </button>
              )}

              {/* Q&A returned no questions — let user re-run or skip */}
              {qa && !hasQuestions && (
                <div className="flex items-center gap-4 pt-2">
                  <span className="text-xs text-white/25">Q&A returned no questions.</span>
                  {onRetry && (
                    <button
                      onClick={onRetry}
                      className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Re-run
                    </button>
                  )}
                  <button
                    onClick={onContinue}
                    className="flex items-center gap-1.5 text-xs font-medium text-accent-purple hover:text-accent-purple/80 transition-colors"
                  >
                    Skip to Probe <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="h-24 flex items-center justify-center">
              <p className="text-xs text-white/20">Running brainstorm...</p>
            </div>
          )}
        </AgentCard>
      )}

      {phase === 'qna' && qa && currentQuestion && (
        <AgentCard agentName="Q&A Agent" accentColor="text-accent-purple">
          <div className="space-y-5">
            {/* Progress indicator */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-white/30">
                {currentIndex + 1} / {totalQuestions}
              </span>
              <div className="flex-1 h-0.5 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-purple rounded-full transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
                />
              </div>
            </div>

            {/* Category tag */}
            <div className="flex items-center gap-2">
              <Tag variant="purple">{currentQuestion.category}</Tag>
            </div>

            {/* Question */}
            <div>
              <p className="text-sm text-white/90 font-medium leading-relaxed">
                {currentQuestion.question}
              </p>
            </div>

            {/* Suggested options */}
            {currentQuestion.options && currentQuestion.options.length > 0 && (
              <div className="space-y-1.5">
                {currentQuestion.options.map((option, i) => {
                  const selected = localAnswers[currentQuestion.question] === option && !customMode
                  return (
                    <button
                      key={i}
                      onClick={() => selectOption(currentQuestion.question, option)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 rounded-lg text-xs border transition-all',
                        selected
                          ? 'bg-accent-purple-muted border-accent-purple/30 text-white'
                          : 'bg-surface-2 border-border text-white/60 hover:border-white/20',
                      )}
                    >
                      {option}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Custom answer toggle */}
            <div>
              <button
                onClick={() => setCustomMode(!customMode)}
                className="text-xs text-white/30 hover:text-white/50 transition-colors"
              >
                {customMode ? 'Show suggested options' : 'Write custom answer'}
              </button>

              {customMode && (
                <textarea
                  className="w-full mt-2 bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs text-white/80 placeholder:text-white/20 resize-none focus:outline-none focus:border-accent-purple/50 transition-colors"
                  rows={3}
                  placeholder="Type your answer..."
                  value={localAnswers[currentQuestion.question] || ''}
                  onChange={(e) => setCustomAnswer(currentQuestion.question, e.target.value)}
                />
              )}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={prevQuestion}
                disabled={currentIndex === 0}
                className={cn(
                  'flex items-center gap-1 text-xs transition-colors',
                  currentIndex === 0 ? 'text-white/10' : 'text-white/30 hover:text-white/50',
                )}
              >
                <ArrowLeft className="w-3 h-3" />
                Previous
              </button>

              {isLastQuestion ? (
                <SaveAnswersButton
                  state={saveState}
                  disabled={!localAnswers[currentQuestion.question]?.trim()}
                  onClick={handleSaveAnswers}
                />
              ) : (
                <button
                  onClick={nextQuestion}
                  className="flex items-center gap-1 text-xs text-white/50 hover:text-white/70 transition-colors"
                >
                  Next
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </AgentCard>
      )}

      {phase === 'qna' && !qa && (
        <AgentCard agentName="Q&A Agent" accentColor="text-accent-purple" isRunning={isRunning}>
          <div className="h-24 flex items-center justify-center">
            <p className="text-xs text-white/20">Generating questions...</p>
          </div>
        </AgentCard>
      )}
    </div>
  )
}

interface SaveAnswersButtonProps {
  state: 'idle' | 'saving' | 'saved'
  disabled: boolean
  onClick: () => void
}

function SaveAnswersButton({ state, disabled, onClick }: SaveAnswersButtonProps) {
  const isSaved = state === 'saved'
  const isSaving = state === 'saving'
  return (
    <button
      onClick={onClick}
      disabled={disabled || isSaving || isSaved}
      className={cn(
        'flex items-center gap-1.5 text-xs font-medium transition-colors',
        isSaved
          ? 'text-white/30 cursor-default'
          : isSaving
            ? 'text-accent-purple/60 cursor-progress'
            : 'text-accent-purple hover:text-accent-purple/80',
        disabled && !isSaved && !isSaving && 'text-white/20 cursor-not-allowed',
      )}
    >
      {isSaved && <Check className="w-3 h-3" />}
      {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
      {isSaved ? 'Saved' : isSaving ? 'Saving…' : 'Save answers & continue'}
      {!isSaved && !isSaving && <ChevronRight className="w-3 h-3" />}
    </button>
  )
}
