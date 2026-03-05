export { default } from 'next-auth/middleware'

export const config = {
  matcher: ['/((?!api/auth|api/cron|api/cron-smg|api/health|api/reauth|api/live-data|api/scrape-live|api/scrape-extranet|_next/static|_next/image|favicon.ico|api/tableau-leadership|api/tableau-bozocoro|api/hotschedules).*)'],
}
