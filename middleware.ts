export { default } from 'next-auth/middleware'

export const config = {
  matcher: ['/((?!api/auth|api/cron|api/cron-smg|api/health|api/reauth|api/debug-env|_next/static|_next/image|favicon.ico|api/tableau-leadership|api/tableau-bozocoro).*)'],
}
