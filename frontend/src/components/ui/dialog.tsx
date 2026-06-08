import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Minimal modal dialog. Hand-rolled (no Radix) to match the rest of the UI
 * primitives in this project. Closes on Escape and backdrop click, locks body
 * scroll while open, and keeps keyboard focus trapped inside the panel —
 * restoring it to the trigger element on close.
 */
interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Dialog({ open, onClose, title, description, children }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    // Remember what was focused so we can hand focus back when the dialog closes.
    const previouslyFocused = document.activeElement as HTMLElement | null

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      // Trap Tab/Shift+Tab within the panel's focusable elements.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'

    // Move focus into the dialog unless a child already grabbed it (e.g. autoFocus).
    const panel = panelRef.current
    if (panel && !panel.contains(document.activeElement)) {
      panel.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    }

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
      previouslyFocused?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-text-primary/40 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={cn(
          'relative z-10 w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-lg',
          'animate-in fade-in zoom-in-95',
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-sm text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-4 space-y-1.5 pr-6">
          <h2 className="font-display text-2xl font-semibold leading-none tracking-tight text-text-primary">
            {title}
          </h2>
          {description && <p className="text-sm text-text-muted">{description}</p>}
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
