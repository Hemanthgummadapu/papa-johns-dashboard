import type { Metadata } from 'next'
import './globals.css'
import ScraperStatusBar from '@/components/ScraperStatusBar'
import { Providers } from '@/components/Providers'

export const metadata: Metadata = {
  title: 'Papa Johns Dashboard',
  description: 'Multi-store restaurant reporting dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ background: '#0a0b0f', color: '#f1f3f9' }}>
        <Providers>
          <ScraperStatusBar />
          {children}
        </Providers>
      </body>
    </html>
  )
}

