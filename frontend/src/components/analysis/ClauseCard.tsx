import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { RiskBadge } from '@/components/analysis/RiskBadge'
import { cn } from '@/lib/utils'
import type { ClauseRisk } from '@/hooks/useContracts'

interface ClauseCardProps {
  risk: ClauseRisk
}

// Human-readable labels for the model's category keys. Unknown keys fall back
// to a title-cased version of the raw key, so a new category still renders.
const CLAUSE_TYPE_LABELS: Record<string, string> = {
  auto_renewal: 'Auto-Renewal',
  liability_cap: 'Liability Cap',
  data_ownership: 'Data Ownership',
  price_change: 'Price Change',
  sla_no_penalty: 'SLA — No Penalty',
  termination: 'Termination',
  indemnification: 'Indemnification',
  governing_law: 'Governing Law',
}

function clauseLabel(clauseType: string): string {
  return (
    CLAUSE_TYPE_LABELS[clauseType] ??
    clauseType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  )
}

/** A single assessed clause: type, severity, why it's risky, what to do, and a
 * toggle to reveal the verbatim contract text. */
export function ClauseCard({ risk }: ClauseCardProps) {
  const [showOriginal, setShowOriginal] = useState(false)

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-display text-base font-semibold text-text-primary">
          {clauseLabel(risk.clause_type)}
        </h4>
        <RiskBadge severity={risk.severity} />
      </div>

      <p className="mt-2 text-sm text-text-primary">{risk.summary}</p>

      <div className="mt-3 rounded-md border border-border bg-background p-3">
        <p className="font-mono text-xs uppercase tracking-wide text-text-muted">
          Recommendation
        </p>
        <p className="mt-1 text-sm text-text-primary">{risk.recommendation}</p>
      </div>

      <button
        type="button"
        onClick={() => setShowOriginal((open) => !open)}
        aria-expanded={showOriginal}
        className="mt-3 inline-flex items-center gap-1 text-sm text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <ChevronDown
          className={cn('h-4 w-4 transition-transform', showOriginal && 'rotate-180')}
        />
        {showOriginal ? 'Hide original text' : 'View original text'}
      </button>

      {showOriginal && (
        <blockquote className="mt-2 whitespace-pre-wrap border-l-2 border-border pl-3 font-mono text-xs leading-relaxed text-text-muted">
          {risk.original_text}
        </blockquote>
      )}
    </div>
  )
}
