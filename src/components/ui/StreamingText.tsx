'use client'

import { cn } from '@/lib/utils'

interface StreamingTextProps {
  text: string
  isStreaming?: boolean
  className?: string
  speed?: number
}

export function StreamingText({ text, isStreaming = false, className }: StreamingTextProps) {
  return (
    <span className={cn('text-sm text-white/70 leading-relaxed', className)}>
      {text}
      {isStreaming && (
        <span className="inline-block w-0.5 h-3.5 bg-accent-purple ml-0.5 animate-cursor-blink align-text-bottom" />
      )}
    </span>
  )
}
