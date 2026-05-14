'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { User, LogOut, UserCircle, ChevronDown, LogIn } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export function UserMenu() {
  const router = useRouter()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const menuRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    setOpen(false)
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  if (loading) {
    return <div className="w-7 h-7 rounded-full bg-surface-2 animate-pulse" />
  }

  if (!user) {
    return (
      <Link
        href="/auth/login"
        className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
      >
        <LogIn className="w-3.5 h-3.5" />
        Sign in
      </Link>
    )
  }

  const initials = getInitials(user)
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 group"
      >
        <Avatar initials={initials} avatarUrl={avatarUrl} />
        <ChevronDown className={cn('w-3 h-3 text-white/30 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-surface-1 border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-fade-up">
          <div className="px-3 py-3 border-b border-border">
            <p className="text-xs font-medium text-white/80 truncate">
              {user.user_metadata?.full_name || user.user_metadata?.name || 'User'}
            </p>
            <p className="text-[11px] text-white/30 truncate mt-0.5">{user.email}</p>
          </div>

          <div className="p-1">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-white/60 hover:text-white hover:bg-surface-2 transition-all"
            >
              <UserCircle className="w-3.5 h-3.5" />
              Profile
            </Link>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-white/60 hover:text-accent-coral hover:bg-accent-coral/10 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Avatar({ initials, avatarUrl }: { initials: string; avatarUrl?: string }) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt="Avatar"
        className="w-7 h-7 rounded-full object-cover border border-border"
      />
    )
  }
  return (
    <div className="w-7 h-7 rounded-full bg-accent-purple/20 border border-accent-purple/30 flex items-center justify-center">
      <span className="text-[10px] font-semibold text-accent-purple">{initials}</span>
    </div>
  )
}

function getInitials(user: SupabaseUser): string {
  const name: string = user.user_metadata?.full_name || user.user_metadata?.name || user.email || ''
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n: string) => n[0].toUpperCase())
    .join('')
}
