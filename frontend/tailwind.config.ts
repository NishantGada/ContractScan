import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

/**
 * ContractScan design system — single source of truth for color + type.
 * Swapping the palette means editing ONLY this file. Components reference
 * semantic tokens (bg-primary, text-text-muted, bg-risk-high, …) never raw
 * values like slate-800.
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand / structure
        background: '#faf9f7', // warm off-white app canvas
        surface: '#ffffff', // cards, panels, inputs
        border: '#ece9e4', // hairline dividers, input borders
        primary: {
          DEFAULT: '#1e293b', // slate — primary actions, brand
          hover: '#334155', // hover/active state for primary
          foreground: '#faf9f7', // text/icons on a primary surface
        },
        text: {
          primary: '#1c1917', // headings, body copy
          muted: '#78716c', // secondary / supporting text
        },
        // Risk severity
        risk: {
          high: '#dc2626',
          medium: '#d97706',
          low: '#16a34a',
        },
      },
      fontFamily: {
        // Refined serif headings, clean humanist body, plain mono for clause text
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        lg: '0.625rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
    },
  },
  plugins: [animate],
}

export default config
