import { FileText, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Contract, ContractStatus } from '@/hooks/useContracts'

interface ContractListProps {
  contracts: Contract[]
  onDelete: (contract: Contract) => void
}

const STATUS_STYLES: Record<ContractStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'border-border bg-background text-text-muted' },
  analyzing: { label: 'Analyzing', className: 'border-risk-medium/30 bg-risk-medium/10 text-risk-medium' },
  done: { label: 'Analyzed', className: 'border-risk-low/30 bg-risk-low/10 text-risk-low' },
  failed: { label: 'Failed', className: 'border-risk-high/30 bg-risk-high/10 text-risk-high' },
}

function StatusBadge({ status }: { status: ContractStatus }) {
  const { label, className } = STATUS_STYLES[status]
  return (
    <span
      className={cn(
        'rounded-full border px-2.5 py-0.5 font-mono text-xs font-medium',
        className,
      )}
    >
      {label}
    </span>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** List of a vendor's uploaded contracts with type, upload date, and status. */
export function ContractList({ contracts, onDelete }: ContractListProps) {
  if (contracts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
        <p className="font-medium text-text-primary">No contracts yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-text-muted">
          Upload a contract PDF above to start tracking this vendor’s risk.
        </p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {contracts.map((contract) => (
        <li key={contract.id} className="flex items-center gap-4 px-5 py-4">
          <FileText className="h-5 w-5 shrink-0 text-text-muted" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-text-primary">{contract.filename}</p>
            <p className="mt-0.5 font-mono text-xs text-text-muted">
              {contract.contract_type ?? 'Unspecified'} · uploaded {formatDate(contract.uploaded_at)}
            </p>
          </div>
          <StatusBadge status={contract.status} />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 p-0 text-text-muted hover:text-risk-high"
            onClick={() => onDelete(contract)}
            aria-label={`Delete ${contract.filename}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </li>
      ))}
    </ul>
  )
}
