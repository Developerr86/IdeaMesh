import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { RouteTransitionProvider } from '@/components/ui/RouteTransition'

export const metadata: Metadata = {
  title: 'IdeaMesh',
  description: 'AI-powered software ideation platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans bg-surface min-h-screen">
        <RouteTransitionProvider>{children}</RouteTransitionProvider>
      </body>
    </html>
  )
}
