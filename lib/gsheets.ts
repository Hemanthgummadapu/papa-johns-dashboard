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
    
    console.log('=== SHEETS: Auth Setup ===')
    console.log('Client email present:', !!clientEmail)
    console.log('Private key present:', !!rawPrivateKey)
    console.log('Private key length:', rawPrivateKey?.length || 0)
    
    if (!clientEmail || !rawPrivateKey) {
      console.error('=== SHEETS: Missing credentials ===')
      return null
    }

    // Fix private key parsing - handle escaped newlines and quotes
    const privateKey = rawPrivateKey
      ?.replace(/\\n/g, '\n')  // Fix escaped newlines
      ?.replace(/^["']|["']$/g, '') // Remove surrounding quotes
      ?.trim()

    console.log('Private key after processing - starts with:', privateKey?.substring(0, 30))
    console.log('Private key after processing - ends with:', privateKey?.substring(privateKey.length - 30))

    authInstance = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })
    
    console.log('=== SHEETS: Auth instance created ===')
  }
  return authInstance
}

export async function appendToSheet(data: ReportRow): Promise<{ success: boolean; rowNumber?: number; error?: string }> {
  console.log('=== SHEETS: Starting write ===')
  console.log('Data to write:', JSON.stringify(data, null, 2))
  
  try {
    const auth = getAuth()
    if (!auth) {
      console.error('=== SHEETS: Auth failed - credentials not configured ===')
      return { success: false, error: 'Google Sheets credentials not configured' }
    }

    const sheetId = process.env.GOOGLE_SHEET_ID
    console.log('=== SHEETS: Sheet ID check ===')
    console.log('Sheet ID:', sheetId ? `${sheetId.substring(0, 10)}...` : 'NOT SET')
    
    if (!sheetId) {
      console.error('=== SHEETS: Sheet ID not configured ===')
      return { success: false, error: 'Google Sheet ID not configured' }
    }

    console.log('=== SHEETS: Creating client ===')
    const sheets = google.sheets({ version: 'v4', auth })
    console.log('=== SHEETS: Client created ===')

    // Try multiple sheet names in order of likelihood
    const sheetNames = ['Sheet1', 'Reports', 'Sheet 1']
    let rangeResponse: any = null
    let sheetName = 'Sheet1'
    let currentRowCount = 1

    for (const name of sheetNames) {
      try {
        console.log(`=== SHEETS: Trying to read range ${name}!A:A ===`)
        rangeResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `${name}!A:A`,
        })
        currentRowCount = rangeResponse.data.values?.length || 1
        sheetName = name
        console.log(`=== SHEETS: Successfully read ${name}, current rows: ${currentRowCount} ===`)
        break
      } catch (err: any) {
        console.warn(`=== SHEETS: Failed to read ${name}: ${err.message} ===`)
        continue
      }
    }

    if (!rangeResponse) {
      // If all sheet names failed, try without specifying sheet (defaults to first sheet)
      try {
        console.log('=== SHEETS: Trying default sheet ===')
        rangeResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: 'A:A',
        })
        currentRowCount = rangeResponse.data.values?.length || 1
        sheetName = 'Sheet1' // Default assumption
        console.log(`=== SHEETS: Successfully read default sheet, current rows: ${currentRowCount} ===`)
      } catch (err: any) {
        console.error('=== SHEETS: Failed to read any sheet ===', err.message)
        throw new Error(`Cannot access spreadsheet. Make sure the sheet is shared with the service account. Error: ${err.message}`)
      }
    }

    const newRowNumber = currentRowCount + 1
    console.log(`=== SHEETS: Appending to row ${newRowNumber} in sheet "${sheetName}" ===`)

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
    
    console.log('=== SHEETS: Row data:', rowData)

    const appendResult = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${sheetName}!A:K`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData],
      },
    })

    console.log('=== SHEETS: Write success ===')
    console.log('Updated range:', appendResult.data.updates?.updatedRange)
    console.log('Updated rows:', appendResult.data.updates?.updatedRows)
    console.log('New row number:', newRowNumber)

    return { success: true, rowNumber: newRowNumber }
  } catch (error: any) {
    console.error('=== SHEETS ERROR ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('Error code:', error.code)
    console.error('Full error:', error)
    
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

