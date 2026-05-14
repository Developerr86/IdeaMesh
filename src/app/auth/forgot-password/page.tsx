'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Loader2, Mail } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setError('')

    const origin = window.location.origin
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="w-full max-w-sm text-center">
        <Mail className="w-10 h-10 text-accent-purple mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-white mb-2">Email sent</h1>
        <p className="text-sm text-white/40 mb-6">
          We sent a password reset link to <span className="text-white/70">{email}</span>. Check your inbox.
        </p>
        <Link href="/auth/login" className="text-sm text-accent-purple hover:text-accent-purple/80 transition-colors">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <h1 className="text-xl font-semibold text-white mb-1">Reset password</h1>
        <p className="text-sm text-white/40">Enter your email and we&apos;ll send a reset link</p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-accent-coral/10 border border-accent-coral/20 text-sm text-accent-coral">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          autoComplete="email"
          required
          className="w-full bg-surface-1 border border-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent-purple/50 transition-colors"
        />

        <button
          type="submit"
          disabled={loading || !email}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all',
            email && !loading
              ? 'bg-accent-purple text-white hover:bg-accent-purple/90'
              : 'bg-surface-2 text-white/20 cursor-not-allowed',
          )}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send reset link'}
        </button>
      </form>

      <p className="text-center text-xs text-white/30 mt-6">
        <Link href="/auth/login" className="text-accent-purple hover:text-accent-purple/80 transition-colors">
          ← Back to sign in
        </Link>
      </p>
    </div>
  )
}
