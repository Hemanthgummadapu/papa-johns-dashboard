import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Temporarily disabled to diagnose "Application failed to respond"
// Redirect and matcher commented out — middleware now pass-through only.
export function middleware(_request: NextRequest) {
  return NextResponse.next()
}

// export const config = {
//   matcher: ['/((?!_next|api|favicon.ico).*)'],
// }
