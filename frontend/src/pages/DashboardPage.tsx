import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const riskLevels = [
  { label: 'High', token: 'bg-risk-high', note: 'Asymmetric, urgent' },
  { label: 'Medium', token: 'bg-risk-medium', note: 'Worth negotiating' },
  { label: 'Low', token: 'bg-risk-low', note: 'Standard terms' },
] as const

export default function DashboardPage() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary font-display text-lg font-semibold text-primary-foreground">
              C
            </div>
            <span className="font-display text-xl font-semibold text-text-primary">
              ContractScan
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-text-muted">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={() => logout()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-text-muted">
          Feature 3 · Authentication
        </p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl font-semibold leading-tight tracking-tight">
          You're signed in.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-text-muted">
          This protected page confirms auth works end to end. Vendor management
          and contract analysis arrive in the next features.
        </p>

        <section className="mt-12 grid gap-4 sm:grid-cols-3">
          {riskLevels.map((risk) => (
            <article
              key={risk.label}
              className="rounded-lg border border-border bg-surface p-5 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span className={cn('h-2.5 w-2.5 rounded-full', risk.token)} />
                <span className="font-display text-lg font-medium text-text-primary">
                  {risk.label} risk
                </span>
              </div>
              <p className="mt-2 text-sm text-text-muted">{risk.note}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  )
}
