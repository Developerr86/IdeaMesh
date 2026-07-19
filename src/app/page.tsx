'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, FileText, GitBranch, Pencil, Search, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { UserMenu } from '@/components/ui/UserMenu'
import { TransitionLink } from '@/components/ui/RouteTransition'

const GRID_SIZE = 150
const MAX_LINES = 3
const LINE_DURATION_MIN = 1
const LINE_DURATION_MAX = 1.5
const LINE_LENGTH_VW = 20
const LINE_LENGTH_VH = 20

type Direction = 'ltr' | 'rtl' | 'ttb' | 'btt'

interface NeonLine {
  id: number
  direction: Direction
  gridIndex: number
  duration: number
}

function useGridLines() {
  const [lines, setLines] = useState<NeonLine[]>([])
  const activeRowsRef = useRef<Set<number>>(new Set())
  const activeColsRef = useRef<Set<number>>(new Set())
  const counterRef = useRef(0)
  const dimensionsRef = useRef({ cols: 0, rows: 0 })

  const updateDimensions = useCallback(() => {
    dimensionsRef.current = {
      cols: Math.floor(window.innerWidth / GRID_SIZE),
      rows: Math.floor(window.innerHeight / GRID_SIZE),
    }
  }, [])

  const spawnLine = useCallback((): NeonLine | null => {
    const { cols, rows } = dimensionsRef.current
    if (cols === 0 || rows === 0) return null

    const isHorizontal = Math.random() < 0.5
    const direction: Direction = isHorizontal
      ? (Math.random() < 0.5 ? 'ltr' : 'rtl')
      : (Math.random() < 0.5 ? 'ttb' : 'btt')
    const active = isHorizontal ? activeRowsRef.current : activeColsRef.current
    const max = isHorizontal ? rows : cols
    const available = Array.from({ length: max + 1 }, (_, index) => index).filter(
      (index) => !active.has(index) && !active.has(index - 1) && !active.has(index + 1),
    )
    if (available.length === 0) return null

    const gridIndex = available[Math.floor(Math.random() * available.length)]
    active.add(gridIndex)
    return {
      id: counterRef.current++,
      direction,
      gridIndex,
      duration: LINE_DURATION_MIN + Math.random() * (LINE_DURATION_MAX - LINE_DURATION_MIN),
    }
  }, [])

  const removeLine = useCallback((line: NeonLine) => {
    const active = line.direction === 'ltr' || line.direction === 'rtl'
      ? activeRowsRef.current
      : activeColsRef.current
    active.delete(line.gridIndex)
    const next = spawnLine()
    setLines((current) => {
      const remaining = current.filter((item) => item.id !== line.id)
      return next ? [...remaining, next] : remaining
    })
  }, [spawnLine])

  useEffect(() => {
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    const timers = Array.from({ length: MAX_LINES }, () => setTimeout(() => {
      const line = spawnLine()
      if (line) setLines((current) => [...current, line])
    }, Math.random() * 4_000))

    return () => {
      window.removeEventListener('resize', updateDimensions)
      timers.forEach(clearTimeout)
    }
  }, [spawnLine, updateDimensions])

  return { lines, removeLine }
}

function NeonLineEl({ line, onComplete }: { line: NeonLine; onComplete: (line: NeonLine) => void }) {
  const isHorizontal = line.direction === 'ltr' || line.direction === 'rtl'
  const x = isHorizontal ? undefined : line.gridIndex * GRID_SIZE
  const y = isHorizontal ? line.gridIndex * GRID_SIZE : undefined
  const fromX = isHorizontal ? (line.direction === 'ltr' ? `-${LINE_LENGTH_VW}vw` : '100vw') : '0px'
  const toX = isHorizontal ? (line.direction === 'ltr' ? '100vw' : `-${LINE_LENGTH_VW}vw`) : '0px'
  const fromY = !isHorizontal ? (line.direction === 'ttb' ? `-${LINE_LENGTH_VH}vh` : '100vh') : '0px'
  const toY = !isHorizontal ? (line.direction === 'ttb' ? '100vh' : `-${LINE_LENGTH_VH}vh`) : '0px'

  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{
        top: isHorizontal ? y : 0,
        left: isHorizontal ? 0 : x,
        width: isHorizontal ? `${LINE_LENGTH_VW}vw` : '2px',
        height: isHorizontal ? '2px' : `${LINE_LENGTH_VH}vh`,
        background: isHorizontal
          ? 'linear-gradient(to right, transparent, rgba(168,85,247,1) 25%, rgba(168,85,247,1) 75%, transparent)'
          : 'linear-gradient(to bottom, transparent, rgba(168,85,247,1) 25%, rgba(168,85,247,1) 75%, transparent)',
        filter: 'drop-shadow(0 0 3px rgba(168,85,247,0.9)) drop-shadow(0 0 8px rgba(168,85,247,0.4))',
        translateX: fromX,
        translateY: fromY,
      }}
      animate={{ translateX: toX, translateY: toY }}
      transition={{ duration: line.duration, ease: 'easeInOut' }}
      onAnimationComplete={() => onComplete(line)}
    />
  )
}

