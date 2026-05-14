'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { usePipelineStore } from '@/store/pipelineStore'
import { STAGES } from '@/types/pipeline'
import { cn } from '@/lib/utils'
import {
  Sparkles,
  User,
  Mail,
  Save,
  LogOut,
  Loader2,
  ArrowLeft,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
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

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [fullName, setFullName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [loadingUser, setLoadingUser] = useState(true)

  const { savedPipelines, loadPipeline, deletePipeline, fetchSavedPipelines } = usePipelineStore()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/auth/login')
        return
      }
      setUser(user)
      setFullName(user.user_metadata?.full_name || user.user_metadata?.name || '')
      setLoadingUser(false)
    })
  }, [])

  useEffect(() => {
    fetchSavedPipelines()
  }, [])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveStatus('idle')

    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName },
    })

    if (!error) {
      await supabase.from('profiles').update({ full_name: fullName }).eq('id', user!.id)
      setSaveStatus('success')
    } else {
      setSaveStatus('error')
    }
    setSaving(false)
    setTimeout(() => setSaveStatus('idle'), 3000)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const handleLoad = async (id: string) => {
    await loadPipeline(id)
    router.push('/mesh')
  }

  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-accent-purple animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-12 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-white/30 hover:text-white/60 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent-purple" />
            <span className="text-xs font-semibold text-gradient-purple">IdeaMesh</span>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 text-xs text-white/30 hover:text-accent-coral transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>

      {/* Profile card */}
      <section className="bg-surface-1 border border-border rounded-2xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-white mb-5">Account</h2>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="text-xs text-white/40 mb-1.5 flex items-center gap-1.5">
              <User className="w-3 h-3" />
              Full name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent-purple/50 transition-colors"
            />
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3 h-3" />
              Email
            </label>
            <input
              type="email"
              value={user?.email ?? ''}
              disabled
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-sm text-white/40 cursor-not-allowed"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all',
                saving ? 'bg-surface-2 text-white/20 cursor-not-allowed' : 'bg-accent-purple text-white hover:bg-accent-purple/90',
              )}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save changes
            </button>

            {saveStatus === 'success' && (
              <span className="flex items-center gap-1 text-xs text-accent-green">
                <CheckCircle className="w-3.5 h-3.5" />
                Saved
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1 text-xs text-accent-coral">
                <AlertCircle className="w-3.5 h-3.5" />
                Failed to save
              </span>
            )}
          </div>
        </form>
      </section>

      {/* Saved pipelines */}
      <section className="bg-surface-1 border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Clock className="w-3.5 h-3.5 text-white/30" />
          <h2 className="text-sm font-semibold text-white">Saved ideas</h2>
          <span className="ml-auto text-xs text-white/20">{savedPipelines.length}</span>
        </div>

        {savedPipelines.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-white/20">No saved ideas yet.</p>
            <Link href="/" className="mt-3 inline-block text-xs text-accent-purple hover:text-accent-purple/80 transition-colors">
              Start your first idea →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {savedPipelines.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-surface-2 border border-border hover:border-border-strong transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/80 truncate">{s.title}</p>
                  <p className="text-xs text-white/30 mt-0.5">
                    {stageLabel(s.stage)} · {formatDate(s.lastModified)}
                  </p>
                </div>
                <button
                  onClick={() => handleLoad(s.id)}
                  className="text-xs text-accent-purple hover:text-accent-purple/80 font-medium transition-colors shrink-0"
                >
                  Load
                </button>
                <button
                  onClick={() => deletePipeline(s.id)}
                  className="text-white/20 hover:text-accent-coral transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
