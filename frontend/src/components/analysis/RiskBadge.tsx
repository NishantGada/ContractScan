import { cn } from '@/lib/utils'
import type { RiskSeverity } from '@/hooks/useContracts'

interface RiskBadgeProps {
  severity: RiskSeverity
  className?: string
}

// Colors come only from the semantic risk-* tokens defined in tailwind.config.ts.
const SEVERITY_STYLES: Record<RiskSeverity, { label: string; className: string }> = {
  high: { label: 'High', className: 'border-risk-high/30 bg-risk-high/10 text-risk-high' },
  medium: {
    label: 'Medium',
    className: 'border-risk-medium/30 bg-risk-medium/10 text-risk-medium',
  },
  low: { label: 'Low', className: 'border-risk-low/30 bg-risk-low/10 text-risk-low' },
}

/** A colored severity pill for a clause risk. */
export function RiskBadge({ severity, className }: RiskBadgeProps) {
  const { label, className: styles } = SEVERITY_STYLES[severity]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-medium',
        styles,
        className,
      )}
    >
      {label}
    </span>
  )
}
