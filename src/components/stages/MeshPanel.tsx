'use client'

import { BrainstormOutput, QAOutput, UserAnswers } from '@/types/pipeline'
import { AgentCard } from '@/components/ui/AgentCard'
import { Tag } from '@/components/ui/Tag'
import { useState } from 'react'
import { ChevronRight, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MeshPanelProps {
  brainstorm?: BrainstormOutput
  qa?: QAOutput
  userAnswers: UserAnswers
  isRunning: boolean
  isError?: boolean
  errorMessage?: string
  onRetry?: () => void
  onAnswersSubmit: (answers: UserAnswers) => void
}

export function MeshPanel({ brainstorm, qa, userAnswers, isRunning, isError, errorMessage, onRetry, onAnswersSubmit }: MeshPanelProps) {
  const [phase, setPhase] = useState<'brainstorm' | 'qna'>(qa ? 'qna' : 'brainstorm')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [localAnswers, setLocalAnswers] = useState<UserAnswers>(userAnswers)
  const [customMode, setCustomMode] = useState(false)

  const totalQuestions = qa?.questions.length ?? 0
  const currentQuestion = qa?.questions[currentIndex]
  const isLastQuestion = currentIndex >= totalQuestions - 1

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
                <p className="text-sm text-white/80 leading-relaxed">{brainstorm.coreValueProposition}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-white/40 mb-2 uppercase tracking-wider">Expansions</p>
                <ul className="space-y-1.5">
                  {brainstorm.expansions.map((e, i) => (
                    <li key={i} className="flex gap-2 text-sm text-white/70">
                      <span className="text-accent-purple mt-0.5 flex-shrink-0">→</span>
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-white/40 mb-2 uppercase tracking-wider">Target audiences</p>
                <div className="flex flex-wrap gap-1.5">
                  {brainstorm.targetAudiences.map((a, i) => (
                    <Tag key={i} variant="purple">{a}</Tag>
                  ))}
                </div>
              </div>

              {qa && (
                <button
                  onClick={() => setPhase('qna')}
                  className="flex items-center gap-1.5 text-xs font-medium text-accent-purple hover:text-accent-purple/80 transition-colors pt-2"
                >
                  Proceed to Q&A Agent <ChevronRight className="w-3 h-3" />
                </button>
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
                <button
                  onClick={() => onAnswersSubmit(localAnswers)}
                  disabled={!localAnswers[currentQuestion.question]?.trim()}
                  className="flex items-center gap-1.5 text-xs font-medium text-accent-purple hover:text-accent-purple/80 transition-colors disabled:text-white/20 disabled:cursor-not-allowed"
                >
                  Save answers & continue <ChevronRight className="w-3 h-3" />
                </button>
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
