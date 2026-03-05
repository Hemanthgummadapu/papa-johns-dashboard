import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const HOST = process.env.TABLEAU_HOST
  const COOKIE = process.env.TABLEAU_COOKIE
  const XSRF = process.env.TABLEAU_XSRF_TOKEN

  console.log('HOST:', HOST)
  console.log('COOKIE set:', !!COOKIE)
  console.log('XSRF set:', !!XSRF)

  const url = `https://${HOST}/t/storeanalytics/views/ZeroBadandCanceled/BadOrderSummary.csv?:embed=yes`

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const https = require('https') as typeof import('https')
    const res = await fetch(url, {
      headers: {
        Cookie: COOKIE || '',
        'X-XSRF-TOKEN': XSRF || '',
        Accept: 'text/csv,*/*',
        Referer: `https://${HOST}/`,
        'User-Agent': 'Mozilla/5.0',
      },
      redirect: 'follow',
      agent: new https.Agent({ rejectUnauthorized: false }),
    } as RequestInit & { agent: import('https').Agent })

    const text = await res.text()
    return NextResponse.json({
      status: res.status,
      url: res.url,
      contentType: res.headers.get('content-type'),
      preview: text.substring(0, 500),
      isHTML: text.includes('<!DOCTYPE'),
      cookieSet: !!COOKIE,
      hostSet: !!HOST,
    })
  } catch (err: unknown) {
    const e = err as Error & { cause?: { message?: string } }
    return NextResponse.json(
      {
        error: e.message,
        cause: e.cause?.message ?? e.cause,
        name: e.name,
      },
      { status: 500 }
    )
  }
}
