import { NextResponse } from 'next/server'
import https from 'https'

export const dynamic = 'force-dynamic';

function getDefaultDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || 'daily'
  const date = searchParams.get('date') || getDefaultDate()

  const user = process.env.PAPAJOHNS_CUBE_USER!
  const pass = process.env.PAPAJOHNS_CUBE_PASSWORD!
  const auth = Buffer.from(`${user}:${pass}`).toString('base64')

  let whereClause = ''
  if (period === 'daily') {
    whereClause = `[Calendar].[Calendar Date].&[${date}]`
  } else if (period === 'monthly') {
    const [year, month] = date.split('-')
    whereClause = `[Calendar].[Calendar Year Month].&[Y${year} M${month}]`
  } else if (period === 'weekly') {
    // NOTE: Fiscal Week in OARS cube may not align exactly with ISO week.
    // Current implementation uses ISO week number as fiscal week number.
    // Validate with Brad: does PJ fiscal week 01 start same day as ISO W01?
    // If offset exists, adjust: fiscalWeek = isoWeek + offset
    const weekNum = date.split('-W')[1] || date
    const year = date.split('-')[0]
    whereClause = `([Calendar].[Fiscal Year].&[${year}],[Calendar].[Fiscal Week].&[${weekNum}])`
  } else if (period === 'yearly') {
    whereClause = `[Calendar].[Fiscal Year].&[${date}]`
  } else {
    whereClause = `[Calendar].[Calendar Date].&[${date}]`
  }

  const CUBE_TIMEOUT_MS = 8000

  try {
    const stores = ['2081', '2021', '2259', '2292', '2481', '3011']
    const storeMembers = stores.map(s => `[Stores].[Store Number].&[${s}]`).join(',')

    const mdx = `SELECT {
  [Measures].[TY Net Sales USD],
  [Measures].[TY Gross Sales USD],
  [Measures].[LY Net Sales USD],
  [Measures].[Actual Labor %],
  [Measures].[Actual Food Cost USD],
  [Measures].[Actual FLM w/o Vacation Accrual %],
  [Measures].[DDD Net Sales USD],
  [Measures].[TY Aggregator Delivery Net Sales USD],
  [Measures].[LY Aggregator Delivery Net Sales USD],
  [Measures].[TY Papa Johns Delivery Net Sales USD],
  [Measures].[TY Carryout Net Sales USD],
  [Measures].[TY Delivery Net Sales USD],
  [Measures].[TY Phone Net Sales USD],
  [Measures].[TY App Net Sales USD],
  [Measures].[TY Web Net Sales USD],
  [Measures].[TY Online Net Sales USD],
  [Measures].[TY Orders],
  [Measures].[TY Delivery Orders],
  [Measures].[TY Online Orders],
  [Measures].[TY Aggregator Delivery Orders],
  [Measures].[TY Carryout Orders]
} ON COLUMNS, {${storeMembers}} ON ROWS FROM [OARS] WHERE ${whereClause}`

    const body = `<?xml version="1.0"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Body><Execute xmlns="urn:schemas-microsoft-com:xml-analysis"><Command><Statement>${mdx.replace(/&/g, '&amp;')}</Statement></Command><Properties><PropertyList><Catalog>OARS</Catalog></PropertyList></Properties></Execute></SOAP-ENV:Body></SOAP-ENV:Envelope>`

    const xmlResponse = await new Promise<string>((resolve, reject) => {
      const req = https.request({
        hostname: 'ednacubes.papajohns.com',
        port: 10502,
        path: '/xmla/default',
        method: 'POST',
        rejectUnauthorized: false,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'text/xml',
          'SOAPAction': '"urn:schemas-microsoft-com:xml-analysis:Execute"',
          'Content-Length': Buffer.byteLength(body)
        }
      }, res => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => resolve(data))
      })
      req.on('error', reject)
      const timeout = setTimeout(() => {
        req.destroy(new Error('ETIMEDOUT'))
        reject(new Error('ETIMEDOUT'))
      }, CUBE_TIMEOUT_MS)
      req.on('close', () => clearTimeout(timeout))
      req.write(body)
      req.end()
    })

    // Parse: extract store captions from Axis1, cell values from CellData
    const captionMatches: string[] = []
    const captionRegex = /<Caption>(\d{4})<\/Caption>/g
    let captionMatch: RegExpExecArray | null
    while ((captionMatch = captionRegex.exec(xmlResponse)) !== null) {
      captionMatches.push(captionMatch[1])
    }
    const cells: Record<number, number> = {}
    const cellRegex = /CellOrdinal="(\d+)"><Value[^>]*>([\d.E+\-]+)<\/Value>/g
    let cm: RegExpExecArray | null
    while ((cm = cellRegex.exec(xmlResponse)) !== null) {
      cells[parseInt(cm[1])] = parseFloat(cm[2])
    }

    const MEASURES = 21
    const result = captionMatches.map((storeNumber, i) => {
      const netSales = cells[i * MEASURES + 0] ?? 0
      const grossSales = cells[i * MEASURES + 1] ?? 0
      const totalOrders = cells[i * MEASURES + 16] ?? 0
      const carryoutOrders = cells[i * MEASURES + 20] ?? 0
      const deliveryOrders = cells[i * MEASURES + 17] ?? 0
      const onlineOrders = cells[i * MEASURES + 18] ?? 0
      return {
        storeNumber,
        netSales: cells[i * MEASURES + 0] ?? null,
        grossSales: grossSales || 0,
        lyNetSales: cells[i * MEASURES + 2] ?? null,
        laborPct: cells[i * MEASURES + 3] != null ? Math.round(cells[i * MEASURES + 3] * 1000) / 10 : null,
        foodCostUsd: cells[i * MEASURES + 4] ?? null,
        flmPct: cells[i * MEASURES + 5] != null ? Math.round(cells[i * MEASURES + 5] * 1000) / 10 : null,
        dddSales: cells[i * MEASURES + 6] ?? null,
        aggregatorSales: cells[i * MEASURES + 7] ?? null,
        lyAggregatorSales: cells[i * MEASURES + 8] ?? null,
        pjDeliverySales: cells[i * MEASURES + 9] ?? null,
        carryoutSales: cells[i * MEASURES + 10] ?? null,
        totalDeliverySales: cells[i * MEASURES + 11] ?? null,
        phoneSales: cells[i * MEASURES + 12] ?? null,
        appSales: cells[i * MEASURES + 13] ?? null,
        webSales: cells[i * MEASURES + 14] ?? null,
        onlineSales: cells[i * MEASURES + 15] ?? null,
        totalOrders: cells[i * MEASURES + 16] ?? null,
        deliveryOrders: cells[i * MEASURES + 17] ?? null,
        onlineOrders: cells[i * MEASURES + 18] ?? null,
        aggregatorOrders: cells[i * MEASURES + 19] ?? null,
        carryoutOrders: cells[i * MEASURES + 20] ?? null,
        avgTicket: totalOrders > 0 ? Math.round((netSales / totalOrders) * 100) / 100 : 0,
        avgDiscount: totalOrders > 0 ? Math.round(((grossSales - netSales) / totalOrders) * 100) / 100 : 0,
        carryoutPct: totalOrders > 0 ? Math.round((carryoutOrders / totalOrders) * 100) : 0,
        deliveryPct: totalOrders > 0 ? Math.round((deliveryOrders / totalOrders) * 100) : 0,
        onlinePct: totalOrders > 0 ? Math.round((onlineOrders / totalOrders) * 100) : 0,
      }
    })

    return NextResponse.json({ success: true, date, period, stores: result })
  } catch (_error: unknown) {
    return NextResponse.json(
      {
        success: false,
        status: 'offline',
        message: 'Cube server unavailable',
        date,
        period,
        stores: [],
      },
      { status: 503 }
    )
  }
}

