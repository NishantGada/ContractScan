import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from '@/lib/api'

export const CONTRACT_TYPES = ['NDA', 'MSA', 'SaaS Agreement', 'SOW', 'Other'] as const

export type ContractType = (typeof CONTRACT_TYPES)[number]

export type ContractStatus = 'pending' | 'analyzing' | 'done' | 'failed'

export type RiskSeverity = 'high' | 'medium' | 'low'

export interface Contract {
  id: string
  vendor_id: string
  filename: string
  contract_type: ContractType | null
  status: ContractStatus
  uploaded_at: string
  analyzed_at: string | null
}

export interface ClauseRisk {
  id: string
  contract_id: string
  clause_type: string
  severity: RiskSeverity
  summary: string
  original_text: string
  recommendation: string
  created_at: string
}

interface ContractAnalysis {
  contract_id: string
  status: ContractStatus
  analyzed_at: string | null
  clause_risks: ClauseRisk[]
}

interface UploadInput {
  file: File
  contractType?: ContractType | null
}

interface UseContractsResult {
  contracts: Contract[]
  loading: boolean
  error: string | null
  clauseRisks: Record<string, ClauseRisk[]>
  refetch: () => Promise<void>
  uploadContract: (input: UploadInput) => Promise<Contract>
  deleteContract: (id: string) => Promise<void>
  analyzeContract: (id: string) => Promise<void>
  loadAnalysis: (id: string) => Promise<void>
}

const POLL_INTERVAL_MS = 3000

/**
 * Owns the contract list for a single vendor plus the analysis lifecycle:
 * upload auto-triggers analysis, contracts in the `analyzing` state are polled
 * every 3s until they reach `done`/`failed`, and clause risks are kept in a
 * by-contract map (filled when a poll finishes or lazily when a row is
 * expanded). The JWT is attached by the axios interceptor — this hook never
 * touches identity.
 */
export function useContracts(vendorId: string): UseContractsResult {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clauseRisks, setClauseRisks] = useState<Record<string, ClauseRisk[]>>({})

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get<Contract[]>(`/vendors/${vendorId}/contracts`)
      setContracts(data)
    } catch {
      setError('Could not load contracts. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [vendorId])

  useEffect(() => {
    // Reload whenever the vendor changes. All state is touched inside the async
    // helper (never synchronously in the effect body) to avoid cascading renders.
    let active = true
    const load = async () => {
      setLoading(true)
      setError(null)
      setClauseRisks({})
      try {
        const { data } = await api.get<Contract[]>(`/vendors/${vendorId}/contracts`)
        if (active) setContracts(data)
      } catch {
        if (active) setError('Could not load contracts. Please try again.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [vendorId])

  // Apply a finished analysis: advance the contract's status and cache its risks.
  const applyAnalysis = useCallback((data: ContractAnalysis) => {
    setContracts((prev) =>
      prev.map((c) =>
        c.id === data.contract_id
          ? { ...c, status: data.status, analyzed_at: data.analyzed_at }
          : c,
      ),
    )
    setClauseRisks((prev) => ({ ...prev, [data.contract_id]: data.clause_risks }))
  }, [])

  // Poll every contract currently `analyzing` until it reaches a terminal state.
  // A ref holds the latest ids so the interval body never reads a stale list.
  const analyzingIdsRef = useRef<string[]>([])
  analyzingIdsRef.current = contracts
    .filter((c) => c.status === 'analyzing')
    .map((c) => c.id)
  const hasAnalyzing = analyzingIdsRef.current.length > 0

  useEffect(() => {
    if (!hasAnalyzing) return
    let active = true
    const tick = async () => {
      await Promise.all(
        analyzingIdsRef.current.map(async (id) => {
          try {
            const { data } = await api.get<ContractAnalysis>(`/contracts/${id}/analysis`)
            if (active && data.status !== 'analyzing') applyAnalysis(data)
          } catch {
            // Transient error — keep polling on the next tick.
          }
        }),
      )
    }
    const interval = window.setInterval(() => void tick(), POLL_INTERVAL_MS)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [hasAnalyzing, applyAnalysis])

  const analyzeContract = useCallback(async (id: string) => {
    // Optimistically reflect `analyzing` so the poll effect kicks in immediately.
    setContracts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'analyzing' } : c)),
    )
    setClauseRisks((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    await api.post(`/contracts/${id}/analyze`)
  }, [])

  const loadAnalysis = useCallback(
    async (id: string) => {
      if (clauseRisks[id]) return // already cached
      const { data } = await api.get<ContractAnalysis>(`/contracts/${id}/analysis`)
      setClauseRisks((prev) => ({ ...prev, [id]: data.clause_risks }))
    },
    [clauseRisks],
  )

  const uploadContract = useCallback(
    async ({ file, contractType }: UploadInput) => {
      const form = new FormData()
      form.append('file', file)
      if (contractType) form.append('contract_type', contractType)

      // Let the browser set the multipart boundary; don't force Content-Type.
      const { data } = await api.post<Contract>(`/vendors/${vendorId}/contracts`, form)
      // Show it right away, then auto-trigger analysis (status flips to analyzing).
      setContracts((prev) => [data, ...prev])
      await analyzeContract(data.id)
      return data
    },
    [vendorId, analyzeContract],
  )

  const deleteContract = useCallback(async (id: string) => {
    await api.delete(`/contracts/${id}`)
    setContracts((prev) => prev.filter((c) => c.id !== id))
    setClauseRisks((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  return {
    contracts,
    loading,
    error,
    clauseRisks,
    refetch,
    uploadContract,
    deleteContract,
    analyzeContract,
    loadAnalysis,
  }
}
