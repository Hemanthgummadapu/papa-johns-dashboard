'use client'

import { useState, useEffect } from 'react'

interface ScraperStatus {
  id: string
  last_success_at: string | null
  last_error_at: string | null
  last_error_message: string | null
  session_expired: boolean
  updated_at: string
}

interface StatusResponse {
  live: ScraperStatus | null
  smg: ScraperStatus | null
}

export default function ScraperStatusBar() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [reauthing, setReauthing] = useState<'live' | 'smg' | null>(null)
  const [reauthMessage, setReauthMessage] = useState<string | null>(null)

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/scraper-status', { cache: 'no-store' })
      const data = await res.json()
      setStatus(data)
    } catch (error) {
      console.error('Failed to fetch scraper status:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 2 * 60 * 1000) // Every 2 minutes
    return () => clearInterval(interval)
  }, [])

  const handleReauth = async (type: 'live' | 'smg') => {
    setReauthing(type)
    
    try {
      const res = await fetch(`/api/reauth/${type}`, {
        method: 'POST',
        cache: 'no-store'
      })
      const json = await res.json()
      
      if (json.success) {
        setReauthMessage('A Terminal window has opened. If Microsoft MFA is required, complete it there. This window will close automatically when done.')
        // Re-enable button after brief delay
        setTimeout(() => setReauthing(null), 1000)
        
        // Auto-refresh status every 10 seconds to check if session_expired cleared
        const statusCheckInterval = setInterval(() => {
          fetchStatus().then(() => {
            // Check updated status
            fetch('/api/scraper-status', { cache: 'no-store' })
              .then(res => res.json())
              .then(data => {
                if (data && 
                    ((type === 'live' && !data.live?.session_expired) || 
                     (type === 'smg' && !data.smg?.session_expired))) {
                  clearInterval(statusCheckInterval)
                  setReauthMessage('✅ Session restored — banner will disappear shortly')
                  setTimeout(() => {
                    setReauthMessage(null)
                  }, 3000)
                }
              })
          })
        }, 10000)
        
        // Clear interval after 5 minutes max
        setTimeout(() => clearInterval(statusCheckInterval), 5 * 60 * 1000)
      } else {
        setReauthMessage(`❌ Failed to open Terminal: ${json.error || 'Unknown error'}`)
        setReauthing(null)
        setTimeout(() => setReauthMessage(null), 10000)
      }
    } catch (error: any) {
      setReauthMessage(`❌ Failed to open Terminal: ${error.message || 'Unknown error'}`)
      setReauthing(null)
      setTimeout(() => setReauthMessage(null), 10000)
    }
  }

  if (loading || !status) return null

  const liveExpired = status.live?.session_expired === true
  const smgExpired = status.smg?.session_expired === true

  if (!liveExpired && !smgExpired) return null

  return (
    <>
      {/* Status Banners */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 0 }}>
        {liveExpired && (
          <div style={{
            background: 'var(--danger-text)',
            color: 'white',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 14,
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}>
            <span>🔴 LIVE DATA EXPIRED — Microsoft session needs re-authentication</span>
            <button
              onClick={() => handleReauth('live')}
              disabled={reauthing === 'live'}
              style={{
                padding: '6px 16px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.3)',
                background: reauthing === 'live' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                color: 'white',
                cursor: reauthing === 'live' ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.2s',
                opacity: reauthing === 'live' ? 0.7 : 1
              }}
              onMouseEnter={(e) => {
                if (reauthing !== 'live') {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
                }
              }}
              onMouseLeave={(e) => {
                if (reauthing !== 'live') {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                }
              }}
            >
              Re-authenticate Now
            </button>
          </div>
        )}
        {smgExpired && (
          <div style={{
            background: 'var(--danger-text)',
            color: 'white',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 14,
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}>
            <span>🔴 GUEST EXPERIENCE DATA EXPIRED — Microsoft session needs re-authentication</span>
            <button
              onClick={() => handleReauth('smg')}
              disabled={reauthing === 'smg'}
              style={{
                padding: '6px 16px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.3)',
                background: reauthing === 'smg' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                color: 'white',
                cursor: reauthing === 'smg' ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.2s',
                opacity: reauthing === 'smg' ? 0.7 : 1
              }}
              onMouseEnter={(e) => {
                if (reauthing !== 'smg') {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
                }
              }}
              onMouseLeave={(e) => {
                if (reauthing !== 'smg') {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                }
              }}
            >
              Re-authenticate SMG
            </button>
          </div>
        )}
      </div>

      {/* Re-auth Modal */}
      {reauthMessage && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 2000,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 12,
          padding: '24px 32px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          maxWidth: 500,
          width: '90%'
        }}>
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            fontFamily: "'Inter', sans-serif",
            color: 'var(--text-primary)',
            marginBottom: 12,
            textAlign: 'center'
          }}>
            {reauthMessage}
          </div>
          <button
            onClick={() => setReauthMessage(null)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: 8,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-overlay)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "'Inter', sans-serif",
              marginTop: 16
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-elevated)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-overlay)'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            Close
          </button>
        </div>
      )}

      {/* Spacer to push content down when banners are visible */}
      {(liveExpired || smgExpired) && (
        <div style={{ height: liveExpired && smgExpired ? 96 : 48 }} />
      )}
    </>
  )
}
