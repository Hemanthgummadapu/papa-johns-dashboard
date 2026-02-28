import { NextResponse } from 'next/server'
import https from 'https'

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
    const weekNum = date.split('-W')[1] || date
    const year = date.split('-')[0]
    whereClause = `([Calendar].[Fiscal Year].&[${year}],[Calendar].[Fiscal Week].&[${weekNum}])`
  } else if (period === 'yearly') {
    whereClause = `[Calendar].[Fiscal Year].&[${date}]`
  } else {
    whereClause = `[Calendar].[Calendar Date].&[${date}]`
  }

  const stores = ['2081', '2021', '2259', '2292', '2481', '3011']
  const storeMembers = stores.map(s => `[Stores].[Store Number].&[${s}]`).join(',')

  const mdx = `SELECT {
  [Measures].[TY Net Sales USD],
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
  [Measures].[TY Orders],
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

  const MEASURES = 15
  const result = captionMatches.map((storeNumber, i) => ({
    storeNumber,
    netSales: cells[i * MEASURES + 0] ?? null,
    lyNetSales: cells[i * MEASURES + 1] ?? null,
    laborPct: cells[i * MEASURES + 2] != null ? Math.round(cells[i * MEASURES + 2] * 1000) / 10 : null,
    foodCostUsd: cells[i * MEASURES + 3] ?? null,
    flmPct: cells[i * MEASURES + 4] != null ? Math.round(cells[i * MEASURES + 4] * 1000) / 10 : null,
    dddSales: cells[i * MEASURES + 5] ?? null,
    aggregatorSales: cells[i * MEASURES + 6] ?? null,
    lyAggregatorSales: cells[i * MEASURES + 7] ?? null,
    pjDeliverySales: cells[i * MEASURES + 8] ?? null,
    carryoutSales: cells[i * MEASURES + 9] ?? null,
    totalDeliverySales: cells[i * MEASURES + 10] ?? null,
    phoneSales: cells[i * MEASURES + 11] ?? null,
    totalOrders: cells[i * MEASURES + 12] ?? null,
    aggregatorOrders: cells[i * MEASURES + 13] ?? null,
    carryoutOrders: cells[i * MEASURES + 14] ?? null,
  }))

  return NextResponse.json({ success: true, date, period, stores: result })
}

