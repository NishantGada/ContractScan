import { Link } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RiskBadge } from '@/components/analysis/RiskBadge'
import { cn } from '@/lib/utils'
import type { Vendor } from '@/hooks/useVendors'
import type { DashboardVendor } from '@/hooks/useDashboard'

interface VendorRiskRowProps {
  entry: DashboardVendor
  onEdit: (vendor: Vendor) => void
  onDelete: (vendor: Vendor) => void
}

// Compact per-severity counts. Colors come only from the semantic risk-* tokens.
const COUNTS = [
  { key: 'high', label: 'High', color: 'bg-risk-high' },
  { key: 'medium', label: 'Medium', color: 'bg-risk-medium' },
  { key: 'low', label: 'Low', color: 'bg-risk-low' },
] as const

/**
 * One vendor row in the ranked portfolio overview: risk standing, name,
 * category, contract count, and per-severity counts, with edit/delete actions.
 * All risk data is supplied by the dashboard roll-up — this row never fetches.
 */
export function VendorRiskRow({ entry, onEdit, onDelete }: VendorRiskRowProps) {
  const { vendor, total_contracts, total_risks, overall } = entry
  const counts = { high: entry.high, medium: entry.medium, low: entry.low }

  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <Link
            to={`/vendors/${vendor.id}`}
            className="truncate font-display text-lg font-semibold leading-tight text-text-primary hover:text-primary hover:underline"
          >
            {vendor.name}
          </Link>
          {total_contracts === 0 ? (
            <span className="shrink-0 font-mono text-xs text-text-muted">
              Not analyzed
            </span>
          ) : total_risks === 0 ? (
            <span className="shrink-0 rounded-full border border-risk-low/30 bg-risk-low/10 px-2.5 py-0.5 font-mono text-xs font-medium text-risk-low">
              No risks
            </span>
          ) : (
            <RiskBadge severity={overall} className="shrink-0" />
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {vendor.category ? (
            <span className="rounded-full border border-border bg-background px-2.5 py-0.5 font-mono text-xs text-text-muted">
              {vendor.category}
            </span>
          ) : (
            <span className="font-mono text-xs text-text-muted">Uncategorized</span>
          )}
          <span className="font-mono text-xs text-text-muted">
            {total_contracts} {total_contracts === 1 ? 'contract' : 'contracts'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <ul className="flex items-center gap-4">
          {COUNTS.map(({ key, label, color }) => (
            <li key={key} className="flex items-center gap-1.5" title={label}>
              <span className={cn('h-2.5 w-2.5 rounded-full', color)} />
              <span className="font-mono text-sm font-semibold text-text-primary">
                {counts[key]}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onEdit(vendor)}
            aria-label={`Edit ${vendor.name}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-text-muted hover:text-risk-high"
            onClick={() => onDelete(vendor)}
            aria-label={`Delete ${vendor.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
