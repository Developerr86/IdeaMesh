'use client'

import { motion, HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

interface StreamContainerProps extends HTMLMotionProps<"div"> {
  staggerDelay?: number
}

export function StreamContainer({ children, className, staggerDelay = 0.05, ...props }: StreamContainerProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}