const stages = [
  ['Seed', 'Frame the idea and its first constraints.'],
  ['Mesh', 'Expand possibilities and expose open questions.'],
  ['Probe', 'Stress-test the opportunity before you build.'],
  ['Scout', 'Find competitors and the evidence behind them.'],
  ['Blueprint', 'Leave with a plan your team can act on.'],
]

const features = [
  { icon: Search, title: 'Research with context', detail: 'Competitive research reads the idea you are actually shaping, not a disconnected prompt.' },
  { icon: GitBranch, title: 'Keep alternate paths', detail: 'Fork at the point where your evidence changes, without losing the original line of thinking.' },
  { icon: Pencil, title: 'Refine in place', detail: 'Turn feedback into targeted refinements instead of starting an entire analysis over.' },
]

export default function LandingPage() {
  const { lines, removeLine } = useGridLines()

  return (
    <main className="min-h-screen overflow-hidden bg-surface text-white">
      <section className="relative isolate min-h-[760px] overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 -z-20"
          style={{
            backgroundImage: 'linear-gradient(to right, #8080801a 1px, transparent 1px), linear-gradient(to bottom, #8080801a 1px, transparent 1px)',
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
          }}
        />
        <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          {lines.map((line) => <NeonLineEl key={line.id} line={line} onComplete={removeLine} />)}
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-surface via-surface/80 to-transparent" />
        </div>

        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent-purple" />
            <span className="text-sm font-semibold tracking-tight text-gradient-purple">IdeaMesh</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="#how-it-works" className="hidden text-xs text-white/50 transition-colors hover:text-white sm:inline">How it works</Link>
            <TransitionLink href="/seed" className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:border-accent-purple/70 hover:text-white">Start an idea</TransitionLink>
            <UserMenu />
          </div>
        </header>

        <div className="mx-auto flex min-h-[650px] w-full max-w-6xl flex-col justify-center px-5 pb-24 pt-16 sm:px-8 sm:pt-20">
          <div className="max-w-3xl">
            <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.18em] text-accent-purple/80">Research before momentum</p>
            <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
              Give your idea a <span className="text-gradient-purple">thinking surface.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-white/50 sm:text-lg">
              IdeaMesh turns a rough software idea into a traceable path of questions, research, trade-offs, and a build-ready blueprint.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <TransitionLink href="/seed" className="flex items-center gap-2 rounded-xl bg-accent-purple px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-purple/90 glow-purple">
                Start shaping an idea <ArrowRight className="h-4 w-4" />
              </TransitionLink>
              <Link href="#how-it-works" className="text-sm text-white/55 transition-colors hover:text-white">See the workflow</Link>
            </div>
          </div>

          <div className="mt-20 grid max-w-4xl grid-cols-1 border-y border-white/10 sm:grid-cols-3">
            {[
              ['Explore', 'Make assumptions visible before they calcify.'],
              ['Challenge', 'Research the market and test the weak spots.'],
              ['Choose', 'Keep the path that earns the right to be built.'],
            ].map(([label, detail], index) => (
              <div key={label} className="border-white/10 py-5 pr-6 sm:border-r sm:px-6 sm:first:pl-0 sm:last:border-r-0">
                <span className="font-mono text-[10px] text-accent-purple/70">0{index + 1}</span>
                <p className="mt-2 text-sm font-medium text-white/85">{label}</p>
                <p className="mt-1 text-xs leading-5 text-white/40">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-teal">A deliberate workflow</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">A pipeline with room to change your mind.</h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-white/45">
              Good product work is not a straight line. Each stage builds context for the next, while branches preserve the alternatives worth revisiting.
            </p>
          </div>
          <ol className="divide-y divide-border border-y border-border">
            {stages.map(([label, detail], index) => (
              <li key={label} className="flex items-start gap-5 py-4 sm:items-center">
                <span className="w-7 font-mono text-xs text-white/25">0{index + 1}</span>
                <p className="w-24 text-sm font-medium text-white/85">{label}</p>
                <p className="flex-1 text-xs leading-5 text-white/40">{detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-y border-border bg-surface-1/40">
        <div className="mx-auto grid w-full max-w-6xl gap-px bg-border px-5 py-px sm:grid-cols-3 sm:px-8">
          {features.map(({ icon: Icon, title, detail }) => (
            <article key={title} className="bg-surface px-6 py-9 first:pl-0 last:pr-0 sm:px-8 sm:first:pl-0 sm:last:pr-0">
              <Icon className="h-4 w-4 text-accent-purple" />
              <h3 className="mt-5 text-sm font-medium text-white/85">{title}</h3>
              <p className="mt-2 max-w-xs text-xs leading-6 text-white/40">{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-8 px-5 py-20 sm:flex-row sm:items-end sm:px-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-amber">Your next idea deserves evidence</p>
          <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-tight text-white">Start with the messy version. We’ll make the path visible.</h2>
        </div>
        <TransitionLink href="/seed" className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-medium text-surface transition-colors hover:bg-white/90">
          Begin with Seed <FileText className="h-4 w-4" />
        </TransitionLink>
      </section>
    </main>
  )
}
