import { Sparkles } from 'lucide-react'
import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <Link href="/" className="flex items-center gap-2 mb-10">
        <Sparkles className="w-4 h-4 text-accent-purple" />
        <span className="text-sm font-semibold text-gradient-purple">IdeaMesh</span>
      </Link>
      {children}
    </div>
  )
}
