'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePipelineStore } from '@/store/pipelineStore'
import { Sparkles, ArrowRight, Clock, Trash2, User, Briefcase, LogIn } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STAGES } from '@/types/pipeline'
import { createClient } from '@/lib/supabase/client'
import { UserMenu } from '@/components/ui/UserMenu'
import Link from 'next/link'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { motion, AnimatePresence } from 'framer-motion'

const GRID_SIZE = 150
const MAX_LINES = 3
const LINE_DURATION_MIN = 1.0
const LINE_DURATION_MAX = 1.5
const LINE_LENGTH_VW = 20
const LINE_LENGTH_VH = 20

function formatDate(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

function stageLabel(id: string): string {
  return STAGES.find((s) => s.id === id)?.label ?? id
}

type Direction = 'ltr' | 'rtl' | 'ttb' | 'btt'

interface NeonLine {
  id: number
  direction: Direction
  gridIndex: number
  duration: number
}

function useGridLines() {
  const [lines, setLines] = useState<NeonLine[]>([])
  // Sets track occupied grid indices; adjacency (+/-1) is also blocked
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

  const isSlotBlocked = (set: Set<number>, idx: number) =>
    set.has(idx) || set.has(idx - 1) || set.has(idx + 1)

  const spawnLine = useCallback((): NeonLine | null => {
    const { cols, rows } = dimensionsRef.current
    if (cols === 0 || rows === 0) return null

    const isHorizontal = Math.random() < 0.5
    const directions: Direction[] = isHorizontal ? ['ltr', 'rtl'] : ['ttb', 'btt']
    const direction = directions[Math.floor(Math.random() * 2)]

    if (isHorizontal) {
      const available: number[] = []
      for (let r = 0; r <= rows; r++) {
        if (!isSlotBlocked(activeRowsRef.current, r)) available.push(r)
      }
      if (available.length === 0) return null
      const gridIndex = available[Math.floor(Math.random() * available.length)]
      activeRowsRef.current.add(gridIndex)
      const duration = LINE_DURATION_MIN + Math.random() * (LINE_DURATION_MAX - LINE_DURATION_MIN)
      return { id: counterRef.current++, direction, gridIndex, duration }
    } else {
      const available: number[] = []
      for (let c = 0; c <= cols; c++) {
        if (!isSlotBlocked(activeColsRef.current, c)) available.push(c)
      }
      if (available.length === 0) return null
      const gridIndex = available[Math.floor(Math.random() * available.length)]
      activeColsRef.current.add(gridIndex)
      const duration = LINE_DURATION_MIN + Math.random() * (LINE_DURATION_MAX - LINE_DURATION_MIN)
      return { id: counterRef.current++, direction, gridIndex, duration }
    }
  }, [])

  const removeLine = useCallback((line: NeonLine) => {
    const isHorizontal = line.direction === 'ltr' || line.direction === 'rtl'
    if (isHorizontal) {
      activeRowsRef.current.delete(line.gridIndex)
    } else {
      activeColsRef.current.delete(line.gridIndex)
    }
    // Spawn replacement OUTSIDE setLines updater — React Strict Mode calls
    // updaters twice which would double-register slots and exhaust the registry.
    const next = spawnLine()
    setLines((prev) => {
      const filtered = prev.filter((l) => l.id !== line.id)
      return next ? [...filtered, next] : filtered
    })
  }, [spawnLine])

  useEffect(() => {
    updateDimensions()
    window.addEventListener('resize', updateDimensions)

    // Stagger each line independently so they never batch-complete together.
    // Each one self-sustains via onAnimationComplete → removeLine → spawnLine.
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 0; i < MAX_LINES; i++) {
      const delay = Math.random() * 4000
      const t = setTimeout(() => {
        const l = spawnLine()
        if (l) setLines((prev) => [...prev, l])
      }, delay)
      timers.push(t)
    }

    return () => {
      window.removeEventListener('resize', updateDimensions)
      timers.forEach(clearTimeout)
    }
  }, [updateDimensions, spawnLine])

  return { lines, removeLine }
}

interface NeonLineProps {
  line: NeonLine
  onComplete: (line: NeonLine) => void
}

