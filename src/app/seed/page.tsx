'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { ArrowRight, Briefcase, Clock, LogIn, Sparkles, Trash2, User } from 'lucide-react'
import { UserMenu } from '@/components/ui/UserMenu'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { cn } from '@/lib/utils'
import { usePipelineStore } from '@/store/pipelineStore'
import { STAGES } from '@/types/pipeline'
import { TransitionLink } from '@/components/ui/RouteTransition'

function formatDate(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function stageLabel(id: string): string {
  return STAGES.find((stage) => stage.id === id)?.label ?? id
}

export default function SeedPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [ideaType, setIdeaType] = useState<'personal' | 'business'>('personal')
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const { savedPipelines, initPipeline, loadPipeline, deletePipeline, fetchSavedPipelines } =
    usePipelineStore()
  const router = useRouter()

  useEffect(() => {
    if (!isSupabaseConfigured()) return

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      setUser(currentUser)
      if (currentUser) fetchSavedPipelines()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchSavedPipelines()
    })

    return () => subscription.unsubscribe()
  }, [fetchSavedPipelines])

  const handleSubmit = () => {
    if (!title.trim() || !description.trim()) return

    if (isSupabaseConfigured() && !user) {
      router.push('/auth/login?next=/seed')
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
    <main className="min-h-screen bg-surface px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between border-b border-border pb-5">
        <TransitionLink href="/" className="flex items-center gap-2 text-white/80 transition-colors hover:text-white">
          <Sparkles className="h-4 w-4 text-accent-purple" />
          <span className="text-sm font-semibold tracking-tight text-gradient-purple">IdeaMesh</span>
        </TransitionLink>
        <UserMenu />
      </div>

      <section className="mx-auto grid w-full max-w-5xl gap-10 py-14 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="max-w-xl">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-accent-purple">Stage 01 · Seed</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Start with what you know.</h1>
          <p className="mt-4 max-w-lg text-sm leading-7 text-white/45">
            Give IdeaMesh the raw version of your idea. You will shape it before the research and planning work begins.
          </p>

          <div className="mt-9 space-y-3">
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-white/60">Working title</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. A calmer way to plan group trips"
                className="w-full rounded-xl border border-border bg-surface-1 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/20 focus:border-accent-purple/60"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-medium text-white/60">What are you trying to make?</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the problem, who it is for, and the first version you have in mind."
                rows={5}
                className="w-full resize-none rounded-xl border border-border bg-surface-1 px-4 py-3 text-sm leading-6 text-white outline-none transition-colors placeholder:text-white/20 focus:border-accent-purple/60"
              />
            </label>

            <div>
              <p className="mb-2 text-xs font-medium text-white/60">This idea is mainly for</p>
              <div className="flex overflow-hidden rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setIdeaType('personal')}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 py-2.5 text-xs font-medium transition-colors',
                    ideaType === 'personal' ? 'bg-accent-purple text-white' : 'bg-surface-1 text-white/40 hover:text-white/70',
                  )}
                >
                  <User className="h-3.5 w-3.5" />
                  Personal project
                </button>
                <button
                  type="button"
                  onClick={() => setIdeaType('business')}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 py-2.5 text-xs font-medium transition-colors',
                    ideaType === 'business' ? 'bg-accent-purple text-white' : 'bg-surface-1 text-white/40 hover:text-white/70',
                  )}
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  Business venture
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isReady || isLoading}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all',
                isReady ? 'bg-accent-purple text-white hover:bg-accent-purple/90 glow-purple' : 'cursor-not-allowed bg-surface-2 text-white/20',
              )}
            >
              {isLoading ? 'Starting pipeline...' : isSupabaseConfigured() && !user ? 'Sign in to start' : 'Continue to Mesh'}
              {!isLoading && (isSupabaseConfigured() && !user ? <LogIn className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />)}
            </button>

            {isSupabaseConfigured() && !user && (
              <p className="text-center text-xs text-white/30">
                <Link href="/auth/login?next=/seed" className="text-accent-purple hover:text-accent-purple/80">Sign in</Link>
                {' '}or{' '}
                <Link href="/auth/signup" className="text-accent-purple hover:text-accent-purple/80">create an account</Link>
                {' '}to save your ideas.
              </p>
            )}
          </div>
        </div>

        <aside className="border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-1">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/30">What happens next</p>
          <ol className="mt-5 space-y-4">
            {[
              ['Mesh', 'Expand the concept and uncover the questions that matter.'],
              ['Probe', 'Pressure-test assumptions, trade-offs, and risks.'],
              ['Scout', 'Research the competitive landscape before you commit.'],
            ].map(([stage, detail], index) => (
              <li key={stage} className="flex gap-3">
                <span className="font-mono text-xs text-accent-purple/70">0{index + 2}</span>
                <div>
                  <p className="text-xs font-medium text-white/70">{stage}</p>
                  <p className="mt-1 text-xs leading-5 text-white/35">{detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      {(!isSupabaseConfigured() || user) && savedPipelines.length > 0 && (
        <section className="mx-auto w-full max-w-5xl border-t border-border py-8">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-white/30" />
            <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-white/40">Resume an idea</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {savedPipelines.map((pipeline) => (
              <div key={pipeline.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-1 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white/80">{pipeline.title}</p>
                  <p className="mt-0.5 text-xs text-white/30">{stageLabel(pipeline.stage)} · {formatDate(pipeline.lastModified)}</p>
                </div>
                <button type="button" onClick={() => handleLoad(pipeline.id)} className="text-xs font-medium text-accent-purple hover:text-accent-purple/80">Open</button>
                <button type="button" onClick={() => deletePipeline(pipeline.id)} className="text-white/20 transition-colors hover:text-accent-coral" aria-label={`Delete ${pipeline.title}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
