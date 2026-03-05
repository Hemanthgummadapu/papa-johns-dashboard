import { NextRequest, NextResponse } from 'next/server'
import { AI_QUESTIONS } from '@/lib/ai/questions'
import { fetchDataForQuestion } from '@/lib/ai/fetch-data-for-question'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const questionId = body.questionId as string
    const timePeriod = (body.timePeriod as string) || 'current_period'

    const question = AI_QUESTIONS.find((q) => q.id === questionId)
    if (!question) {
      return NextResponse.json({ error: 'Unknown questionId' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured. Add it to .env.local.' },
        { status: 500 }
      )
    }

    const data = await fetchDataForQuestion([...question.dataSources], timePeriod)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 800,
        system: `You are an operations analyst for Papa Johns franchise stores.
You have access to audit data, sales data, guest experience scores, and offers data.
Be specific, use names and numbers from the data provided.
Format responses clearly with sections and bullet points.
Be direct and actionable — no fluff.`,
        messages: [
          {
            role: 'user',
            content: `${question.prompt}

DATA:
${JSON.stringify(data, null, 2)}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return NextResponse.json(
        { error: `Claude API error: ${response.status} ${errText}` },
        { status: 502 }
      )
    }

    const result = (await response.json()) as { content?: Array<{ type: string; text?: string }> }
    const text = result.content?.[0]?.type === 'text' ? result.content[0].text : ''

    return NextResponse.json({
      analysis: text || 'No response generated.',
      questionId,
      timePeriod,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
