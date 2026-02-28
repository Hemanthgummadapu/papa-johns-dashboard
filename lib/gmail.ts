import Imap from 'imap'
import { simpleParser } from 'mailparser'

export interface EmailWithPDF {
  subject: string
  from: string
  date: string
  pdfBuffer: Buffer
  filename: string
}

/**
 * Fetch ALL PDF attachments from ALL unread emails in Gmail inbox
 * Returns array of emails with PDFs or empty array if none found
 */
export async function fetchAllPDFsFromGmail(): Promise<EmailWithPDF[]> {
  return new Promise((resolve, reject) => {
    const user = process.env.GMAIL_USER
    const password = process.env.GMAIL_APP_PASSWORD

    if (!user || !password) {
      reject(new Error('Gmail credentials not configured (GMAIL_USER, GMAIL_APP_PASSWORD)'))
      return
    }

    console.log('=== GMAIL: Connecting to IMAP ===')
    console.log('User:', user)

    const imap = new Imap({
      user,
      password,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    })

    imap.once('ready', () => {
      console.log('=== GMAIL: IMAP connected ===')
      
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          console.error('=== GMAIL: Error opening inbox ===', err)
          imap.end()
          return reject(err)
        }

        console.log('=== GMAIL: Searching for ALL unread emails ===')
        
        // Search for ALL unread emails (no subject filter)
        imap.search(['UNSEEN'], (err, results) => {
          if (err) {
            console.error('=== GMAIL: Search error ===', err)
            imap.end()
            return reject(err)
          }

          if (!results || results.length === 0) {
            console.log('=== GMAIL: No unread emails found ===')
            imap.end()
            return resolve([])
          }

          console.log(`=== GMAIL: Found ${results.length} unread email(s) ===`)

          // Fetch ALL unread emails
          const fetch = imap.fetch(results, { 
            bodies: '',
            struct: true,
            markSeen: false, // Don't mark as read yet
          })

          const emailsWithPDFs: EmailWithPDF[] = []
          let processedCount = 0

          fetch.on('message', (msg) => {
            msg.on('body', (stream) => {
              simpleParser(stream as any, async (err, parsed) => {
                processedCount++

                if (err) {
                  console.error('=== GMAIL: Error parsing email ===', err)
                  if (processedCount >= results.length) {
                    // Mark emails as read after processing all
                    imap.setFlags(results, ['\\Seen'], (err) => {
                      if (err) console.warn('=== GMAIL: Error marking emails as read ===', err)
                      imap.end()
                    })
                    resolve(emailsWithPDFs)
                  }
                  return
                }

                console.log('=== GMAIL: Checking email ===')
                console.log('Subject:', parsed.subject)
                console.log('From:', parsed.from?.text)
                console.log('Date:', parsed.date)
                console.log('Attachments count:', parsed.attachments?.length || 0)

                // Find ALL PDF attachments in this email
                const pdfAttachments = parsed.attachments?.filter(
                  (a) =>
                    a.contentType === 'application/pdf' ||
                    a.filename?.toLowerCase().endsWith('.pdf')
                ) || []

                // Process each PDF in this email
                for (const pdfAttachment of pdfAttachments) {
                  console.log('=== GMAIL: Found PDF attachment ===')
                  console.log('Filename:', pdfAttachment.filename)
                  console.log('Size:', pdfAttachment.size, 'bytes')

                  // Get PDF buffer
                  let pdfBuffer: Buffer
                  if (Buffer.isBuffer(pdfAttachment.content)) {
                    pdfBuffer = pdfAttachment.content
                  } else if (typeof pdfAttachment.content === 'string') {
                    pdfBuffer = Buffer.from(pdfAttachment.content, 'base64')
                  } else {
                    pdfBuffer = Buffer.from(pdfAttachment.content as any)
                  }

                  emailsWithPDFs.push({
                    subject: parsed.subject || '',
                    from: parsed.from?.text || '',
                    date: parsed.date?.toISOString() || new Date().toISOString(),
                    pdfBuffer,
                    filename: pdfAttachment.filename || 'report.pdf',
                  })

                  console.log(`=== GMAIL: Added PDF to list (total: ${emailsWithPDFs.length}) ===`)
                }

                // Check if we've processed all emails
                if (processedCount >= results.length) {
                  console.log(`=== GMAIL: Processed all emails. Found ${emailsWithPDFs.length} PDF(s) ===`)
                  
                  // Mark emails as read after processing all
                  imap.setFlags(results, ['\\Seen'], (err) => {
                    if (err) {
                      console.warn('=== GMAIL: Error marking emails as read ===', err)
                    } else {
                      console.log('=== GMAIL: All emails marked as read ===')
                    }
                    imap.end()
                  })
                  
                  resolve(emailsWithPDFs)
                }
              })
            })
          })

          fetch.once('error', (err) => {
            console.error('=== GMAIL: Fetch error ===', err)
            imap.end()
            reject(err)
          })
        })
      })
    })

    imap.once('error', (err) => {
      console.error('=== GMAIL: IMAP connection error ===', err)
      reject(err)
    })

    imap.connect()
  })
}

/**
 * @deprecated Use fetchAllPDFsFromGmail() instead
 * Fetch PDF attachment from the first unread email (for backward compatibility)
 */
export async function fetchPDFFromGmail(): Promise<Buffer | null> {
  const emails = await fetchAllPDFsFromGmail()
  return emails.length > 0 ? emails[0].pdfBuffer : null
}
