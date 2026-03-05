import { NextResponse } from 'next/server'
import https from 'https'

export const dynamic = 'force-dynamic';

function getDefaultDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

/** Execute XMLA and parse response to store captions and cell values. */
async function executeCubeQuery(
  catalog: string,
  mdx: string,
  auth: string,
  timeoutMs: number
): Promise<{ storeNumbers: string[]; cells: Record<number, number> }> {
  const body = `<?xml version="1.0"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Body><Execute xmlns="urn:schemas-microsoft-com:xml-analysis"><Command><Statement>${mdx.replace(/&/g, '&amp;')}</Statement></Command><Properties><PropertyList><Catalog>${catalog}</Catalog></PropertyList></Properties></Execute></SOAP-ENV:Body></SOAP-ENV:Envelope>`

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
    const t = setTimeout(() => {
      req.destroy(new Error('ETIMEDOUT'))
      reject(new Error('ETIMEDOUT'))
    }, timeoutMs)
    req.on('close', () => clearTimeout(t))
    req.write(body)
    req.end()
  })

  const storeNumbers: string[] = []
  const captionRegex = /<Caption>(\d{4})<\/Caption>/g
  let m: RegExpExecArray | null
  while ((m = captionRegex.exec(xmlResponse)) !== null) storeNumbers.push(m[1])

  const cells: Record<number, number> = {}
  const cellRegex = /CellOrdinal="(\d+)"><Value[^>]*>([\d.E+\-]+)<\/Value>/g
  let cm: RegExpExecArray | null
  while ((cm = cellRegex.exec(xmlResponse)) !== null) {
    cells[parseInt(cm[1])] = parseFloat(cm[2])
  }

  return { storeNumbers, cells }
}

/** OARS date filter: Day / Week (year + week) / Period (year + period) / Year */
function oarsWhereClause(period: string, date: string): string {
  if (period === 'daily') {
    return `([Calendar].[Calendar Date].&[${date}])`
  }
  if (period === 'weekly') {
    const year = date.split('-')[0] || String(new Date().getFullYear())
    const weekNum = date.split('-W')[1]?.replace(/^0+/, '') || date
    return `([Calendar].[Fiscal Year].&[${year}],[Calendar].[Fiscal Week].&[${weekNum}])`
  }
  if (period === 'monthly') {
    const year = date.split('-')[0] || String(new Date().getFullYear())
    const periodNum = date.split('-')[1]?.replace(/^0+/, '') || date
    return `([Calendar].[Fiscal Year].&[${year}],[Calendar].[Fiscal Period].&[${periodNum}])`
  }
  if (period === 'yearly') {
    const year = date.split('-')[0] || date
    return `([Calendar].[Fiscal Year].&[${year}])`
  }
  return `([Calendar].[Calendar Date].&[${date}])`
}

