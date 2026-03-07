'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

type NavBarProps = {
  /** Optional content to render to the right of the tabs (e.g. dashboard "Updated" + badge) */
  rightContent?: React.ReactNode
}

export default function NavBar({ rightContent }: NavBarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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

  const activeTabLabel = tabs.find((t) => isActive(t.href))?.label ?? 'Dashboard'

  return (
    <>
      {/* Backdrop - close menu when tapping outside */}
      <div
        aria-hidden="true"
        onClick={() => setMobileMenuOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 199,
          background: 'rgba(0,0,0,0.5)',
          display: mobileMenuOpen ? 'block' : 'none',
        }}
      />

      {/* Slide-down mobile menu */}
      {mobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            top: 52,
            left: 0,
            right: 0,
            zIndex: 200,
            background: '#13151c',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            padding: '8px 0',
            animation: 'slideDown 0.2s ease',
          }}
        >
          {tabs.map((tab) => {
            const active = isActive(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  padding: '14px 20px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: active ? '#e8441a' : 'rgba(255,255,255,0.7)',
                  borderLeft: active ? '3px solid #e8441a' : '3px solid transparent',
                  background: active ? 'rgba(232,68,26,0.06)' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textDecoration: 'none',
                }}
              >
                <span>{tab.label}</span>
                {active && (
                  <span style={{ fontSize: 10, color: '#e8441a' }}>● ACTIVE</span>
                )}
              </Link>
            )
          })}
        </div>
      )}

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
              letterSpacing: '0.05em', textTransform: 'uppercase' }}
              className="nav-subtitle"
            >
              Ops Intelligence
            </div>
          </div>
        </div>

        <div className="nav-tabs desktop-nav-tabs" style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          {tabs.map(tab => (
            <Link
              key={tab.href}
              href={tab.href}
              className="nav-tab-label"
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

        {/* Mobile: breadcrumb + hamburger */}
        <div
          className="mobile-nav-bar"
          style={{
            display: 'none',
            flex: 1,
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingLeft: 12,
          }}
        >
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Papa Johns  ›  {activeTabLabel}
          </div>
          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            className="mobile-menu-trigger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.7)',
              fontSize: 20,
              padding: '4px 8px',
              borderRadius: 6,
              display: 'none',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>

        {rightContent != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            {rightContent}
          </div>
        )}
      </div>
    </nav>
    </>
  )
}
