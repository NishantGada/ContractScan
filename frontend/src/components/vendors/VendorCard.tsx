import { Link } from 'react-router-dom'
import { ExternalLink, Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Vendor } from '@/hooks/useVendors'

interface VendorCardProps {
  vendor: Vendor
  onEdit: (vendor: Vendor) => void
  onDelete: (vendor: Vendor) => void
}

/**
 * Vendor summary tile. The risk indicator is a placeholder for now — always
 * green; Feature 7 wires it to real per-vendor risk data.
 */
export function VendorCard({ vendor, onEdit, onDelete }: VendorCardProps) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {/* Placeholder risk indicator — green until Feature 7. */}
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-risk-low"
            title="Risk level pending analysis"
            aria-label="Risk level: not yet analyzed"
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
