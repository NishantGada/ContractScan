import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/**
 * Catches render-time errors anywhere below it and shows a recoverable fallback
 * instead of a blank screen. React only surfaces these to a class component, so
 * this stays a class. Data-fetching errors are handled inline by each hook —
 * this is the last-resort net for unexpected crashes.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-surface p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-risk-high/10">
            <AlertTriangle className="h-6 w-6 text-risk-high" />
          </div>
          <h1 className="mt-4 font-display text-xl font-semibold text-text-primary">
            Something went wrong
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-text-muted">
            An unexpected error interrupted the app. Reloading usually clears it.
          </p>
          <Button className="mt-6" onClick={() => window.location.reload()}>
            Reload the app
          </Button>
        </div>
      </div>
    )
  }
}
