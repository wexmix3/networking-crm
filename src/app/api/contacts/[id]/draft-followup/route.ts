import { NextResponse } from 'next/server'
import { createRouteSupabaseClient } from '@/lib/supabase-server'
import { createMessageWithRetry } from '@/lib/ai-retry'

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createRouteSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: contact }, { data: interactions }] = await Promise.all([
    supabase.from('contacts_with_staleness').select('*').eq('id', id).maybeSingle(),
    supabase.from('interactions').select('*').eq('contact_id', id).order('interaction_date', { ascending: false }).limit(5),
  ])

  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const interactionSummary = interactions?.length
    ? interactions.map((i: { type: string; interaction_date: string; note?: string }) =>
        `- ${i.type} on ${i.interaction_date}${i.note ? `: ${i.note}` : ''}`
      ).join('\n')
    : 'No previous interactions recorded.'

  const prompt = `You are helping someone write a professional networking follow-up message.

Contact: ${contact.name}
${contact.role ? `Role: ${contact.role}` : ''}
${contact.company ? `Company: ${contact.company}` : ''}
${contact.notes ? `Notes: ${contact.notes}` : ''}

Recent interactions:
${interactionSummary}

Write a short, warm, professional follow-up message (2-3 sentences max). Be genuine and specific to their context. Don't be sycophantic. Start with "Hi ${contact.name.split(' ')[0]}," and end with a soft call to action like grabbing a quick call or catching up. Return only the message text, no subject line.`

  const response = await createMessageWithRetry({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const draft = response.content[0].type === 'text' ? response.content[0].text : ''
  return NextResponse.json({ draft })
}