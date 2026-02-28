import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/db'

// Helper function to check if text looks like CSS/HTML code
function isCSSOrHTMLCode(text: string | null): boolean {
  if (!text) return false
  const cssHtmlPatterns = [
    /\{/,
    /color\s*:/,
    /!important/,
    /--green/,
    /--[a-z-]+:/,
    /background\s*:/,
    /font-size\s*:/,
    /margin\s*:/,
    /padding\s*:/,
    /<style/,
    /<\/style>/,
    /\.css/,
    /#[0-9a-fA-F]{3,6}/,
    /rgba?\(/,
    /@media/,
    /@keyframes/,
  ]
  
  return cssHtmlPatterns.some(pattern => pattern.test(text))
}

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdminClient()
    const { data: comments, error } = await supabaseAdmin
      .from('smg_comments')
      .select('*')
      .order('comment_date', { ascending: false })
      .limit(100) // Get more to filter, then return top 20

    if (error) {
      console.error('Error fetching SMG comments:', error)
      return NextResponse.json({
        success: false,
        error: error.message,
        data: []
      }, { status: 500 })
    }

    // Filter out CSS/HTML code and empty comments
    const filtered = (comments || []).filter(comment => {
      // Skip if no comment text
      if (!comment.comment_text || comment.comment_text.trim().length === 0) {
        return false
      }
      
      // Skip if looks like CSS/HTML code
      if (isCSSOrHTMLCode(comment.comment_text)) {
        return false
      }
      
      return true
    })

    // Return top 20 most recent after filtering
    return NextResponse.json({
      success: true,
      data: filtered.slice(0, 20)
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Error in SMG comments API:', error)
    return NextResponse.json(
      { success: false, error: msg, data: [] },
      { status: 500 }
    )
  }
}
