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
    supabase.from('crm_contacts_with_staleness').select('*').eq('id', id).maybeSingle(),
    supabase.from('crm_interactions').select('*').eq('contact_id', id).order('interaction_date', { ascending: false }).limit(10),
  ])

  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const interactionSummary = interactions?.length
    ? interactions.map((i: { type: string; interaction_date: string; note?: string }) =>
        `- ${i.type} on ${i.interaction_date}${i.note ? `: ${i.note}` : ''}`
      ).join('\n')
    : 'No previous interactions recorded.'

  const keyFacts = (contact.key_facts as string[] | null)?.length
    ? (contact.key_facts as string[]).map((f: string) => `- ${f}`).join('\n')
    : 'None recorded.'

  const prompt = `You are helping someone prepare for a professional meeting or call.

Contact: ${contact.name}
${contact.role ? `Role: ${contact.role}` : ''}
${contact.company ? `Company: ${contact.company}` : ''}
${contact.notes ? `Background notes: ${contact.notes}` : ''}

Key facts about this person:
${keyFacts}

Interaction history (most recent first):
${interactionSummary}

Generate a concise meeting prep brief with exactly this JSON structure:
{
  "background": "2-3 sentence summary of who this person is and your relationship",
  "talking_points": ["point 1", "point 2", "point 3"],
  "watch_outs": ["thing to be aware of or avoid"],
  "opener": "A natural conversation opener for this meeting (1 sentence)"
}

Return only valid JSON, no markdown or preamble.`

  const response = await createMessageWithRetry({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })

  try {
    const brief = JSON.parse(match[0])
    return NextResponse.json(brief)
  } catch {
    return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
  }
}
