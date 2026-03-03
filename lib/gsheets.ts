import { google } from 'googleapis'

type ReportRow = {
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

let authInstance: any = null

function getAuth() {
  if (!authInstance) {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
    const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY
    if (!clientEmail || !rawPrivateKey) {
      return null
    }

    const privateKey = rawPrivateKey
      ?.replace(/\\n/g, '\n')
      ?.replace(/^["']|["']$/g, '')
      ?.trim()

    authInstance = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })
  }
  return authInstance
}

export async function appendToSheet(data: ReportRow): Promise<{ success: boolean; rowNumber?: number; error?: string }> {
  try {
    const auth = getAuth()
    if (!auth) {
      return { success: false, error: 'Google Sheets credentials not configured' }
    }

    const sheetId = process.env.GOOGLE_SHEET_ID
    if (!sheetId) {
      return { success: false, error: 'Google Sheet ID not configured' }
    }

    const sheets = google.sheets({ version: 'v4', auth })

    // Try multiple sheet names in order of likelihood
    const sheetNames = ['Sheet1', 'Reports', 'Sheet 1']
    let rangeResponse: any = null
    let sheetName = 'Sheet1'
    let currentRowCount = 1

    for (const name of sheetNames) {
      try {
        rangeResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `${name}!A:A`,
        })
        currentRowCount = rangeResponse.data.values?.length || 1
        sheetName = name
        break
      } catch (_err: any) {
        continue
      }
    }

    if (!rangeResponse) {
      try {
        rangeResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: 'A:A',
        })
        currentRowCount = rangeResponse.data.values?.length || 1
        sheetName = 'Sheet1'
      } catch (err: any) {
        throw new Error(`Cannot access spreadsheet. Make sure the sheet is shared with the service account. Error: ${err.message}`)
      }
    }

    const newRowNumber = currentRowCount + 1

    const rowData = [
      new Date().toISOString(), // A: Timestamp
      data.store_number, // B: Store
      data.date_start, // C: Period Start
      data.date_end, // D: Period End
      data.net_sales, // E: Net Sales
      data.labor_pct, // F: Labor %
      data.food_cost_pct, // G: Food Cost %
      data.flm_pct, // H: FLM %
      data.cash_short, // I: Cash Short
      data.doordash_sales, // J: DoorDash
      data.ubereats_sales, // K: Uber Eats
    ]

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${sheetName}!A:K`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData],
      },
    })

    return { success: true, rowNumber: newRowNumber }
  } catch (error: any) {
    // Provide more helpful error messages
    let errorMessage = error?.message || 'Failed to append to sheet'
    if (error?.code === 403) {
      errorMessage = 'Permission denied. Make sure the Google Sheet is shared with the service account email.'
    } else if (error?.code === 404) {
      errorMessage = 'Sheet not found. Check that GOOGLE_SHEET_ID is correct.'
    }
    
    return { success: false, error: errorMessage }
  }
}

export function getSheetUrl(): string | null {
  const sheetId = process.env.GOOGLE_SHEET_ID
  if (!sheetId) return null
  return `https://docs.google.com/spreadsheets/d/${sheetId}`
}

