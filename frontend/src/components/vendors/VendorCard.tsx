import { Link } from 'react-router-dom'
import { ExternalLink, Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Vendor } from '@/hooks/useVendors'
import type { RiskSeverity } from '@/hooks/useContracts'
import { useVendorRisk, type VendorRiskSummary } from '@/hooks/useVendorRisk'

interface VendorCardProps {
  vendor: Vendor
  onEdit: (vendor: Vendor) => void
  onDelete: (vendor: Vendor) => void
}

// Dot color + accessible label per overall risk level. Colors come only from
// the semantic risk-* tokens.
const RISK_DOT: Record<RiskSeverity, { color: string; label: string }> = {
  high: { color: 'bg-risk-high', label: 'High risk' },
  medium: { color: 'bg-risk-medium', label: 'Medium risk' },
  low: { color: 'bg-risk-low', label: 'Low risk' },
}

// Resolve a vendor's summary to a single dot. Null = still loading; a vendor
// with no contracts is "not analyzed" (neutral), not low-risk.
function resolveDot(
  summary: VendorRiskSummary | null,
): { color: string; label: string } {
  if (summary === null) {
    return { color: 'bg-border animate-pulse', label: 'Loading risk level' }
  }
  if (summary.total_contracts === 0) {
    return { color: 'bg-text-muted/40', label: 'No contracts analyzed yet' }
  }
  return RISK_DOT[summary.overall]
}

/**
 * Vendor summary tile. The risk indicator reflects the vendor's real rolled-up
 * risk level (red/amber/green), fetched per card via useVendorRisk.
 */
export function VendorCard({ vendor, onEdit, onDelete }: VendorCardProps) {
  const { summary } = useVendorRisk(vendor.id)
  const dot = resolveDot(summary)

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={cn('h-2.5 w-2.5 shrink-0 rounded-full', dot.color)}
            title={dot.label}
            aria-label={`Risk level: ${dot.label}`}
          />
          <Link
            to={`/vendors/${vendor.id}`}
            className="font-display text-lg font-semibold leading-tight text-text-primary hover:text-primary hover:underline"
          >
            {vendor.name}
          </Link>
        </div>
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

      <div className="mt-4 flex items-center gap-2">
        {vendor.category ? (
          <span className="rounded-full border border-border bg-background px-2.5 py-0.5 font-mono text-xs text-text-muted">
            {vendor.category}
          </span>
        ) : (
          <span className="font-mono text-xs text-text-muted">Uncategorized</span>
        )}
      </div>

      {vendor.website && (
        <a
          href={vendor.website}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span className="truncate">{vendor.website.replace(/^https?:\/\//, '')}</span>
        </a>
      )}
    </Card>
  )
}
