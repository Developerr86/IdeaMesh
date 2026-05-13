'use client'

import { PitchDeckOutput } from '@/types/pipeline'
import { AgentCard } from '@/components/ui/AgentCard'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PitchDeckPanelProps {
  deck?: PitchDeckOutput
  isRunning: boolean
  isError?: boolean
  errorMessage?: string
  onRetry?: () => void
}

function TitleSlide({ slide }: { slide: PitchDeckOutput['slides'][number] }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-8 py-16">
      <h2 className="text-2xl font-semibold text-white mb-3">{slide.title}</h2>
      {slide.subtitle && (
        <p className="text-sm text-white/50 max-w-md leading-relaxed">{slide.subtitle}</p>
      )}
    </div>
  )
}

function BulletsSlide({ slide }: { slide: PitchDeckOutput['slides'][number] }) {
  return (
    <div className="px-6 py-8">
      <h3 className="text-base font-semibold text-white mb-1">{slide.title}</h3>
      {slide.subtitle && <p className="text-xs text-white/40 mb-4">{slide.subtitle}</p>}
      <ul className="space-y-2.5">
        {slide.content.map((point, i) => (
          <li key={i} className="flex gap-3 text-sm text-white/70 leading-relaxed">
            <span className="text-accent-green mt-0.5 flex-shrink-0">→</span>
            {point}
          </li>
        ))}
      </ul>
    </div>
  )
}

function TwoColumnSlide({ slide }: { slide: PitchDeckOutput['slides'][number] }) {
  const mid = Math.ceil(slide.content.length / 2)
  return (
    <div className="px-6 py-8">
      <h3 className="text-base font-semibold text-white mb-1">{slide.title}</h3>
      {slide.subtitle && <p className="text-xs text-white/40 mb-4">{slide.subtitle}</p>}
      <div className="grid grid-cols-2 gap-6">
        <ul className="space-y-2.5">
          {slide.content.slice(0, mid).map((point, i) => (
            <li key={i} className="flex gap-2 text-sm text-white/70 leading-relaxed">
              <span className="text-accent-green mt-0.5 flex-shrink-0">→</span>
              {point}
            </li>
          ))}
        </ul>
        <ul className="space-y-2.5">
          {slide.content.slice(mid).map((point, i) => (
            <li key={i} className="flex gap-2 text-sm text-white/70 leading-relaxed">
              <span className="text-accent-green mt-0.5 flex-shrink-0">→</span>
              {point}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function CenteredSlide({ slide }: { slide: PitchDeckOutput['slides'][number] }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] text-center px-8 py-16">
      <h3 className="text-lg font-semibold text-white mb-3">{slide.title}</h3>
      {slide.subtitle && <p className="text-sm text-white/50 mb-4 max-w-sm">{slide.subtitle}</p>}
      <div className="space-y-2 max-w-md">
        {slide.content.map((point, i) => (
          <p key={i} className="text-sm text-white/70 leading-relaxed">{point}</p>
        ))}
      </div>
    </div>
  )
}

function ClosingSlide({ slide }: { slide: PitchDeckOutput['slides'][number] }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-8 py-16">
      <h2 className="text-xl font-semibold text-white mb-3">{slide.title}</h2>
      {slide.subtitle && <p className="text-sm text-white/50 max-w-md">{slide.subtitle}</p>}
      {slide.content.length > 0 && (
        <div className="mt-6 space-y-2">
          {slide.content.map((point, i) => (
            <p key={i} className="text-sm text-white/60">{point}</p>
          ))}
        </div>
      )}
    </div>
  )
}

const SLIDE_RENDERERS: Record<string, React.FC<{ slide: PitchDeckOutput['slides'][number] }>> = {
  'title-slide': TitleSlide,
  bullets: BulletsSlide,
  'two-column': TwoColumnSlide,
  centered: CenteredSlide,
  closing: ClosingSlide,
}

export function PitchDeckPanel({ deck, isRunning, isError, errorMessage, onRetry }: PitchDeckPanelProps) {
  const [currentSlide, setCurrentSlide] = useState(0)

  if (!deck && !isRunning && !isError) return null

  const slides = deck?.slides ?? []
  const total = slides.length
  const slide = slides[currentSlide]

  const SlideComponent = slide ? (SLIDE_RENDERERS[slide.layout] ?? BulletsSlide) : null

  return (
    <div className="space-y-4">
      <AgentCard
        agentName="Pitch Deck Agent"
        accentColor="text-accent-green"
        isRunning={isRunning && !deck}
        isError={isError}
        errorMessage={errorMessage}
        onRetry={onRetry}
      >
        {deck && slide && SlideComponent ? (
          <div>
            {/* Slide number indicator */}
            <div className="flex items-center gap-2 px-6 pt-4 pb-2">
              <span className="text-[10px] font-mono text-white/30">
                {currentSlide + 1} / {total}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Slide content */}
            <SlideComponent slide={slide} />

            {/* Navigation */}
            <div className="flex items-center justify-between px-6 pb-4 pt-2">
              <button
                onClick={() => setCurrentSlide((i) => Math.max(0, i - 1))}
                disabled={currentSlide === 0}
                className={cn(
                  'flex items-center gap-1 text-xs transition-colors',
                  currentSlide === 0 ? 'text-white/10' : 'text-white/30 hover:text-white/50',
                )}
              >
                <ChevronLeft className="w-3 h-3" />
                Previous
              </button>

              <div className="flex items-center gap-1.5">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className={cn(
                      'w-1.5 h-1.5 rounded-full transition-all',
                      i === currentSlide ? 'bg-accent-green w-3' : 'bg-white/20 hover:bg-white/40',
                    )}
                  />
                ))}
              </div>

              <button
                onClick={() => setCurrentSlide((i) => Math.min(total - 1, i + 1))}
                disabled={currentSlide === total - 1}
                className={cn(
                  'flex items-center gap-1 text-xs transition-colors',
                  currentSlide === total - 1 ? 'text-white/10' : 'text-white/30 hover:text-white/50',
                )}
              >
                Next
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ) : (
          <div className="h-24 flex items-center justify-center">
            <p className="text-xs text-white/20">Generating pitch deck...</p>
          </div>
        )}
      </AgentCard>
    </div>
  )
}
