'use client'

import { useState, useEffect, useMemo } from 'react'

interface SMGComment {
  id: string
  comment_id: string
  store_id: string
  comment_date: string | null
  survey_type: string | null
  category: string | null
  comment_text: string | null
  scraped_at: string
}

interface SMGCommentsProps {
  comments?: any[]
}

const STORES = ['All', '002021', '002081', '002259', '002292', '002481', '003011']

// Helper function to check if text looks like CSS/HTML code (client-side backup filter)
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

export default function SMGComments({ comments: initialComments = [] }: SMGCommentsProps) {
  const [selectedStore, setSelectedStore] = useState<string>('All')
  const [comments, setComments] = useState<SMGComment[]>(initialComments || [])
  const [loading, setLoading] = useState<boolean>(true)

  // Fetch comments on mount
  useEffect(() => {
    async function fetchComments() {
      setLoading(true)
      try {
        const res = await fetch('/api/smg-comments', { cache: 'no-store' })
        if (res.ok) {
          const json = await res.json()
          const fetchedComments = json.data || []
          
          // Client-side backup filter: remove CSS/HTML code and empty comments
          const filtered = fetchedComments.filter((comment: SMGComment) => {
            // Skip if no comment text or empty
            if (!comment.comment_text || comment.comment_text.trim().length === 0) {
              return false
            }
            
            // Skip if looks like CSS/HTML code
            if (isCSSOrHTMLCode(comment.comment_text)) {
              return false
            }
            
            return true
          })
          
          setComments(filtered)
        }
      } catch (error) {
        console.error('Error fetching comments:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchComments()
  }, [])

  // Filter by store
  const filtered = useMemo(() => {
    return selectedStore === 'All'
      ? comments
      : comments.filter(c => c.store_id === selectedStore)
  }, [comments, selectedStore])

  // Group by date and sort dates descending (most recent first)
  const grouped = useMemo(() => {
    const groupedObj = filtered.reduce((acc, comment) => {
      const date = comment.comment_date || 'Unknown'
      if (!acc[date]) acc[date] = []
      acc[date].push(comment)
      return acc
    }, {} as Record<string, SMGComment[]>)
    
    // Sort dates descending (most recent first)
    const sortedEntries = Object.entries(groupedObj).sort(([dateA], [dateB]) => {
      if (dateA === 'Unknown') return 1
      if (dateB === 'Unknown') return -1
      return dateB.localeCompare(dateA) // Descending order
    })
    
    return Object.fromEntries(sortedEntries)
  }, [filtered])

  // Get border color based on category
  const getBorderColor = (category: string | null) => {
    if (!category) return '#8E8E93'
    if (category.toLowerCase().includes('compliment')) return '#34C759'
    if (category.toLowerCase().includes('complaint')) return '#FF3B30'
    return '#8E8E93'
  }

  // Get badge background color
  const getBadgeColor = (category: string | null) => {
    if (!category) return '#666'
    if (category.toLowerCase().includes('compliment')) return '#34C759'
    if (category.toLowerCase().includes('complaint')) return '#FF3B30'
    return '#666'
  }

  // Format date for display (convert YYYY-MM-DD to M/D/YYYY)
  const formatDate = (dateStr: string) => {
    if (dateStr === 'Unknown') return 'Unknown'
    try {
      const [year, month, day] = dateStr.split('-')
      return `${parseInt(month)}/${parseInt(day)}/${year}`
    } catch {
      return dateStr
    }
  }

  return (
    <div style={{ 
      marginTop: 40,
      position: 'relative',
      zIndex: 1, // Ensure it's below modal (modal is z-index 9999)
      pointerEvents: 'auto' // Ensure it's interactive
    }}>
      {/* Section Title */}
      <div style={{ 
        fontFamily: "'Inter', sans-serif", 
        fontWeight: 700, 
        fontSize: 20, 
        marginBottom: 16, 
        color: 'var(--text-primary)' 
      }}>
        What Are People Saying?
      </div>

      {/* Store Filter Pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {STORES.map(store => (
          <button
            key={store}
            onClick={() => setSelectedStore(store)}
            style={{
              background: selectedStore === store ? '#E8572A' : '#2a2a2a',
              color: selectedStore === store ? 'white' : '#999',
              border: 'none',
              borderRadius: 20,
              padding: '6px 16px',
              fontSize: 13,
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (selectedStore !== store) {
                e.currentTarget.style.background = '#3a3a3a'
              }
            }}
            onMouseLeave={(e) => {
              if (selectedStore !== store) {
                e.currentTarget.style.background = '#2a2a2a'
              }
            }}
          >
            {store}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ 
          color: '#666', 
          textAlign: 'center', 
          padding: '40px',
          fontFamily: "'Inter', sans-serif",
          fontSize: 14
        }}>
          Loading comments...
        </div>
      )}

      {/* Comments by Date */}
      {!loading && Object.keys(grouped).length === 0 && (
        <div style={{ color: '#666', textAlign: 'center', padding: '40px', fontFamily: "'Inter', sans-serif" }}>
          No comments found for this store
        </div>
      )}

      {!loading && Object.keys(grouped).length > 0 && (
        Object.entries(grouped).map(([date, dateComments]) => (
          <div key={date}>
            {/* Date Header */}
            <div style={{
              background: '#1a1a1a',
              padding: '8px 16px',
              borderRadius: 8,
              color: '#999',
              fontWeight: 600,
              fontSize: 13,
              fontFamily: "'Inter', sans-serif",
              margin: '16px 0 8px 0'
            }}>
              {formatDate(date)}
            </div>

            {/* Comments for this date */}
            {dateComments.map((comment) => {
              // Clean comment text - remove "View More", "View Less", "Topics:" and everything after
              let commentText = comment.comment_text || ''
              
              // Remove everything from "View More" onwards (case insensitive)
              const viewMoreMatch = commentText.match(/View\s*More/i)
              if (viewMoreMatch && viewMoreMatch.index !== undefined) {
                commentText = commentText.substring(0, viewMoreMatch.index).trim()
              }
              
              // Remove "View Less" if it appears
              commentText = commentText.replace(/View\s*Less/gi, '').trim()
              
              // Remove "Topics:" and everything after it (case insensitive)
              const topicsMatch = commentText.match(/Topics\s*:/i)
              if (topicsMatch && topicsMatch.index !== undefined) {
                commentText = commentText.substring(0, topicsMatch.index).trim()
              }

              // Skip if comment text is empty (backup check)
              if (!commentText || commentText.trim().length === 0) {
                return null
              }

              return (
                <div
                  key={comment.id}
                  style={{
                    background: '#1e1e1e',
                    borderRadius: 10,
                    padding: '14px 16px',
                    marginBottom: 8,
                    borderLeft: `3px solid ${getBorderColor(comment.category)}`,
                  }}
                >
                  {/* Row 1: Store ID and Survey Type */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: 700,
                      fontSize: 14,
                      color: 'var(--text-primary)'
                    }}>
                      Store {comment.store_id}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: '#999',
                      fontFamily: "'Inter', sans-serif"
                    }}>
                      {comment.survey_type || '—'}
                    </div>
                  </div>

                  {/* Row 2: Category Badge */}
                  {comment.category && (
                    <div style={{ marginBottom: 10 }}>
                      <span style={{
                        background: getBadgeColor(comment.category),
                        borderRadius: 12, // Pill shape
                        padding: '4px 12px',
                        fontSize: 11,
                        color: 'white',
                        fontWeight: 600,
                        fontFamily: "'Inter', sans-serif",
                        display: 'inline-block',
                      }}>
                        {comment.category}
                      </span>
                    </div>
                  )}

                  {/* Row 3: Comment Text */}
                  <div style={{
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: 'var(--text-primary)',
                    fontFamily: "'Inter', sans-serif",
                  }}>
                    {commentText}
                  </div>
                </div>
              )
            })}
          </div>
        ))
      )}
    </div>
  )
}

