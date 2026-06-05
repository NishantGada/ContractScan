import { Building2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { Vendor } from '@/hooks/useVendors'

interface SidebarProps {
  vendors: Vendor[]
  /** id of the currently active vendor, if any. */
  activeVendorId?: string | null
  onSelect?: (vendor: Vendor) => void
}

/** Quick-navigation list of vendor names. */
export function Sidebar({ vendors, activeVendorId, onSelect }: SidebarProps) {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-surface md:block">
      <div className="px-4 py-5">
        <p className="px-2 font-mono text-xs uppercase tracking-widest text-text-muted">
          Vendors
        </p>
        <nav className="mt-3 space-y-0.5">
          {vendors.length === 0 ? (
            <p className="px-2 py-2 text-sm text-text-muted">No vendors yet.</p>
          ) : (
            vendors.map((vendor) => (
              <button
                key={vendor.id}
                type="button"
                onClick={() => onSelect?.(vendor)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors',
                  vendor.id === activeVendorId
                    ? 'bg-background font-medium text-text-primary'
                    : 'text-text-muted hover:bg-background hover:text-text-primary',
                )}
              >
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{vendor.name}</span>
              </button>
            ))
          )}
        </nav>
      </div>
    </aside>
  )
}
