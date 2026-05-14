'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePipelineStore } from '@/store/pipelineStore'
import { Sparkles, ArrowRight, Clock, Trash2, User, Briefcase, LogIn } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STAGES } from '@/types/pipeline'
import { createClient } from '@/lib/supabase/client'
import { UserMenu } from '@/components/ui/UserMenu'
import Link from 'next/link'
import type { User as SupabaseUser } from '@supabase/supabase-js'

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
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
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
  )
}
