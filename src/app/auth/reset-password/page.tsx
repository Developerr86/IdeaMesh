'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || password !== confirm) return
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/'), 2000)
    }
  }

  if (success) {
    return (
      <div className="w-full max-w-sm text-center">
        <CheckCircle className="w-10 h-10 text-accent-green mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-white mb-2">Password updated</h1>
        <p className="text-sm text-white/40">Redirecting you home...</p>
      </div>
    )
  }

  const mismatch = confirm.length > 0 && password !== confirm

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <h1 className="text-xl font-semibold text-white mb-1">Set new password</h1>
        <p className="text-sm text-white/40">Choose a strong password for your account</p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-accent-coral/10 border border-accent-coral/20 text-sm text-accent-coral">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password (min. 8 characters)"
            autoComplete="new-password"
            minLength={8}
            required
            className="w-full bg-surface-1 border border-border rounded-xl px-4 py-3 pr-10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent-purple/50 transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <input
          type={showPassword ? 'text' : 'password'}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          autoComplete="new-password"
          required
          className={cn(
            'w-full bg-surface-1 border rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none transition-colors',
            mismatch ? 'border-accent-coral/50 focus:border-accent-coral' : 'border-border focus:border-accent-purple/50',
          )}
        />
        {mismatch && <p className="text-xs text-accent-coral">Passwords do not match</p>}

        <button
          type="submit"
          disabled={loading || !password || !confirm || mismatch}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all',
            password && confirm && !mismatch && !loading
              ? 'bg-accent-purple text-white hover:bg-accent-purple/90'
              : 'bg-surface-2 text-white/20 cursor-not-allowed',
          )}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update password'}
        </button>
      </form>
    </div>
  )
}
