import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: '#0a0b0f',
        color: 'rgba(255,255,255,0.7)',
      }}
    >
      <div style={{ fontSize: 32 }}>⚠️</div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>Page not found</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
        The page you’re looking for doesn’t exist or was moved.
      </div>
      <Link
        href="/dashboard"
        style={{
          background: '#e8441a',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '10px 24px',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Back to Dashboard
      </Link>
    </div>
  )
}