/** VBO date filter: Day / Week (year+week) / Period (year+period) / Year */
function vboWhereClause(period: string, date: string): string {
  if (period === 'daily') {
    return `([Calendar].[Calendar Date].&[${date}])`
  }
  if (period === 'weekly') {
    const year = date.split('-')[0] || String(new Date().getFullYear())
    const weekNum = date.split('-W')[1]?.replace(/^0+/, '') || date
    return `([Calendar].[Year Week].&[${weekNum}]&[${year}])`
  }
  if (period === 'monthly') {
    const year = date.split('-')[0] || String(new Date().getFullYear())
    const periodNum = date.split('-')[1]?.replace(/^0+/, '') || date
    return `([Calendar].[Year Period].&[${periodNum}]&[${year}])`
  }
  if (period === 'yearly') {
    const year = date.split('-')[0] || date
    return `([Calendar].[Fiscal Year].&[${year}])`
  }
  return `([Calendar].[Calendar Date].&[${date}])`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  let period = searchParams.get('period') || 'daily'
  if (period === 'week') period = 'weekly'
  const date = searchParams.get('date') || getDefaultDate()

  const user = process.env.PAPAJOHNS_CUBE_USER!
  const pass = process.env.PAPAJOHNS_CUBE_PASSWORD!
  const auth = Buffer.from(`${user}:${pass}`).toString('base64')

  const CUBE_TIMEOUT_MS = 12000
  const stores = ['2081', '2021', '2259', '2292', '2481', '3011']
  const storeMembersOars = stores.map(s => `[Stores].[Store Number].&[${s}]`).join(',')

  try {
    // ─── OARS: Labor & Food + Sales/Orders. Date: Day / Week / Period / Year
    const oarsWhere = oarsWhereClause(period, date)
    const mdxOars = `SELECT {
  [Measures].[TY Net Sales USD],
  [Measures].[TY Gross Sales USD],
  [Measures].[LY Net Sales USD],
  [Measures].[Actual Labor %],
  [Measures].[Actual Labor $ USD],
  [Measures].[Total Labor %],
  [Measures].[Actual Food %],
  [Measures].[Actual Food Cost USD],
  [Measures].[Target Food %],
  [Measures].[FLMD %],
  [Measures].[Food Variance %],
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
} ON COLUMNS, {${storeMembersOars}} ON ROWS FROM [OARS] WHERE ${oarsWhere}`

    // ─── VBO: Voids, Cash, Discounts. Store: [Stores].[Store Number].&[s]. Date: Day / Week / Period / Year
    const vboWhere = vboWhereClause(period, date)
    const vboMeasures = [
      '[Measures].[Void Made Orders]',
      '[Measures].[Void Made Amount USD]',
      '[Measures].[Void Made % Net Sales USD]',
      '[Measures].[Cash Over/Short USD]',
      '[Measures].[Discounts USD]',
      '[Measures].[High Discount Amount USD]',
      '[Measures].[High Disc % Net Sales USD]'
    ]
    const vboMdx = `SELECT {${vboMeasures.join(',')}} ON COLUMNS, {${stores.map(s => `[Stores].[Store Number].&[${s}]`).join(',')}} ON ROWS FROM [VBO] WHERE ${vboWhere}`

    // ─── ProfitKeeper: BoZoCoRo + EBITDA. Store: [Stores].[Store Number].&[s]. No date filter.
    // (DoorDash Delivery %, Aggregator Fees/Commissions %, Total Labor OT Hours — commented out, not in query)
    const storeMembersPk = stores.map(s => `[Stores].[Store Number].&[${s}]`).join(', ')
    const mdxPk = `SELECT {
  [Measures].[BOZOCORO Net Sales USD],
  [Measures].[Bad Order Net Sales USD],
  [Measures].[Zeroed Orders],
  [Measures].[Cancelled Order Net Sales USD],
  [Measures].[Refunded Orders],
  [Measures].[Restaurant Level EBITDA]
} ON COLUMNS, { ${storeMembersPk} } ON ROWS FROM [ProfitKeeper]`

    const measureListOffers = `[Measures].[Discount Amount USD],
  [Measures].[Average Discount USD],
  [Measures].[Redeemed Count],
  [Measures].[Gross Margin Per Order USD]`

    const [oarsResult, vboResult, pkResult, offersResult] = await Promise.allSettled([
      executeCubeQuery('OARS', mdxOars, auth, CUBE_TIMEOUT_MS),
      executeCubeQuery('VBO', vboMdx, auth, CUBE_TIMEOUT_MS),
      executeCubeQuery('ProfitKeeper', mdxPk, auth, CUBE_TIMEOUT_MS),
      executeCubeQuery('Offers', `SELECT { ${measureListOffers} } ON COLUMNS, {${storeMembersOars}} ON ROWS FROM [Offers] WHERE ${oarsWhere}`, auth, CUBE_TIMEOUT_MS),
    ])

    const oars = oarsResult.status === 'fulfilled' ? oarsResult.value : { storeNumbers: [] as string[], cells: {} as Record<number, number> }
    const vbo = vboResult.status === 'fulfilled' ? vboResult.value : { storeNumbers: [] as string[], cells: {} as Record<number, number> }
    const pk = pkResult.status === 'fulfilled' ? pkResult.value : { storeNumbers: [] as string[], cells: {} as Record<number, number> }
    const offers = offersResult.status === 'fulfilled' ? offersResult.value : { storeNumbers: [] as string[], cells: {} as Record<number, number> }

    const MEASURES_OARS = 26
    const MEASURES_VBO = 7
    const MEASURES_PK = 6
    const MEASURES_OFFERS = 4

    const result = oars.storeNumbers.map((storeNumber, i) => {
      const netSales = oars.cells[i * MEASURES_OARS + 0] ?? 0
      const grossSales = oars.cells[i * MEASURES_OARS + 1] ?? 0
      const totalOrders = oars.cells[i * MEASURES_OARS + 21] ?? 0
      const carryoutOrders = oars.cells[i * MEASURES_OARS + 25] ?? 0
      const deliveryOrders = oars.cells[i * MEASURES_OARS + 22] ?? 0
      const onlineOrders = oars.cells[i * MEASURES_OARS + 23] ?? 0

      const vboIdx = vbo.storeNumbers.indexOf(storeNumber)
      const pkIdx = pk.storeNumbers.indexOf(storeNumber)
      const offersIdx = offers.storeNumbers.indexOf(storeNumber)

      const row: Record<string, string | number | null> = {
        storeNumber,
        netSales: oars.cells[i * MEASURES_OARS + 0] ?? null,
        grossSales: grossSales || 0,
        lyNetSales: oars.cells[i * MEASURES_OARS + 2] ?? null,
        laborPct: oars.cells[i * MEASURES_OARS + 3] != null ? Math.round(oars.cells[i * MEASURES_OARS + 3] * 1000) / 10 : null,
        totalLabor: oars.cells[i * MEASURES_OARS + 4] ?? null,
        totalLaborPct: oars.cells[i * MEASURES_OARS + 5] != null ? Math.round(oars.cells[i * MEASURES_OARS + 5] * 1000) / 10 : null,
        actualFoodPct: oars.cells[i * MEASURES_OARS + 6] != null ? Math.round(oars.cells[i * MEASURES_OARS + 6] * 1000) / 10 : null,
        foodCostUsd: oars.cells[i * MEASURES_OARS + 7] ?? null,
        targetFoodPct: oars.cells[i * MEASURES_OARS + 8] != null ? Math.round(oars.cells[i * MEASURES_OARS + 8] * 1000) / 10 : null,
        flmPct: oars.cells[i * MEASURES_OARS + 9] != null ? Math.round(oars.cells[i * MEASURES_OARS + 9] * 1000) / 10 : null,
        foodVariancePct: oars.cells[i * MEASURES_OARS + 10] != null ? Math.round(oars.cells[i * MEASURES_OARS + 10] * 10000) / 100 : null,
        targetFoodCostUsd: null,
        dddSales: oars.cells[i * MEASURES_OARS + 11] ?? null,
        aggregatorSales: oars.cells[i * MEASURES_OARS + 12] ?? null,
        lyAggregatorSales: oars.cells[i * MEASURES_OARS + 13] ?? null,
        pjDeliverySales: oars.cells[i * MEASURES_OARS + 14] ?? null,
        carryoutSales: oars.cells[i * MEASURES_OARS + 15] ?? null,
        totalDeliverySales: oars.cells[i * MEASURES_OARS + 16] ?? null,
        phoneSales: oars.cells[i * MEASURES_OARS + 17] ?? null,
        appSales: oars.cells[i * MEASURES_OARS + 18] ?? null,
        webSales: oars.cells[i * MEASURES_OARS + 19] ?? null,
        onlineSales: oars.cells[i * MEASURES_OARS + 20] ?? null,
        totalOrders: oars.cells[i * MEASURES_OARS + 21] ?? null,
        deliveryOrders: oars.cells[i * MEASURES_OARS + 22] ?? null,
        onlineOrders: oars.cells[i * MEASURES_OARS + 23] ?? null,
        aggregatorOrders: oars.cells[i * MEASURES_OARS + 24] ?? null,
        carryoutOrders: oars.cells[i * MEASURES_OARS + 25] ?? null,
        avgTicket: totalOrders > 0 ? Math.round((netSales / totalOrders) * 100) / 100 : 0,
        avgDiscount: totalOrders > 0 ? Math.round(((grossSales - netSales) / totalOrders) * 100) / 100 : 0,
        carryoutPct: totalOrders > 0 ? Math.round((carryoutOrders / totalOrders) * 100) : 0,
        deliveryPct: totalOrders > 0 ? Math.round((deliveryOrders / totalOrders) * 100) : 0,
        onlinePct: totalOrders > 0 ? Math.round((onlineOrders / totalOrders) * 100) : 0,
      }

      if (vboIdx >= 0) {
        row.voidMadeOrders = vbo.cells[vboIdx * MEASURES_VBO + 0] ?? null
        row.voidMadeAmountUsd = vbo.cells[vboIdx * MEASURES_VBO + 1] ?? null
        row.voidMadePctNetSalesUsd = vbo.cells[vboIdx * MEASURES_VBO + 2] != null ? Math.round(vbo.cells[vboIdx * MEASURES_VBO + 2] * 10) / 10 : null
        row.cashOverShortUsd = vbo.cells[vboIdx * MEASURES_VBO + 3] ?? null
        row.totalDiscountsUsd = vbo.cells[vboIdx * MEASURES_VBO + 4] ?? null
        row.highDiscountAmountUsd = vbo.cells[vboIdx * MEASURES_VBO + 5] ?? null
        row.highDiscPctNetSalesUsd = vbo.cells[vboIdx * MEASURES_VBO + 6] != null ? Math.round(vbo.cells[vboIdx * MEASURES_VBO + 6] * 10) / 10 : null
        row.overtimeHours = null
        row.totalHoursWorked = null
      } else {
        row.voidMadeOrders = null
        row.voidMadeAmountUsd = null
        row.voidMadePctNetSalesUsd = null
        row.cashOverShortUsd = null
        row.totalDiscountsUsd = null
        row.highDiscountAmountUsd = null
        row.highDiscPctNetSalesUsd = null
        row.overtimeHours = null
        row.totalHoursWorked = null
      }

      if (pkIdx >= 0) {
        row.bozocoroNetSalesUsd = pk.cells[pkIdx * MEASURES_PK + 0] ?? null
        row.badOrderNetSalesUsd = pk.cells[pkIdx * MEASURES_PK + 1] ?? null
        row.zeroedOrders = pk.cells[pkIdx * MEASURES_PK + 2] ?? null
        row.cancelledOrderNetSalesUsd = pk.cells[pkIdx * MEASURES_PK + 3] ?? null
        row.refundedOrders = pk.cells[pkIdx * MEASURES_PK + 4] ?? null
        row.restaurantLevelEbitda = pk.cells[pkIdx * MEASURES_PK + 5] ?? null
        row.doorDashDeliveryPct = null
        row.aggregatorFeesCommissionsPct = null
        row.totalLaborOtHours = null
      } else {
        row.bozocoroNetSalesUsd = null
        row.badOrderNetSalesUsd = null
        row.zeroedOrders = null
        row.cancelledOrderNetSalesUsd = null
        row.refundedOrders = null
        row.restaurantLevelEbitda = null
        row.doorDashDeliveryPct = null
        row.aggregatorFeesCommissionsPct = null
        row.totalLaborOtHours = null
      }

      if (offersIdx >= 0) {
        row.offerDiscountAmountUsd = offers.cells[offersIdx * MEASURES_OFFERS + 0] ?? null
        row.averageDiscountUsd = offers.cells[offersIdx * MEASURES_OFFERS + 1] ?? null
        row.redeemedCount = offers.cells[offersIdx * MEASURES_OFFERS + 2] ?? null
        row.grossMarginPerOrderUsd = offers.cells[offersIdx * MEASURES_OFFERS + 3] ?? null
      } else {
        row.offerDiscountAmountUsd = row.averageDiscountUsd = row.redeemedCount = row.grossMarginPerOrderUsd = null
      }

      return row
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
