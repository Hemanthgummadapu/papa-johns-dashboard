'use client'

import { useEffect, useState, useMemo } from 'react'

function formatDateShort(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type AutomationLogEntry = {
  id: string
  timestamp: string
  store_number: string
  date_start: string
  date_end: string
  source: string
  status: 'success' | 'failed' | 'processing'
  net_sales: number
  sheet_row: number | null
  error_message: string | null
  created_at: string
}

type PipelineStep = {
  id: string
  label: string
  icon: string
  status: 'pending' | 'processing' | 'complete' | 'error'
}

const STORE_COLORS = ['var(--store-1)', 'var(--store-2)', 'var(--store-3)', 'var(--store-4)', 'var(--store-5)', 'var(--store-6)']

export default function AutomationPage() {
  const [logs, setLogs] = useState<AutomationLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([
    { id: 'email', label: 'Email Received', icon: '📧', status: 'pending' },
    { id: 'pdf', label: 'PDF Detected', icon: '📎', status: 'pending' },
    { id: 'parse', label: 'Parsed', icon: '🔍', status: 'pending' },
    { id: 'validate', label: 'Validated', icon: '✓', status: 'pending' },
    { id: 'db', label: 'Saved to DB', icon: '💾', status: 'pending' },
    { id: 'sheet', label: 'Sheet Updated', icon: '📊', status: 'pending' },
    { id: 'dashboard', label: 'Dashboard Live', icon: '📈', status: 'pending' },
  ])
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastCheck, setLastCheck] = useState<Date | null>(null)
  const [monitoringActive, setMonitoringActive] = useState(true)

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/automation-log', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setLogs(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch automation logs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(fetchLogs, 30000) // Poll every 30 seconds
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (lastCheck) {
      const interval = setInterval(() => {
        setLastCheck(new Date())
      }, 60000) // Update every minute
      return () => clearInterval(interval)
    }
  }, [lastCheck])

  const handleManualCheck = async () => {
    setIsProcessing(true)
    setLastCheck(new Date())
    
    // Reset pipeline steps
    setPipelineSteps((prev) => prev.map((s) => ({ ...s, status: 'pending' as const })))

    // Animate through pipeline steps
    for (let i = 0; i < pipelineSteps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 800))
      setPipelineSteps((prev) =>
        prev.map((step, idx) => ({
          ...step,
          status:
            idx < i
              ? ('complete' as const)
              : idx === i
                ? ('processing' as const)
                : ('pending' as const),
        }))
      )
    }

    // Check Gmail for new emails with PDF attachments
    try {
      console.log('=== MANUAL CHECK: Checking Gmail for new reports ===')

      const res = await fetch('/api/email-listener', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkGmail: true, // This triggers real Gmail check
        }),
      })

      const result = await res.json()
      console.log('=== MANUAL CHECK: Result ===', JSON.stringify(result, null, 2))

      if (res.ok && result.success) {
        await fetchLogs()
        console.log('=== MANUAL CHECK: Success - Sheet updated ===')
        alert(`✓ Success! ${result.message || 'Report processed and written to Google Sheets'}`)
      } else {
        console.error('=== MANUAL CHECK: Failed ===')
        console.error('Error:', result.error)
        console.error('Message:', result.message)
        console.error('Details:', result.details)
        console.error('Step:', result.step)
        alert(`Manual check failed: ${result.error || result.message || 'Unknown error'}\n\nDetails: ${result.details || 'No additional details'}`)
      }
    } catch (error: any) {
      console.error('=== MANUAL CHECK: Error ===', error)
      alert(`Manual check failed: ${error.message || 'Unknown error'}`)
    } finally {
      setIsProcessing(false)
      // Mark all steps as complete
      setPipelineSteps((prev) => prev.map((s) => ({ ...s, status: 'complete' as const })))
    }
  }

  const handleDemo = async () => {
    setIsProcessing(true)
    setLastCheck(new Date())

    // Reset pipeline steps
    setPipelineSteps((prev) => prev.map((s) => ({ ...s, status: 'pending' as const })))

    const startTime = Date.now()

    // Animate through pipeline steps
    for (let i = 0; i < pipelineSteps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 800))
      setPipelineSteps((prev) =>
        prev.map((step, idx) => ({
          ...step,
          status:
            idx < i
              ? ('complete' as const)
              : idx === i
                ? ('processing' as const)
                : ('pending' as const),
        }))
      )
    }

    // Get the most recently uploaded PDF file (from localStorage)
    try {
      const pdfBase64 = localStorage.getItem('lastUploadedPDF')
      
      if (!pdfBase64) {
        alert('No PDF file found. Please upload a PDF in the "Upload Reports" tab first.')
        setIsProcessing(false)
        setPipelineSteps((prev) => prev.map((s) => ({ ...s, status: 'pending' as const })))
        return
      }

      // Convert base64 data URL to base64 string (remove data:application/pdf;base64, prefix)
      const base64String = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64

      console.log('=== DEMO: Sending PDF to email listener ===')
      console.log('PDF size:', base64String.length, 'characters (base64)')

      const res = await fetch('/api/email-listener', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulateEmail: true,
          pdfBuffer: base64String, // Send the actual PDF buffer for parsing
        }),
      })

      const result = await res.json()
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

      if (res.ok && result.success) {
        await fetchLogs()
        // Show success message
        alert(`✓ Report processed in ${elapsed}s — Sheet updated — Dashboard refreshed`)
      }
    } catch (error) {
      console.error('Demo failed:', error)
    } finally {
      setIsProcessing(false)
      // Mark all steps as complete
      setPipelineSteps((prev) => prev.map((s) => ({ ...s, status: 'complete' as const })))
    }
  }

  const lastCheckText = useMemo(() => {
    if (!lastCheck) return 'Never'
    const diff = Math.floor((Date.now() - lastCheck.getTime()) / 1000 / 60)
    if (diff < 1) return 'Just now'
    if (diff === 1) return '1 min ago'
    return `${diff} mins ago`
  }, [lastCheck])

  const recentLogs = useMemo(() => logs.slice(0, 20), [logs])
  const last5SheetRows = useMemo(() => logs.filter((l) => l.sheet_row && l.status === 'success').slice(0, 5), [logs])

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh', color: 'var(--text-primary)', padding: '32px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 20, color: 'var(--text-primary)', marginBottom: 8 }}>
            Email → Database Pipeline
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
            Every incoming report email is automatically processed and stored
          </div>
        </div>

        {/* Live Status Bar */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: monitoringActive ? 'var(--success)' : 'var(--text-disabled)',
                boxShadow: monitoringActive ? '0 0 8px var(--success)' : 'none',
                animation: monitoringActive ? 'pulse 2s infinite' : 'none',
              }}
            />
            <div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                {monitoringActive ? 'MONITORING' : 'INACTIVE'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif" }}>
                reports@company.com
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif" }}>
            Checks every 60 min · Last check: {lastCheckText}
          </div>
          <button
            onClick={handleManualCheck}
            disabled={isProcessing}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: isProcessing ? 'var(--bg-overlay)' : 'var(--brand)',
              color: '#fff',
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.04em',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              opacity: isProcessing ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isProcessing) {
                e.currentTarget.style.background = 'var(--brand-hover)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isProcessing) {
                e.currentTarget.style.background = 'var(--brand)'
              }
            }}
          >
            {isProcessing ? 'Processing...' : 'Trigger Manual Check'}
          </button>
        </div>

        {/* Pipeline Visualization */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 20 }}>
            Pipeline Status
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {pipelineSteps.map((step, idx) => (
              <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    minWidth: 100,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      background:
                        step.status === 'complete'
                          ? 'var(--success-subtle)'
                          : step.status === 'processing'
                            ? 'var(--info-subtle)'
                            : step.status === 'error'
                              ? 'var(--danger-subtle)'
                              : 'var(--bg-overlay)',
                      border: `2px solid ${
                        step.status === 'complete'
                          ? 'var(--success)'
                          : step.status === 'processing'
                            ? 'var(--info)'
                            : step.status === 'error'
                              ? 'var(--danger)'
                              : 'var(--border-default)'
                      }`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      position: 'relative',
                    }}
                  >
                    {step.status === 'complete' ? (
                      <span style={{ color: 'var(--success-text)', fontSize: 20 }}>✓</span>
                    ) : step.status === 'processing' ? (
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          border: '2px solid var(--info)',
                          borderTopColor: 'transparent',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite',
                        }}
                      />
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 20 }}>{step.icon}</span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color:
                        step.status === 'complete'
                          ? 'var(--success-text)'
                          : step.status === 'processing'
                            ? 'var(--info-text)'
                            : 'var(--text-tertiary)',
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: 500,
                      textAlign: 'center',
                    }}
                  >
                    {step.label}
                  </div>
                </div>
                {idx < pipelineSteps.length - 1 && (
                  <div
                    style={{
                      width: 40,
                      height: 2,
                      background:
                        step.status === 'complete' ? 'var(--success)' : 'var(--border-default)',
                      margin: '0 4px',
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Demo Button */}
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <button
            onClick={handleDemo}
            disabled={isProcessing}
            style={{
              padding: '12px 24px',
              borderRadius: 8,
              border: 'none',
              background: isProcessing ? 'var(--bg-overlay)' : 'var(--brand)',
              color: '#fff',
              fontFamily: "'Inter', sans-serif",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.04em',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              opacity: isProcessing ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isProcessing) {
                e.currentTarget.style.background = 'var(--brand-hover)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isProcessing) {
                e.currentTarget.style.background = 'var(--brand)'
              }
            }}
          >
            🎬 Run Demo: Simulate Email Arrival
          </button>
        </div>

        {/* Automation Log Table */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
            overflowX: 'auto',
          }}
        >
          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 20 }}>
            Automation Log
          </div>
          {loading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", fontSize: 13 }}>
              Loading logs...
            </div>
          ) : recentLogs.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", fontSize: 13 }}>
              No automation logs yet. Trigger a manual check or run the demo to see the pipeline in action.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-base)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', borderBottom: '1px solid var(--border-subtle)' }}>
                    TIMESTAMP
                  </th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', borderBottom: '1px solid var(--border-subtle)' }}>
                    STORE
                  </th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', borderBottom: '1px solid var(--border-subtle)' }}>
                    PERIOD
                  </th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', borderBottom: '1px solid var(--border-subtle)' }}>
                    STATUS
                  </th>
                  <th style={{ textAlign: 'right', padding: '10px 16px', color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', borderBottom: '1px solid var(--border-subtle)' }}>
                    NET SALES
                  </th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', borderBottom: '1px solid var(--border-subtle)' }}>
                    SHEET ROW
                  </th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', borderBottom: '1px solid var(--border-subtle)' }}>
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log, idx) => {
                  const storeIdx = parseInt(log.store_number, 10) % STORE_COLORS.length
                  const storeColor = STORE_COLORS[storeIdx]
                  const timestamp = new Date(log.timestamp || log.created_at)
                  const formattedTime = timestamp.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })

                  return (
                    <tr
                      key={log.id}
                      style={{
                        background: idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                    >
                      <td style={{ padding: '10px 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-secondary)' }}>
                        {formattedTime}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: storeColor, flexShrink: 0 }} />
                          <span style={{ color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600 }}>
                            {log.store_number}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", fontSize: 13 }}>
                        {log.date_start && log.date_end
                          ? `${formatDateShort(log.date_start)} – ${formatDateShort(log.date_end)}`
                          : '—'}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 500,
                            fontFamily: "'Inter', sans-serif",
                            letterSpacing: '0.12em',
                            background:
                              log.status === 'success'
                                ? 'var(--success-subtle)'
                                : log.status === 'failed'
                                  ? 'var(--danger-subtle)'
                                  : 'var(--warning-subtle)',
                            color:
                              log.status === 'success'
                                ? 'var(--success-text)'
                                : log.status === 'failed'
                                  ? 'var(--danger-text)'
                                  : 'var(--warning-text)',
                          }}
                        >
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {log.net_sales ? `$${log.net_sales.toLocaleString()}` : '—'}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        {log.sheet_row ? (
                          <a
                            href={`https://docs.google.com/spreadsheets/d/${process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID || 'SHEET_ID'}#gid=0&range=A${log.sheet_row}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: 'var(--info-text)',
                              fontFamily: "'Inter', sans-serif",
                              fontSize: 13,
                              textDecoration: 'none',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.textDecoration = 'underline'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.textDecoration = 'none'
                            }}
                          >
                            Row {log.sheet_row}
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontSize: 13 }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            style={{
                              padding: '4px 8px',
                              borderRadius: 6,
                              border: '1px solid var(--border-default)',
                              background: 'var(--bg-overlay)',
                              color: 'var(--text-secondary)',
                              fontFamily: "'Inter', sans-serif",
                              fontSize: 11,
                              fontWeight: 500,
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = 'var(--border-strong)'
                              e.currentTarget.style.color = 'var(--text-primary)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'var(--border-default)'
                              e.currentTarget.style.color = 'var(--text-secondary)'
                            }}
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Google Sheets Preview */}
        {last5SheetRows.length > 0 && (
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
                Last 5 rows written to Google Sheets
              </div>
              <a
                href={`https://docs.google.com/spreadsheets/d/${process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID || 'SHEET_ID'}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-overlay)',
                  color: 'var(--text-secondary)',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--brand)'
                  e.currentTarget.style.color = 'var(--brand)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-default)'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }}
              >
                Open Full Google Sheet →
              </a>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-base)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', borderBottom: '1px solid var(--border-subtle)' }}>
                      TIMESTAMP
                    </th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', borderBottom: '1px solid var(--border-subtle)' }}>
                      STORE
                    </th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', borderBottom: '1px solid var(--border-subtle)' }}>
                      PERIOD START
                    </th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', borderBottom: '1px solid var(--border-subtle)' }}>
                      PERIOD END
                    </th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', borderBottom: '1px solid var(--border-subtle)' }}>
                      NET SALES
                    </th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-tertiary)', fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', borderBottom: '1px solid var(--border-subtle)' }}>
                      LABOR %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {last5SheetRows.map((log, idx) => (
                    <tr
                      key={log.id}
                      style={{
                        background: idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                    >
                      <td style={{ padding: '8px 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-secondary)' }}>
                        {new Date(log.timestamp || log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {log.store_number}
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: "'Inter', sans-serif", fontSize: 13, color: 'var(--text-secondary)' }}>
                        {log.date_start ? formatDateShort(log.date_start) : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: "'Inter', sans-serif", fontSize: 13, color: 'var(--text-secondary)' }}>
                        {log.date_end ? formatDateShort(log.date_end) : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {log.net_sales ? `$${log.net_sales.toLocaleString()}` : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                        —
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}

