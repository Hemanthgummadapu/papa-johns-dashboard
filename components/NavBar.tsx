'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

type NavBarProps = {
  /** Optional content to render to the right of the tabs (e.g. dashboard "Updated" + badge) */
  rightContent?: React.ReactNode
}

export default function NavBar({ rightContent }: NavBarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tabs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Live', href: '/dashboard?tab=live' },
    { label: 'Guest', href: '/dashboard?tab=guest' },
    { label: 'Trends', href: '/trends' },
    { label: 'Forecast', href: '/dashboard?tab=forecast' },
    { label: 'Operations', href: '/dashboard?tab=operations' },
    { label: 'Analytics', href: '/analytics/profitability' },
    { label: '✦ AI', href: '/ai' },
  ]

  const isActive = (href: string) => {
    const base = href.split('?')[0]
    if (href === '/dashboard' && !href.includes('tab=')) {
      const tab = searchParams.get('tab')
      return (pathname === '/dashboard' || pathname === '/') && !tab
    }
    if (href.startsWith('/dashboard?tab=')) {
      const tab = href.split('tab=')[1]
      return pathname === '/dashboard' && searchParams.get('tab') === tab
    }
    return pathname.startsWith(base)
  }

  return (
    <nav style={{
      background: 'var(--bg-surface, #13151c)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      padding: '0 28px',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <div style={{
        maxWidth: 1440,
        margin: '0 auto',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        gap: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 28 }}>
          <div style={{
            width: 32, height: 32, background: '#e8441a',
            borderRadius: 8, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 18
          }}>🍕</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14,
              letterSpacing: '-0.02em' }}>Papa Johns</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Ops Intelligence
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          {tabs.map(tab => (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                padding: '6px 13px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: isActive(tab.href) ? 600 : 500,
                background: isActive(tab.href) ? '#e8441a' : 'transparent',
                color: isActive(tab.href) ? '#fff' : 'rgba(255,255,255,0.35)',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {rightContent != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            {rightContent}
          </div>
        )}
      </div>
    </nav>
  )
}
