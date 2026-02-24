import pdfParse from 'pdf-parse'

export interface ParsedMetrics {
  store_number: string
  date_start: string
  date_end: string
  net_sales: number
  labor_pct: number
  food_cost_pct: number
  flm_pct: number
  cash_short: number
  doordash_sales: number
  ubereats_sales: number
}

/**
 * Extracts key metrics from Papa Johns daily operating report PDF
 * Uses exact regex patterns to match PDF text format
 */
export async function parsePapaJohnsPDF(pdfBuffer: Buffer): Promise<ParsedMetrics> {
  console.log('=== PDF PARSER: Starting parse ===')
  console.log('Buffer size:', pdfBuffer.length, 'bytes')
  console.log('Buffer type:', Buffer.isBuffer(pdfBuffer) ? 'Buffer' : typeof pdfBuffer)

  let data: any
  let text: string

  try {
    console.log('=== PDF PARSER: Calling pdfParse ===')
    data = await pdfParse(pdfBuffer)
    text = data.text
    console.log('=== PDF PARSER: pdfParse completed ===')
    console.log('Text length:', text.length, 'characters')
  } catch (parseError: any) {
    console.error('=== PDF PARSER: pdfParse ERROR ===')
    console.error('Error message:', parseError.message)
    console.error('Error stack:', parseError.stack)
    throw new Error(`Failed to parse PDF: ${parseError.message}`)
  }

  // Debug: Log PDF text sample
  console.log('=== PDF PARSER: PDF Text Sample (first 300 chars) ===')
  console.log(text.substring(0, 300))
  console.log('=== PDF PARSER: PDF Text Sample (last 300 chars) ===')
  console.log(text.substring(Math.max(0, text.length - 300)))

  // Define exact regex patterns based on actual PDF format
  const patterns = {
    store_number: /PAPA JOHNS PIZZA - RESTAURANT\s+(\d+)/i,
    net_sales: /Net Sales\s*:\s*([\d,]+\.?\d*)/i,
    labor_pct: /Labor\s*%\s*:\s*([\d.]+)/i,
    food_cost_pct: /Actual\s*%\s*:\s*([\d.]+)/i,
    flm_pct: /F\.L\.M\s*%\s*:\s*([\d.]+)/i,
    cash_short: /Cash Over\s*:\s*([\d,]+\.?\d*)/i, // Note: PDF says "Cash Over" but we store in cash_short field
    doordash_sales: /Doordash\s*:\s*([\d,]+\.?\d*)/i,
    ubereats_sales: /Uber Eats\s*:\s*([\d,]+\.?\d*)/i,
    date_start: /(\d{2}\/\d{2}\/\d{4})\s*-\s*\d{2}\/\d{2}\/\d{4}/i,
    date_end: /\d{2}\/\d{2}\/\d{4}\s*-\s*(\d{2}\/\d{2}\/\d{4})/i,
  }

  // Debug: Log regex match results
  console.log('=== PDF PARSER: Regex Results ===')
  const matches: Record<string, string | null> = {}
  Object.entries(patterns).forEach(([key, pattern]) => {
    const match = text.match(pattern)
    const value = match ? match[1] : null
    matches[key] = value
    console.log(`${key}:`, value || 'NOT FOUND')
  })

  // Extract store number: PAPA JOHNS PIZZA - RESTAURANT 2081
  console.log('=== PDF PARSER: Searching for store number ===')
  const storeNumberMatch = text.match(patterns.store_number)
  console.log('Store number match (PAPA JOHNS pattern):', storeNumberMatch)
  
  let store_number: string
  
  if (storeNumberMatch) {
    store_number = storeNumberMatch[1]
    console.log('=== PDF PARSER: Store number found ===', store_number)
  } else {
    // Fallback: try old pattern
    console.log('=== PDF PARSER: Trying fallback store number pattern ===')
    const fallbackMatch = text.match(/RESTAURANT\s+(\d+)/i)
    console.log('Store number match (fallback):', fallbackMatch)
    
    if (!fallbackMatch) {
      console.error('=== PDF PARSER: Store number not found ===')
      console.error('PDF text sample around "RESTAURANT":', text.match(/RESTAURANT[\s\S]{0,100}/i)?.[0])
      throw new Error('Could not find store number in PDF. Expected "PAPA JOHNS PIZZA - RESTAURANT 2081" or "RESTAURANT 2081"')
    }
    console.warn('=== PDF PARSER: Using fallback store number pattern ===')
    store_number = fallbackMatch[1]
  }

  // Extract date range: 01/08/2025 - 02/08/2025
  const dateStartMatch = text.match(patterns.date_start)
  const dateEndMatch = text.match(patterns.date_end)
  
  if (!dateStartMatch || !dateEndMatch) {
    // Fallback: try alternative date pattern
    const fallbackDateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/i)
    if (!fallbackDateMatch) {
      console.error('=== PDF PARSER: Date range not found ===')
      throw new Error('Could not find date range in PDF')
    }
    console.warn('=== PDF PARSER: Using fallback date pattern ===')
  }

  // Convert MM/DD/YYYY to YYYY-MM-DD
  const convertDate = (dateStr: string) => {
    const [month, day, year] = dateStr.split('/')
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const date_start = dateStartMatch
    ? convertDate(dateStartMatch[1])
    : convertDate(text.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*\d{2}\/\d{2}\/\d{4}/i)?.[1] || '')
  const date_end = dateEndMatch
    ? convertDate(dateEndMatch[1])
    : convertDate(text.match(/\d{2}\/\d{2}\/\d{4}\s*-\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] || '')

  // Extract Net Sales: Net Sales : 74261.78
  const netSalesMatch = text.match(patterns.net_sales)
  const net_sales = netSalesMatch ? parseFloat(netSalesMatch[1].replace(/,/g, '')) : 0

  // Extract Labor %: Labor % : 23.59
  const laborMatch = text.match(patterns.labor_pct)
  const labor_pct = laborMatch ? parseFloat(laborMatch[1]) : 0

  // Extract Food Cost %: Actual % : 22.52
  const foodCostMatch = text.match(patterns.food_cost_pct)
  const food_cost_pct = foodCostMatch ? parseFloat(foodCostMatch[1]) : 0

  // Extract FLM %: F.L.M % : 46.10
  const flmMatch = text.match(patterns.flm_pct)
  const flm_pct = flmMatch ? parseFloat(flmMatch[1]) : 0

  // Extract Cash Over/Short: Cash Over : 8.12
  // Note: PDF says "Cash Over" but we store in cash_short field (positive = over, negative = short)
  const cashOverMatch = text.match(patterns.cash_short)
  let cash_short = 0
  if (cashOverMatch) {
    cash_short = parseFloat(cashOverMatch[1].replace(/,/g, ''))
  } else {
    // Fallback: try "Cash Short" pattern
    const cashShortMatch = text.match(/Cash Short\s*:\s*([\d,]+\.?\d*)/i) || text.match(/Total Cash Short\s*:\s*([\d,]+\.?\d*)/i)
    if (cashShortMatch) {
      cash_short = -Math.abs(parseFloat(cashShortMatch[1].replace(/,/g, ''))) // Negative for short
    }
  }

  // Extract DoorDash Sales: Doordash : 13373.60
  const doordashMatch = text.match(patterns.doordash_sales)
  const doordash_sales = doordashMatch ? parseFloat(doordashMatch[1].replace(/,/g, '')) : 0

  // Extract Uber Eats Sales: Uber Eats : 8896.05
  const ubereatsMatch = text.match(patterns.ubereats_sales)
  const ubereats_sales = ubereatsMatch ? parseFloat(ubereatsMatch[1].replace(/,/g, '')) : 0

  const result = {
    store_number,
    date_start,
    date_end,
    net_sales,
    labor_pct,
    food_cost_pct,
    flm_pct,
    cash_short,
    doordash_sales,
    ubereats_sales,
  }

  console.log('=== PDF PARSER: Final parsed result ===')
  console.log(JSON.stringify(result, null, 2))

  return result
}
