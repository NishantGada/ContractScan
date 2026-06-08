import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

type ToastVariant = 'success' | 'error' | 'info'

interface ToastOptions {
  title: string
  description?: string
  variant?: ToastVariant
  /** Auto-dismiss delay in ms. Defaults to 5000; pass 0 to disable. */
  duration?: number
}

interface Toast extends Required<Omit<ToastOptions, 'description'>> {
  id: number
  description?: string
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

// Per-variant icon + accent, drawn only from the semantic risk-* tokens so the
// palette stays swappable from tailwind.config.ts.
const VARIANT_STYLES: Record<
  ToastVariant,
  { icon: typeof Info; iconClass: string; accent: string }
> = {
  success: { icon: CheckCircle2, iconClass: 'text-risk-low', accent: 'border-l-risk-low' },
  error: { icon: XCircle, iconClass: 'text-risk-high', accent: 'border-l-risk-high' },
  info: { icon: Info, iconClass: 'text-primary', accent: 'border-l-primary' },
}

/**
 * App-wide toast notifications. Hand-rolled (no Radix) to match the other UI
 * primitives. Toasts stack bottom-right, auto-dismiss after their duration, and
 * announce themselves to assistive tech via an aria-live region.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  // Monotonic id source — avoids collisions when several toasts fire in one tick.
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(({ title, description, variant = 'info', duration = 5000 }: ToastOptions) => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, title, description, variant, duration }])
  }, [])

  const value = useMemo<ToastContextValue>(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed bottom-0 right-0 z-[100] flex w-full max-w-sm flex-col gap-3 p-4"
          role="region"
          aria-label="Notifications"
        >
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const { icon: Icon, iconClass, accent } = VARIANT_STYLES[toast.variant]

  useEffect(() => {
    if (toast.duration <= 0) return
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.duration)
    return () => window.clearTimeout(timer)
  }, [toast.id, toast.duration, onDismiss])

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-lg border border-l-4 border-border bg-surface p-4 shadow-lg',
        'animate-in fade-in slide-in-from-bottom-2',
        accent,
      )}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', iconClass)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-sm text-text-muted">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 rounded-sm text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
