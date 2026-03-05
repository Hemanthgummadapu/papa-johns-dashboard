'use client'

import { useState, useCallback, useEffect } from 'react'

const VIEW_OPTIONS: { value: string; label: string; type: 'summary' | 'detail' }[] = [
  { value: 'ZeroedOutDetails', label: 'Zeroed Out Details', type: 'detail' },
  { value: 'ZeroedOutSummary', label: 'Zeroed Out Summary', type: 'summary' },
  { value: 'BadOrderDetails', label: 'Bad Order Details', type: 'detail' },
  { value: 'BadOrderSummary', label: 'Bad Order Summary', type: 'summary' },
  { value: 'CanceledOrderDetails', label: 'Canceled Order Details', type: 'detail' },
  { value: 'CanceledOrderSummary', label: 'Canceled Order Summary', type: 'summary' },
  { value: 'RefundOrderDetails', label: 'Refund Order Details', type: 'detail' },
  { value: 'RefundOrderSummary', label: 'Refund Order Summary', type: 'summary' },
]

function detectViewFromFilename(name: string): string | null {
  const base = name.replace(/\.csv$/i, '').replace(/\s/g, '').toLowerCase()
  if (base.includes('zero') && base.includes('detail')) return 'ZeroedOutDetails'
  if (base.includes('zero') && base.includes('summary')) return 'ZeroedOutSummary'
  if (base.includes('bad') && base.includes('detail')) return 'BadOrderDetails'
  if (base.includes('bad') && base.includes('summary')) return 'BadOrderSummary'
  if (base.includes('cancel') && base.includes('detail')) return 'CanceledOrderDetails'
  if (base.includes('cancel') && base.includes('summary')) return 'CanceledOrderSummary'
  if (base.includes('refund') && base.includes('detail')) return 'RefundOrderDetails'
  if (base.includes('refund') && base.includes('summary')) return 'RefundOrderSummary'
  return null
}

function getViewLabel(viewValue: string): string {
  return VIEW_OPTIONS.find((o) => o.value === viewValue)?.label ?? viewValue
}

const AUDIT_TYPE_LABELS: Record<string, string> = {
  zeroed_out: 'Zeroed Out',
  bad_order: 'Bad Order',
  canceled: 'Canceled',
  refund: 'Refund',
}
function getResultLabel(auditType: string, type: string): string {
  const base = AUDIT_TYPE_LABELS[auditType] ?? auditType
  return type === 'summary' ? `${base} Summary` : `${base} Details`
}

type TimePeriod = 'current_period' | 'last_period' | 'last_year'

interface FileEntry {
  file: File
  id: string
  detectedView: string | null
  selectedView: string
  status: 'pending' | 'uploading' | 'done' | 'error'
  rowsInserted?: number
  error?: string
}

interface AuditUploadProps {
  /** Page-selected period; when provided, upload uses this so "Last Year" tab + upload sends timePeriod=last_year */
  selectedTimePeriod?: TimePeriod
  onUploadComplete?: () => void
}

