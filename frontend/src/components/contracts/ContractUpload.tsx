import { useRef, useState, type DragEvent } from 'react'
import { FileText, Loader2, UploadCloud } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { CONTRACT_TYPES, type ContractType } from '@/hooks/useContracts'

interface ContractUploadProps {
  // The component awaits this but ignores its resolved value, so a handler that
  // returns the created contract (useContracts.uploadContract) is accepted too.
  onUpload: (input: { file: File; contractType: ContractType | null }) => Promise<unknown>
}

const MAX_BYTES = 50 * 1024 * 1024 // mirror the backend's 50MB limit

/** Validates a candidate file is a PDF within the size limit. */
function validatePdf(file: File): string | null {
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!isPdf) return 'Only PDF files are accepted.'
  if (file.size === 0) return 'That file is empty.'
  if (file.size > MAX_BYTES) return 'File exceeds the 50MB limit.'
  return null
}

/**
 * Drag-and-drop (or click-to-browse) PDF upload. Validates the file client-side
 * before handing it to the parent, which performs the actual upload. The
 * backend re-validates — this is purely for fast feedback.
 */
export function ContractUpload({ onUpload }: ContractUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [contractType, setContractType] = useState<ContractType | ''>('')
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  function selectFile(candidate: File) {
    const problem = validatePdf(candidate)
    if (problem) {
      setError(problem)
      setFile(null)
      return
    }
    setError(null)
    setFile(candidate)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) selectFile(dropped)
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      await onUpload({ file, contractType: contractType || null })
      setFile(null)
      setContractType('')
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a contract PDF"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          dragging
            ? 'border-primary bg-primary/5'
            : 'border-border bg-background hover:border-primary/50',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const chosen = e.target.files?.[0]
            if (chosen) selectFile(chosen)
            e.target.value = '' // allow re-selecting the same file
          }}
        />
        {file ? (
          <>
            <FileText className="h-8 w-8 text-primary" />
            <p className="mt-3 font-medium text-text-primary">{file.name}</p>
            <p className="mt-1 font-mono text-xs text-text-muted">
              {(file.size / 1024 / 1024).toFixed(2)} MB · click to choose a different file
            </p>
          </>
        ) : (
          <>
            <UploadCloud className="h-8 w-8 text-text-muted" />
            <p className="mt-3 font-medium text-text-primary">
              Drag a PDF here, or click to browse
            </p>
            <p className="mt-1 text-sm text-text-muted">PDF only · up to 50MB</p>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-risk-high">
          {error}
        </p>
      )}

      {file && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="contract-type">Contract type</Label>
            <Select
              id="contract-type"
              value={contractType}
              onChange={(e) => setContractType(e.target.value as ContractType | '')}
            >
              <option value="">Unspecified</option>
              {CONTRACT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={handleUpload} disabled={uploading}>
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading…
              </>
            ) : (
              'Upload contract'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
