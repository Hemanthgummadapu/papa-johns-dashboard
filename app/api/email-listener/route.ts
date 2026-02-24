import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/db'
import { appendToSheet, getSheetUrl } from '@/lib/gsheets'
import { parsePapaJohnsPDF } from '@/lib/pdf-parser'
import { fetchAllPDFsFromGmail } from '@/lib/gmail'

/**
 * Check if Supabase is configured
 */
function isSupabaseConfigured(): boolean {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
    return !!(url && service && url.length > 0 && service.length > 0)
  } catch {
    return false
  }
}

/**
 * POST /api/email-listener
 * 
 * Real Gmail integration:
 * 1. Connects to Gmail via IMAP
 * 2. Downloads PDF from unread email
 * 3. Parses PDF to extract metrics
 * 4. Writes to Google Sheets
 * 5. Marks email as read
 * 
 * Demo mode (simulateEmail: true):
 * Accepts PDF buffer or file for testing
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    const body = contentType.includes('application/json')
      ? await request.json().catch(() => ({}))
      : {}

    const { simulateEmail, checkGmail, pdfBuffer } = body

    // REAL GMAIL MODE: Check actual Gmail inbox
    if (checkGmail || (!simulateEmail && !contentType.includes('multipart'))) {
      console.log('=== EMAIL LISTENER: Connecting to Gmail ===')

      try {
        // Step 1: Get ALL PDFs from ALL unread emails in Gmail
        console.log('=== EMAIL LISTENER: Step 1 - Fetching ALL PDFs from Gmail ===')
        const emailsWithPDFs = await fetchAllPDFsFromGmail()

        if (!emailsWithPDFs || emailsWithPDFs.length === 0) {
          console.log('=== EMAIL LISTENER: No PDFs found in Gmail ===')
          return NextResponse.json({
            success: false,
            message: 'No unread emails with PDF attachments found',
            emailsProcessed: 0,
          })
        }

        console.log(`=== EMAIL LISTENER: Found ${emailsWithPDFs.length} PDF(s) in unread emails ===`)

        const useSupabase = isSupabaseConfigured()
        const processedResults: any[] = []
        let successCount = 0
        let errorCount = 0

        // Process each PDF
        for (let i = 0; i < emailsWithPDFs.length; i++) {
          const email = emailsWithPDFs[i]
          console.log(`=== EMAIL LISTENER: Processing PDF ${i + 1}/${emailsWithPDFs.length} ===`)
          console.log('Email subject:', email.subject)
          console.log('PDF filename:', email.filename)
          console.log('PDF size:', email.pdfBuffer.length, 'bytes')

          let parsedData: any = null
          let logEntry: any = null
          let sheetResult: any = null

          try {
            // Step 2: Parse the PDF
            console.log('=== EMAIL LISTENER: Step 2 - Parsing PDF ===')
            try {
              parsedData = await parsePapaJohnsPDF(email.pdfBuffer)
              console.log('=== EMAIL LISTENER: PDF parsed successfully ===')
              console.log('Parsed data:', JSON.stringify(parsedData, null, 2))

              if (!parsedData || !parsedData.store_number) {
                throw new Error('PDF parsing failed: Could not extract store number or other required fields')
              }
            } catch (parseError: any) {
              console.error('=== EMAIL LISTENER: PDF PARSE ERROR ===')
              console.error('Error message:', parseError.message)
              console.error('Error stack:', parseError.stack)
              errorCount++
              processedResults.push({
                emailSubject: email.subject,
                filename: email.filename,
                success: false,
                error: `PDF parsing failed: ${parseError.message}`,
                step: 'parsing',
              })
              continue // Skip to next PDF
            }

            // Create automation log entry
            if (useSupabase) {
              try {
                console.log('=== EMAIL LISTENER: Creating automation log entry ===')
                const supabaseAdmin = getSupabaseAdminClient()
                const { data, error } = await supabaseAdmin
                  .from('automation_log')
                  .insert({
                    store_number: parsedData.store_number,
                    date_start: parsedData.date_start,
                    date_end: parsedData.date_end,
                    source: 'email',
                    status: 'processing',
                    net_sales: parsedData.net_sales,
                  })
                  .select()
                  .single()

                if (!error) {
                  logEntry = data
                  console.log('=== EMAIL LISTENER: Log entry created ===', logEntry.id)
                } else {
                  console.warn('=== EMAIL LISTENER: Failed to create log entry ===', error)
                }
              } catch (err: any) {
                console.warn('=== EMAIL LISTENER: Log entry error ===', err.message)
              }
            }

            // Step 3: Write to Google Sheets
            console.log('=== EMAIL LISTENER: Step 3 - Writing to Google Sheets ===')
            try {
              sheetResult = await appendToSheet({
                store_number: parsedData.store_number,
                date_start: parsedData.date_start,
                date_end: parsedData.date_end,
                net_sales: parsedData.net_sales,
                labor_pct: parsedData.labor_pct,
                food_cost_pct: parsedData.food_cost_pct,
                flm_pct: parsedData.flm_pct,
                cash_short: parsedData.cash_short,
                doordash_sales: parsedData.doordash_sales,
                ubereats_sales: parsedData.ubereats_sales,
              })

              console.log('=== EMAIL LISTENER: Sheet write result ===', JSON.stringify(sheetResult, null, 2))
            } catch (sheetError: any) {
              console.error('=== EMAIL LISTENER: SHEET WRITE ERROR ===')
              console.error('Error message:', sheetError.message)
              console.error('Error stack:', sheetError.stack)
              sheetResult = { success: false, error: sheetError.message }
            }

            // Update log entry
            if (logEntry && useSupabase) {
              try {
                const supabaseAdmin = getSupabaseAdminClient()
                await supabaseAdmin
                  .from('automation_log')
                  .update({
                    status: sheetResult?.success ? 'success' : 'failed',
                    sheet_row: sheetResult?.rowNumber || null,
                    error_message: sheetResult?.error || null,
                  })
                  .eq('id', logEntry.id)
                console.log('=== EMAIL LISTENER: Log entry updated ===')
              } catch (err: any) {
                console.warn('=== EMAIL LISTENER: Failed to update log entry ===', err.message)
              }
            }

            if (sheetResult?.success) {
              successCount++
            } else {
              errorCount++
            }

            processedResults.push({
              emailSubject: email.subject,
              filename: email.filename,
              store_number: parsedData.store_number,
              success: sheetResult?.success || false,
              sheetRow: sheetResult?.rowNumber || null,
              error: sheetResult?.error || null,
              data: parsedData,
            })

            console.log(`=== EMAIL LISTENER: PDF ${i + 1}/${emailsWithPDFs.length} processed ===`)
          } catch (error: any) {
            console.error(`=== EMAIL LISTENER: Error processing PDF ${i + 1} ===`, error)
            errorCount++
            processedResults.push({
              emailSubject: email.subject,
              filename: email.filename,
              success: false,
              error: error.message || 'Unknown error',
              step: 'processing',
            })
          }
        }

        const response = {
          success: successCount > 0,
          message: `Processed ${emailsWithPDFs.length} PDF(s). ${successCount} succeeded, ${errorCount} failed.`,
          emailsProcessed: emailsWithPDFs.length,
          successCount,
          errorCount,
          processedResults,
          sheetUrl: getSheetUrl(),
        }

        console.log('=== EMAIL LISTENER: Returning response ===')
        console.log('Response:', JSON.stringify(response, null, 2))

        return NextResponse.json(response)
      } catch (gmailError: any) {
        console.error('=== EMAIL LISTENER: GMAIL ERROR ===')
        console.error('Error message:', gmailError.message)
        console.error('Error stack:', gmailError.stack)
        console.error('Error name:', gmailError.name)
        console.error('Full error object:', gmailError)
        
        return NextResponse.json(
          {
            success: false,
            error: `Failed to process Gmail: ${gmailError.message}`,
            message: 'Check your Gmail credentials in .env.local (GMAIL_USER, GMAIL_APP_PASSWORD)',
            details: gmailError.stack,
            step: 'gmail_connection',
          },
          { status: 500 }
        )
      }
    }

    // DEMO/SIMULATION MODE: Accept PDF file or buffer for testing
    if (simulateEmail) {
      let pdfBufferToParse: Buffer | null = null

      if (contentType.includes('multipart/form-data')) {
        // Handle PDF file upload
        const formData = await request.formData()
        const pdfFile = formData.get('pdf') as File

        if (!pdfFile) {
          return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 })
        }

        console.log('=== EMAIL LISTENER: Demo mode - PDF file upload ===')
        const arrayBuffer = await pdfFile.arrayBuffer()
        pdfBufferToParse = Buffer.from(arrayBuffer)
      } else if (pdfBuffer) {
        // Handle base64 PDF buffer
        console.log('=== EMAIL LISTENER: Demo mode - PDF buffer ===')
        pdfBufferToParse = Buffer.from(pdfBuffer, 'base64')
      } else {
        return NextResponse.json(
          { error: 'No PDF file or buffer provided for simulation' },
          { status: 400 }
        )
      }

      // Parse and process
      const parsedData = await parsePapaJohnsPDF(pdfBufferToParse)
      const sheetResult = await appendToSheet({
        store_number: parsedData.store_number,
        date_start: parsedData.date_start,
        date_end: parsedData.date_end,
        net_sales: parsedData.net_sales,
        labor_pct: parsedData.labor_pct,
        food_cost_pct: parsedData.food_cost_pct,
        flm_pct: parsedData.flm_pct,
        cash_short: parsedData.cash_short,
        doordash_sales: parsedData.doordash_sales,
        ubereats_sales: parsedData.ubereats_sales,
      })

      return NextResponse.json({
        success: true,
        message: `Demo: Processed Store ${parsedData.store_number} — Sheet updated at row ${sheetResult.rowNumber}`,
        sheetResult,
        data: parsedData,
      })
    }

    return NextResponse.json(
      { error: 'Invalid request. Use checkGmail: true or simulateEmail: true' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('=== EMAIL LISTENER: Error ===', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to process email listener request' },
      { status: 500 }
    )
  }
}
