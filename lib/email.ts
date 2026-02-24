// Email integration stub for Phase 2
// This will be implemented in Phase 2 with Gmail API

export interface EmailAttachment {
  filename: string
  content: Buffer
  contentType: string
}

export async function checkForNewReports(): Promise<EmailAttachment[]> {
  // TODO: Implement Gmail API integration in Phase 2
  // For now, return empty array
  return []
}

export async function markEmailAsProcessed(emailId: string): Promise<void> {
  // TODO: Implement in Phase 2
}

