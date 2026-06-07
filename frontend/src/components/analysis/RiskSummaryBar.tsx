import { cn } from '@/lib/utils'

interface RiskSummaryBarProps {
  high: number
  medium: number
  low: number
  className?: string
}

// Each severity's bar segment + legend swatch color, drawn only from the
// semantic risk-* tokens defined in tailwind.config.ts.
const SEGMENTS = [
  { key: 'high', label: 'High', color: 'bg-risk-high' },
  { key: 'medium', label: 'Medium', color: 'bg-risk-medium' },
  { key: 'low', label: 'Low', color: 'bg-risk-low' },
] as const

/**
 * Horizontal stacked bar of clause-risk counts across all of a vendor's
 * contracts, with a legend. Renders an "all clear" message when no risks were
 * found so the bar is never an empty sliver.
 */
export function RiskSummaryBar({ high, medium, low, className }: RiskSummaryBarProps) {
  const counts = { high, medium, low }
  const total = high + medium + low

  return (
    <div className={cn('rounded-lg border border-border bg-surface p-5', className)}>
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold text-text-primary">
          Risk overview
        </h2>
        <span className="font-mono text-xs text-text-muted">
          {total} {total === 1 ? 'risk' : 'risks'} identified
        </span>
      </div>

      {total === 0 ? (
        <p className="mt-4 text-sm text-text-muted">
          No risky clauses identified across this vendor’s contracts yet.
        </p>
      ) : (
        <>
          <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-background">
            {SEGMENTS.map(({ key, color }) =>
              counts[key] > 0 ? (
                <div
                  key={key}
                  className={color}
                  style={{ width: `${(counts[key] / total) * 100}%` }}
                />
              ) : null,
            )}
          </div>

          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            {SEGMENTS.map(({ key, label, color }) => (
              <li key={key} className="flex items-center gap-2">
                <span className={cn('h-2.5 w-2.5 rounded-full', color)} />
                <span className="text-sm text-text-primary">{label}</span>
                <span className="font-mono text-sm font-semibold text-text-primary">
                  {counts[key]}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
