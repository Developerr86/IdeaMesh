import { cn } from '@/lib/utils'

interface TagProps {
  children: React.ReactNode
  variant?: 'default' | 'purple' | 'coral' | 'teal' | 'blue' | 'amber' | 'green'
}

const VARIANTS = {
  default: 'bg-surface-2 text-white/50 border-border',
  purple: 'bg-accent-purple-muted text-accent-purple border-accent-purple/20',
  coral: 'bg-accent-coral-muted text-accent-coral border-accent-coral/20',
  teal: 'bg-accent-teal-muted text-accent-teal border-accent-teal/20',
  blue: 'bg-accent-blue-muted text-accent-blue border-accent-blue/20',
  amber: 'bg-accent-amber-muted text-accent-amber border-accent-amber/20',
  green: 'bg-accent-green-muted text-accent-green border-accent-green/20',
}

export function Tag({ children, variant = 'default' }: TagProps) {
  return (
    <span
      className={cn(
        'inline-block text-[10px] font-medium px-2 py-0.5 rounded-md border',
        VARIANTS[variant]
      )}
    >
      {children}
    </span>
  )
}