function NeonLineEl({ line, onComplete }: NeonLineProps) {
  const isHorizontal = line.direction === 'ltr' || line.direction === 'rtl'
  const y = isHorizontal ? line.gridIndex * GRID_SIZE : undefined
  const x = !isHorizontal ? line.gridIndex * GRID_SIZE : undefined

  // Segment travels from fully off-screen to fully off the opposite edge
  const segW = isHorizontal ? `${LINE_LENGTH_VW}vw` : '2px'
  const segH = isHorizontal ? '2px' : `${LINE_LENGTH_VH}vh`

  let fromX: string, toX: string, fromY: string, toY: string

  if (isHorizontal) {
    fromX = line.direction === 'ltr' ? `-${LINE_LENGTH_VW}vw` : '100vw'
    toX   = line.direction === 'ltr' ? '100vw' : `-${LINE_LENGTH_VW}vw`
    fromY = '0px'
    toY   = '0px'
  } else {
    fromX = '0px'
    toX   = '0px'
    fromY = line.direction === 'ttb' ? `-${LINE_LENGTH_VH}vh` : '100vh'
    toY   = line.direction === 'ttb' ? '100vh' : `-${LINE_LENGTH_VH}vh`
  }

  return (
    <motion.div
      key={line.id}
      className="absolute pointer-events-none"
      style={{
        top: isHorizontal ? y : 0,
        left: !isHorizontal ? x : 0,
        width: segW,
        height: segH,
        background: isHorizontal
          ? 'linear-gradient(to right, rgba(168,85,247,0), rgba(168,85,247,1) 25%, rgba(168,85,247,1) 75%, rgba(168,85,247,0))'
          : 'linear-gradient(to bottom, rgba(168,85,247,0), rgba(168,85,247,1) 25%, rgba(168,85,247,1) 75%, rgba(168,85,247,0))',
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

export default function LandingPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [ideaType, setIdeaType] = useState<'personal' | 'business'>('personal')
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState<SupabaseUser | null>(null)

  const { savedPipelines, initPipeline, loadPipeline, deletePipeline, fetchSavedPipelines } =
    usePipelineStore()
  const router = useRouter()
  const supabase = createClient()
  const { lines, removeLine } = useGridLines()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) fetchSavedPipelines()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchSavedPipelines()
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return

    if (!user) {
      router.push('/auth/login?next=/')
      return
    }

    setIsLoading(true)
    initPipeline(title.trim(), description.trim(), ideaType)
    router.push('/mesh')
  }

  const handleLoad = async (id: string) => {
    await loadPipeline(id)
    router.push('/mesh')
  }

  const isReady = title.trim().length > 0 && description.trim().length > 20

  return (
    <div className="relative min-h-screen bg-[#0a0a0a] overflow-hidden">
      {/* Grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, #8080801a 1px, transparent 1px), linear-gradient(to bottom, #8080801a 1px, transparent 1px)',
          backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
        }}
      />

      {/* Neon lines */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {lines.map((line) => (
          <NeonLineEl key={line.id} line={line} onComplete={removeLine} />
        ))}
      </div>

      {/* Page content */}
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-16">
        {/* Top-right user menu */}
        <div className="fixed top-4 right-5">
          <UserMenu />
        </div>

        <div className="flex items-center gap-2 mb-12">
          <Sparkles className="w-5 h-5 text-accent-purple" />
          <span className="text-sm font-semibold tracking-tight text-gradient-purple">IdeaMesh</span>
        </div>

        <div className="text-center mb-10 max-w-xl">
          <h1 className="text-3xl font-semibold tracking-tight text-white mb-3">
            Turn raw ideas into build plans
          </h1>
          <p className="text-sm text-white/40 leading-relaxed">
            A 6-stage AI pipeline that brainstorms, critiques, scouts competitors,
            and drafts a complete technical blueprint — for any software idea.
          </p>
        </div>

        <div className="w-full max-w-lg space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Idea title..."
            className="w-full bg-surface-1 border border-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent-purple/50 transition-colors"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your idea in a few sentences. What does it do? Who is it for? What problem does it solve?"
            rows={4}
            className="w-full bg-surface-1 border border-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 resize-none focus:outline-none focus:border-accent-purple/50 transition-colors"
          />

          {/* Idea type toggle */}
          <div className="flex rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => setIdeaType('personal')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium transition-all',
                ideaType === 'personal'
                  ? 'bg-accent-purple text-white'
                  : 'bg-surface-1 text-white/40 hover:text-white/60',
              )}
            >
              <User className="w-3.5 h-3.5" />
              Personal Idea
            </button>
            <button
              onClick={() => setIdeaType('business')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium transition-all',
                ideaType === 'business'
                  ? 'bg-accent-purple text-white'
                  : 'bg-surface-1 text-white/40 hover:text-white/60',
              )}
            >
              <Briefcase className="w-3.5 h-3.5" />
              Business Idea
            </button>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!isReady || isLoading}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all',
              isReady
                ? 'bg-accent-purple text-white hover:bg-accent-purple/90 glow-purple'
                : 'bg-surface-2 text-white/20 cursor-not-allowed',
            )}
          >
            {isLoading
              ? 'Starting pipeline...'
              : !user
                ? 'Sign in to start'
                : 'Start ideation'}
            {!isLoading && (user ? <ArrowRight className="w-4 h-4" /> : <LogIn className="w-4 h-4" />)}
          </button>

          {!user && (
            <p className="text-center text-xs text-white/30">
              <Link href="/auth/login" className="text-accent-purple hover:text-accent-purple/80 transition-colors">
                Sign in
              </Link>
              {' '}or{' '}
              <Link href="/auth/signup" className="text-accent-purple hover:text-accent-purple/80 transition-colors">
                create an account
              </Link>
              {' '}to save your ideas
            </p>
          )}
        </div>

        {user && savedPipelines.length > 0 && (
          <div className="w-full max-w-lg mt-12">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-3.5 h-3.5 text-white/30" />
              <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider">Saved ideas</h2>
            </div>
            <div className="space-y-2">
              {savedPipelines.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-surface-1 border border-border hover:border-border-strong transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/80 truncate">{s.title}</p>
                    <p className="text-xs text-white/30 mt-0.5">
                      {stageLabel(s.stage)} · {formatDate(s.lastModified)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleLoad(s.id)}
                    className="text-xs text-accent-purple hover:text-accent-purple/80 font-medium transition-colors"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => deletePipeline(s.id)}
                    className="text-white/20 hover:text-accent-coral transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 mt-10 text-[10px] text-white/20">
          {['Seed', 'Mesh', 'Probe', 'Scout', 'Compare', 'Blueprint', 'Pitch Deck'].map((s, i, arr) => (
            <span key={s} className="flex items-center gap-2">
              <span>{s}</span>
              {i < arr.length - 1 && <span className="text-white/10">→</span>}
            </span>
          ))}
        </div>
      </main>
    </div>
  )
}
