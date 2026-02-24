'use client'

import { useState, useRef } from 'react'

type ParsedData = {
  store_number: string
  date_start: string
  date_end: string
  net_sales: number
  labor_pct: number
  food_cost_pct: number
  flm_pct: number
  cash_short: number
  doordash_sales: number
  ubereats_sales: number
}

type UploadItem = {
  file: File
  name: string
  size: string
  status: 'ready' | 'uploading' | 'done' | 'error'
  error?: string
  parsedData?: ParsedData
}

type YearOverYearUploadPanelProps = {
  onCompare: (current: ParsedData, lastYear: ParsedData) => Promise<void>
  disabled?: boolean
}

function formatDateShort(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function YearOverYearUploadPanel({ onCompare, disabled }: YearOverYearUploadPanelProps) {
  const [currentFile, setCurrentFile] = useState<UploadItem | null>(null)
  const [lastYearFile, setLastYearFile] = useState<UploadItem | null>(null)
  const [currentDrag, setCurrentDrag] = useState(false)
  const [lastYearDrag, setLastYearDrag] = useState(false)
  const currentRef = useRef<HTMLInputElement | null>(null)
  const lastYearRef = useRef<HTMLInputElement | null>(null)

  const handleFile = async (file: File, period: 'current' | 'lastyear') => {
    const item: UploadItem = {
      file,
      name: file.name,
      size: `${(file.size / 1024).toFixed(0)}KB`,
      status: 'uploading',
    }

    if (period === 'current') {
      setCurrentFile(item)
    } else {
      setLastYearFile(item)
    }

    try {
      const fd = new FormData()
      fd.append('file', file, file.name)
      const res = await fetch(`/api/parse-pdf?period=${period}`, { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) throw new Error(json?.error || 'Parse failed')

      const parsedData: ParsedData = {
        store_number: json.store_number,
        date_start: json.date_start,
        date_end: json.date_end,
        net_sales: json.net_sales,
        labor_pct: json.labor_pct,
        food_cost_pct: json.food_cost_pct,
        flm_pct: json.flm_pct,
        cash_short: json.cash_short,
        doordash_sales: json.doordash_sales,
        ubereats_sales: json.ubereats_sales,
      }

      if (period === 'current') {
        setCurrentFile({ ...item, status: 'done', parsedData })
      } else {
        setLastYearFile({ ...item, status: 'done', parsedData })
      }
    } catch (e: any) {
      if (period === 'current') {
        setCurrentFile({ ...item, status: 'error', error: e?.message || 'Upload failed' })
      } else {
        setLastYearFile({ ...item, status: 'error', error: e?.message || 'Upload failed' })
      }
    }
  }

  const canCompare = currentFile?.status === 'done' && lastYearFile?.status === 'done'
  const storeMismatch =
    canCompare &&
    currentFile.parsedData?.store_number !== lastYearFile.parsedData?.store_number

  const handleCompare = async () => {
    if (!canCompare || !currentFile.parsedData || !lastYearFile.parsedData) return
    await onCompare(currentFile.parsedData, lastYearFile.parsedData)
  }

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Current Period Zone */}
        <div>
          <div
            className={`upload-zone ${currentDrag ? 'drag' : ''}`}
            style={{
              padding: 40,
              textAlign: 'center',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              minHeight: 200,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onDragOver={(e) => {
              e.preventDefault()
              if (!disabled) setCurrentDrag(true)
            }}
            onDragLeave={() => setCurrentDrag(false)}
            onDrop={(e) => {
              e.preventDefault()
              setCurrentDrag(false)
              if (!disabled && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0]
                if (file.name.toLowerCase().endsWith('.pdf')) {
                  handleFile(file, 'current')
                }
              }
            }}
            onClick={() => {
              if (!disabled) currentRef.current?.click()
            }}
          >
            <input
              ref={currentRef}
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0], 'current')
                }
              }}
            />
            <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
            <div
              style={{
                fontFamily: "'Syne',sans-serif",
                fontSize: 16,
                fontWeight: 700,
                color: '#e2e8f0',
                marginBottom: 6,
              }}
            >
              Current Report
            </div>
            <div style={{ fontSize: 13, color: '#4b5a7a' }}>Drop PDF here (e.g. Jan 2026)</div>
          </div>

          {currentFile && (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  background: '#0f1425',
                  border: '1px solid #1e2a40',
                  borderRadius: 10,
                  padding: '12px 16px',
                }}
              >
                <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500, marginBottom: 4 }}>{currentFile.name}</div>
                {currentFile.status === 'error' && (
                  <div style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>{currentFile.error || 'Upload failed'}</div>
                )}
                {currentFile.status === 'done' && currentFile.parsedData && (
                  <div style={{ fontSize: 11, color: '#4b5a7a', fontFamily: "'DM Mono',monospace", marginTop: 4 }}>
                    Store {currentFile.parsedData.store_number} · {formatDateShort(currentFile.parsedData.date_start)} –{' '}
                    {formatDateShort(currentFile.parsedData.date_end)}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 11,
                    color:
                      currentFile.status === 'ready'
                        ? '#34d399'
                        : currentFile.status === 'uploading'
                          ? '#60a5fa'
                          : currentFile.status === 'done'
                            ? '#34d399'
                            : '#f87171',
                    fontFamily: "'DM Mono',monospace",
                    marginTop: 4,
                  }}
                >
                  {currentFile.status.toUpperCase()}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Last Year Zone */}
        <div>
          <div
            className={`upload-zone ${lastYearDrag ? 'drag' : ''}`}
            style={{
              padding: 40,
              textAlign: 'center',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              minHeight: 200,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onDragOver={(e) => {
              e.preventDefault()
              if (!disabled) setLastYearDrag(true)
            }}
            onDragLeave={() => setLastYearDrag(false)}
            onDrop={(e) => {
              e.preventDefault()
              setLastYearDrag(false)
              if (!disabled && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0]
                if (file.name.toLowerCase().endsWith('.pdf')) {
                  handleFile(file, 'lastyear')
                }
              }
            }}
            onClick={() => {
              if (!disabled) lastYearRef.current?.click()
            }}
          >
            <input
              ref={lastYearRef}
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0], 'lastyear')
                }
              }}
            />
            <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
            <div
              style={{
                fontFamily: "'Syne',sans-serif",
                fontSize: 16,
                fontWeight: 700,
                color: '#e2e8f0',
                marginBottom: 6,
              }}
            >
              Last Year Report
            </div>
            <div style={{ fontSize: 13, color: '#4b5a7a' }}>Drop PDF here (e.g. Jan 2025)</div>
          </div>

          {lastYearFile && (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  background: '#0f1425',
                  border: '1px solid #1e2a40',
                  borderRadius: 10,
                  padding: '12px 16px',
                }}
              >
                <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500, marginBottom: 4 }}>{lastYearFile.name}</div>
                {lastYearFile.status === 'error' && (
                  <div style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>{lastYearFile.error || 'Upload failed'}</div>
                )}
                {lastYearFile.status === 'done' && lastYearFile.parsedData && (
                  <div style={{ fontSize: 11, color: '#4b5a7a', fontFamily: "'DM Mono',monospace", marginTop: 4 }}>
                    Store {lastYearFile.parsedData.store_number} · {formatDateShort(lastYearFile.parsedData.date_start)} –{' '}
                    {formatDateShort(lastYearFile.parsedData.date_end)}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 11,
                    color:
                      lastYearFile.status === 'ready'
                        ? '#34d399'
                        : lastYearFile.status === 'uploading'
                          ? '#60a5fa'
                          : lastYearFile.status === 'done'
                            ? '#34d399'
                            : '#f87171',
                    fontFamily: "'DM Mono',monospace",
                    marginTop: 4,
                  }}
                >
                  {lastYearFile.status.toUpperCase()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Store Mismatch Warning */}
      {storeMismatch && (
        <div
          style={{
            background: 'rgba(245,158,11,0.15)',
            border: '1px solid #f59e0b',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 20 }}>⚠</span>
          <div style={{ fontSize: 13, color: '#f59e0b' }}>
            Store numbers don't match ({currentFile.parsedData?.store_number} vs {lastYearFile.parsedData?.store_number}) — are you sure?
          </div>
        </div>
      )}

      {/* Compare Button */}
      <button
        disabled={!canCompare || disabled}
        onClick={handleCompare}
        style={{
          width: '100%',
          padding: '12px 0',
          background: canCompare ? 'linear-gradient(135deg,#e8410a,#ff6b35)' : '#1e2a40',
          border: 'none',
          borderRadius: 12,
          color: '#fff',
          fontFamily: "'Syne',sans-serif",
          fontSize: 14,
          fontWeight: 700,
          cursor: canCompare && !disabled ? 'pointer' : 'not-allowed',
          letterSpacing: '0.05em',
          opacity: canCompare && !disabled ? 1 : 0.7,
        }}
      >
        {canCompare ? 'COMPARE BOTH REPORTS' : 'UPLOAD BOTH REPORTS TO COMPARE'}
      </button>
    </div>
  )
}

