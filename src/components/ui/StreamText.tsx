'use client'

import { motion } from 'framer-motion'

import { cn } from '@/lib/utils'

interface StreamTextProps {
  children: React.ReactNode
  className?: string
}

export function StreamText({ children, className }: StreamTextProps) {
  if (typeof children !== 'string') {
    return <span className={className}>{children}</span>
  }

  const words = children.split(' ')

  return (
    <span className={cn('inline-block', className)}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="inline-block mr-[0.25em] last:mr-0"
          variants={{
            hidden: { opacity: 0, y: 3 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  )
}

interface StreamBlockProps extends StreamTextProps {
  as?: 'div' | 'span' | 'p' | 'li'
}

const MOTION_BLOCKS = { div: motion.div, span: motion.span, p: motion.p, li: motion.li }

// A simple block variant that treats its entire content as one block instead of splitting by word.
// Use this for lists, small tags, etc where word-by-word is too much.
export function StreamBlock({ children, className, as: Component = 'div' }: StreamBlockProps) {
  const MotionBlock = MOTION_BLOCKS[Component]
  return (
    <MotionBlock
      className={className}
      variants={{
        hidden: { opacity: 0, y: 4, filter: 'blur(1px)' },
        visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
      }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {children}
    </MotionBlock>
  )
}
