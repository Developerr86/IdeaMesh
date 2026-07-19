'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react'

type TransitionPhase = 'idle' | 'cover' | 'reveal'

interface RouteTransitionContextValue {
  startTransition: (href: string) => void
}

const RouteTransitionContext = createContext<RouteTransitionContextValue | null>(null)

export function RouteTransitionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [phase, setPhase] = useState<TransitionPhase>('idle')
  const lastPathname = useRef(pathname)

  const startTransition = useCallback((href: string) => {
    if (phase !== 'idle' || href === pathname) return

    setPhase('cover')
    window.setTimeout(() => router.push(href), 220)
  }, [pathname, phase, router])

  useEffect(() => {
    if (pathname === lastPathname.current) return

    lastPathname.current = pathname
    if (phase !== 'cover') return

    const timer = window.setTimeout(() => setPhase('reveal'), 0)
    return () => window.clearTimeout(timer)
  }, [pathname, phase])

  useEffect(() => {
    if (phase !== 'reveal') return

    const timer = window.setTimeout(() => setPhase('idle'), 280)
    return () => window.clearTimeout(timer)
  }, [phase])

  return (
    <RouteTransitionContext.Provider value={{ startTransition }}>
      {children}
      <div
        aria-hidden
        className={`pointer-events-none fixed inset-0 z-[100] bg-surface transition-opacity duration-[220ms] ease-out motion-reduce:transition-none ${
          phase === 'cover' ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </RouteTransitionContext.Provider>
  )
}

type TransitionLinkProps = Omit<ComponentProps<typeof Link>, 'href' | 'onNavigate'> & {
  href: string
}

export function TransitionLink({ href, ...props }: TransitionLinkProps) {
  const context = useContext(RouteTransitionContext)

  return (
    <Link
      href={href}
      {...props}
      onNavigate={(event) => {
        if (!context) return
        event.preventDefault()
        context.startTransition(href)
      }}
    />
  )
}
