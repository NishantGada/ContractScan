import { useState } from 'react'
import { ChevronDown, FileText, Loader2, Sparkles, Trash2 } from 'lucide-react'

import { ClauseCard } from '@/components/analysis/ClauseCard'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ClauseRisk, Contract, ContractStatus } from '@/hooks/useContracts'

interface ContractListProps {
  contracts: Contract[]
  clauseRisks: Record<string, ClauseRisk[]>
  onDelete: (contract: Contract) => void
  onAnalyze: (id: string) => void
  onExpand: (id: string) => void
}

const STATUS_STYLES: Record<ContractStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'border-border bg-background text-text-muted' },
  analyzing: {
    label: 'Analyzing',
    className: 'border-risk-medium/30 bg-risk-medium/10 text-risk-medium',
  },
  done: { label: 'Analyzed', className: 'border-risk-low/30 bg-risk-low/10 text-risk-low' },
  failed: { label: 'Failed', className: 'border-risk-high/30 bg-risk-high/10 text-risk-high' },
}

function StatusBadge({ status }: { status: ContractStatus }) {
  const { label, className } = STATUS_STYLES[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs font-medium',
        className,
      )}
    >
      {status === 'analyzing' && <Loader2 className="h-3 w-3 animate-spin" />}
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

interface ContractRowProps {
  contract: Contract
  risks: ClauseRisk[] | undefined
  expanded: boolean
  onToggle: () => void
  onDelete: (contract: Contract) => void
  onAnalyze: (id: string) => void
}

function ContractRow({
  contract,
  risks,
  expanded,
  onToggle,
  onDelete,
  onAnalyze,
}: ContractRowProps) {
  const isDone = contract.status === 'done'

  return (
    <li>
      <div className="flex items-center gap-4 px-5 py-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${contract.filename}`}
          className="flex min-w-0 flex-1 items-center gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-text-muted transition-transform',
              expanded && 'rotate-180',
            )}
          />
          <FileText className="h-5 w-5 shrink-0 text-text-muted" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-text-primary">{contract.filename}</p>
            <p className="mt-0.5 font-mono text-xs text-text-muted">
              {contract.contract_type ?? 'Unspecified'} · uploaded{' '}
              {formatDate(contract.uploaded_at)}
            </p>
          </div>
        </button>
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
      </div>

      {expanded && (
        <div className="border-t border-border bg-background px-5 py-4">
          {contract.status === 'analyzing' && (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing this contract — risks will appear here when it’s done.
            </div>
          )}

          {contract.status === 'failed' && (
            <div className="flex flex-col items-start gap-3">
              <p role="alert" className="text-sm text-risk-high">
                Analysis failed for this contract.
              </p>
              <Button size="sm" variant="outline" onClick={() => onAnalyze(contract.id)}>
                <Sparkles className="h-4 w-4" />
                Retry analysis
              </Button>
            </div>
          )}

          {contract.status === 'pending' && (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-text-muted">This contract hasn’t been analyzed yet.</p>
              <Button size="sm" onClick={() => onAnalyze(contract.id)}>
                <Sparkles className="h-4 w-4" />
                Analyze contract
              </Button>
            </div>
          )}

          {isDone && risks === undefined && (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading analysis…
            </div>
          )}

          {isDone && risks !== undefined && risks.length === 0 && (
            <p className="text-sm text-text-muted">
              No risky clauses were found in this contract.
            </p>
          )}

          {isDone && risks !== undefined && risks.length > 0 && (
            <div className="space-y-3">
              {risks.map((risk) => (
                <ClauseCard key={risk.id} risk={risk} />
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  )
}

/** List of a vendor's contracts; each row expands to show its analysis. */
export function ContractList({
  contracts,
  clauseRisks,
  onDelete,
  onAnalyze,
  onExpand,
}: ContractListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

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

  function toggle(contract: Contract) {
    const next = expandedId === contract.id ? null : contract.id
    setExpandedId(next)
    // Lazily fetch clause risks the first time a finished contract is opened.
    if (next && contract.status === 'done') onExpand(contract.id)
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {contracts.map((contract) => (
        <ContractRow
          key={contract.id}
          contract={contract}
          risks={clauseRisks[contract.id]}
          expanded={expandedId === contract.id}
          onToggle={() => toggle(contract)}
          onDelete={onDelete}
          onAnalyze={onAnalyze}
        />
      ))}
    </ul>
  )
}
