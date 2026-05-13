import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      colors: {
        surface: {
          DEFAULT: '#0a0a0a',
          '1': '#111111',
          '2': '#1a1a1a',
          '3': '#222222',
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.08)',
          subtle: 'rgba(255,255,255,0.05)',
          strong: 'rgba(255,255,255,0.15)',
        },
        accent: {
          purple: '#7c6af7',
          'purple-muted': 'rgba(124,106,247,0.15)',
          teal: '#2dd4bf',
          'teal-muted': 'rgba(45,212,191,0.12)',
          coral: '#f87171',
          'coral-muted': 'rgba(248,113,113,0.12)',
          blue: '#60a5fa',
          'blue-muted': 'rgba(96,165,250,0.12)',
          amber: '#fbbf24',
          'amber-muted': 'rgba(251,191,36,0.12)',
          green: '#4ade80',
          'green-muted': 'rgba(74,222,128,0.12)',
        }
      },
      animation: {
        'cursor-blink': 'blink 0.8s steps(1) infinite',
        'fade-up': 'fadeUp 0.4s ease forwards',
        'shimmer': 'shimmer 1.5s linear infinite',
      },
      keyframes: {
        blink: { '50%': { opacity: '0' } },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to: { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}

export default config
