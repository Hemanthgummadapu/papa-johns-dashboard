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

    const imap = new Imap({
      user,
      password,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    })

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, _box) => {
        if (err) {
          imap.end()
          return reject(err)
        }

        imap.search(['UNSEEN'], (err, results) => {
          if (err) {
            imap.end()
            return reject(err)
          }

          if (!results || results.length === 0) {
            imap.end()
            return resolve([])
          }

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
                  if (processedCount >= results.length) {
                    imap.setFlags(results, ['\\Seen'], () => {
                      imap.end()
                    })
                    resolve(emailsWithPDFs)
                  }
                  return
                }

                // Find ALL PDF attachments in this email
                const pdfAttachments = parsed.attachments?.filter(
                  (a) =>
                    a.contentType === 'application/pdf' ||
                    a.filename?.toLowerCase().endsWith('.pdf')
                ) || []

                // Process each PDF in this email
                for (const pdfAttachment of pdfAttachments) {
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
                }

                if (processedCount >= results.length) {
                  imap.setFlags(results, ['\\Seen'], () => {
                    imap.end()
                  })
                  
                  resolve(emailsWithPDFs)
                }
              })
            })
          })

          fetch.once('error', (err) => {
            imap.end()
            reject(err)
          })
        })
      })
    })

    imap.once('error', (err) => {
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
