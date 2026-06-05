import { useCallback, useEffect, useState } from 'react'

import { api } from '@/lib/api'

export const CONTRACT_TYPES = ['NDA', 'MSA', 'SaaS Agreement', 'SOW', 'Other'] as const

export type ContractType = (typeof CONTRACT_TYPES)[number]

export type ContractStatus = 'pending' | 'analyzing' | 'done' | 'failed'

export interface Contract {
  id: string
  vendor_id: string
  filename: string
  contract_type: ContractType | null
  status: ContractStatus
  uploaded_at: string
  analyzed_at: string | null
}

interface UploadInput {
  file: File
  contractType?: ContractType | null
}

interface UseContractsResult {
  contracts: Contract[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  uploadContract: (input: UploadInput) => Promise<Contract>
  deleteContract: (id: string) => Promise<void>
}

/**
 * Owns the contract list for a single vendor and the upload/delete mutations.
 * Mutations update local state after the server confirms, so the list reflects
 * changes without a full refetch. The JWT is attached by the axios interceptor
 * in lib/api.ts — this hook never touches identity.
 */
export function useContracts(vendorId: string): UseContractsResult {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const uploadContract = useCallback(
    async ({ file, contractType }: UploadInput) => {
      const form = new FormData()
      form.append('file', file)
      if (contractType) form.append('contract_type', contractType)

      // Let the browser set the multipart boundary; don't force Content-Type.
      const { data } = await api.post<Contract>(`/vendors/${vendorId}/contracts`, form)
      setContracts((prev) => [data, ...prev])
      return data
    },
    [vendorId],
  )

  const deleteContract = useCallback(async (id: string) => {
    await api.delete(`/contracts/${id}`)
    setContracts((prev) => prev.filter((c) => c.id !== id))
  }, [])

  return { contracts, loading, error, refetch, uploadContract, deleteContract }
}