export default function AuditUpload({ selectedTimePeriod, onUploadComplete }: AuditUploadProps) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('current_period')
  const timePeriodForUpload = selectedTimePeriod ?? timePeriod
  useEffect(() => {
    if (selectedTimePeriod != null) setTimePeriod(selectedTimePeriod)
  }, [selectedTimePeriod])
  const [files, setFiles] = useState<FileEntry[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploadResults, setUploadResults] = useState<{ auditType: string; type: string; rows: number }[]>([])

  const addFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return
    const csvs = Array.from(newFiles).filter((f) => f.name.toLowerCase().endsWith('.csv'))
    const existing = files.length
    if (existing + csvs.length > 8) return
    const entries: FileEntry[] = csvs.slice(0, 8 - existing).map((f) => ({
      file: f,
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      detectedView: detectViewFromFilename(f.name),
      selectedView: detectViewFromFilename(f.name) ?? VIEW_OPTIONS[0].value,
      status: 'pending',
    }))
    setFiles((prev) => [...prev, ...entries])
    setUploadResults([])
  }, [files.length])

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((e) => e.id !== id))
    setUploadResults([])
  }

  const setSelectedView = (id: string, viewName: string) => {
    setFiles((prev) => prev.map((e) => (e.id === id ? { ...e, selectedView: viewName } : e)))
  }

  const uploadAll = async () => {
    if (files.length === 0) return
    setUploading(true)
    setUploadResults([])
    setFiles((prev) => prev.map((e) => ({ ...e, status: 'uploading' as const })))
    const form = new FormData()
    form.set('timePeriod', timePeriodForUpload)
    files.forEach((e) => form.append('files', e.file))
    form.set('viewNames', JSON.stringify(files.map((e) => e.selectedView)))
    try {
      const res = await fetch('/api/audit/upload', { method: 'POST', body: form })
      const data = await res.json()
      const results = (data.results ?? []) as Array<{ file: string; rowsInserted: number; auditType: string; type: string }>
      const errors = (data.errors ?? []) as string[]
      setFiles((prev) =>
        prev.map((entry, i) => {
          const r = results[i]
          if (!r) return { ...entry, status: 'error' as const, error: 'No result' }
          const fileError = errors.find((err: string) => err.includes(entry.file.name))
          return {
            ...entry,
            status: fileError ? 'error' : 'done',
            rowsInserted: r.rowsInserted,
            error: fileError ?? undefined,
          }
        })
      )
      setUploadResults(
        results
          .filter((r) => r.rowsInserted > 0)
          .map((r) => ({ auditType: r.auditType, type: r.type, rows: r.rowsInserted }))
      )
    } catch (err) {
      setFiles((prev) => prev.map((e) => ({ ...e, status: 'error' as const, error: err instanceof Error ? err.message : String(err) })))
    }
    setUploading(false)
    onUploadComplete?.()
  }

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        padding: 20,
      }}
    >
      <h3 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
        Upload Tableau Data
      </h3>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Time Period
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {(['current_period', 'last_period', 'last_year'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setTimePeriod(p)}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid var(--border-default)',
                background: timePeriodForUpload === p ? 'var(--brand)' : 'var(--bg-overlay)',
                color: timePeriodForUpload === p ? '#fff' : 'var(--text-primary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {p === 'current_period' ? 'Current Period' : p === 'last_period' ? 'Last Period' : 'Last Year'}
            </button>
          ))}
          {selectedTimePeriod != null && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              (Upload will use: {timePeriodForUpload === 'current_period' ? 'Current Period' : timePeriodForUpload === 'last_period' ? 'Last Period' : 'Last Year'})
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          border: `2px dashed ${dragOver ? 'var(--brand)' : 'var(--border-subtle)'}`,
          borderRadius: 12,
          padding: 24,
          textAlign: 'center',
          background: dragOver ? 'var(--bg-overlay)' : 'var(--bg-base)',
          cursor: 'pointer',
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
        onClick={() => document.getElementById('audit-csv-input')?.click()}
      >
        <input
          id="audit-csv-input"
          type="file"
          accept=".csv"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => addFiles(e.target.files)}
        />
        <span style={{ fontSize: 32 }}>📂</span>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
          Drop CSV files here or click to browse
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>
          (select up to 8 files)
        </p>
      </div>

      {files.length > 0 && (
        <>
          <div style={{ marginTop: 16, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Detected
          </div>
          <ul style={{ marginTop: 8, padding: 0, listStyle: 'none' }}>
            {files.map((entry) => (
              <li
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 12px',
                  background: 'var(--bg-overlay)',
                  borderRadius: 8,
                  marginBottom: 6,
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ color: entry.status === 'done' ? 'var(--success-text)' : entry.status === 'error' ? 'var(--danger-text)' : entry.detectedView ? 'var(--text-secondary)' : 'var(--warning-text, #b8860b)' }}>
                  {entry.status === 'uploading' ? '⏳' : entry.status === 'done' ? '✅' : entry.status === 'error' ? '❌' : entry.detectedView ? '✅' : '⚠'}
                </span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{entry.file.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {entry.status === 'done' && entry.rowsInserted != null ? `→ ${entry.rowsInserted} rows` : entry.status === 'uploading' ? '→ uploading' : `→ ${getViewLabel(entry.selectedView)}`}
                </span>
                <select
                  value={entry.selectedView}
                  onChange={(e) => setSelectedView(entry.id, e.target.value)}
                  disabled={entry.status === 'uploading'}
                  style={{
                    fontSize: 11,
                    padding: '4px 8px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    minWidth: 160,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {VIEW_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {entry.status !== 'uploading' && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeFile(entry.id) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 14 }}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
          {files.some((f) => f.status === 'error' && f.error) && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--danger-text)' }}>
              {files.filter((f) => f.error).map((f) => `${f.file.name}: ${f.error}`).join('; ')}
            </div>
          )}
          <button
            type="button"
            onClick={uploadAll}
            disabled={uploading || files.every((f) => f.status === 'done')}
            style={{
              marginTop: 16,
              width: '100%',
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: uploading ? 'var(--bg-overlay)' : 'var(--brand)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: uploading ? 'not-allowed' : 'pointer',
            }}
          >
            {uploading ? 'Uploading…' : 'Upload All'}
          </button>
          {uploadResults.length > 0 && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-overlay)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              {uploadResults.map((r, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: i ? 4 : 0 }}>
                  ✅ {getResultLabel(r.auditType, r.type)}: {r.rows} rows
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
