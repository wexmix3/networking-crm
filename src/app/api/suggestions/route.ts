import { NextResponse } from 'next/server'
import { createRouteSupabaseClient } from '@/lib/supabase-server'
import { createMessageWithRetry } from '@/lib/ai-retry'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createRouteSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: contacts } = await supabase
    .from('crm_contacts_with_staleness')
    .select('id, name, company, role, days_since_contact, interaction_count, last_interaction_date')
    .eq('user_id', user.id)

  if (!contacts?.length) return NextResponse.json({ suggestions: [] })

  // Exclude anyone contacted in last 7 days
  const candidates = contacts.filter((c) => !c.days_since_contact || c.days_since_contact > 7)
  if (!candidates.length) return NextResponse.json({ suggestions: [] })

  const contactList = candidates.map((c) =>
    `ID: ${c.id} | Name: ${c.name} | Company: ${c.company ?? 'Unknown'} | Role: ${c.role ?? 'Unknown'} | Days since last contact: ${c.days_since_contact ?? 'Never contacted'} | Total interactions: ${c.interaction_count ?? 0}`
  ).join('\n')

  const response = await createMessageWithRetry({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `You are a networking advisor. Given this list of professional contacts, pick the 5 most important people to reach out to this week. Prioritize people who haven't been contacted recently, have high relationship potential (seniority/company), or are overdue for a check-in.

Contacts:
${contactList}

Return ONLY a JSON array (no markdown, no explanation):
[{"contactId":"<id>","reason":"<one short sentence, max 10 words>"},...]

Pick exactly 5 (or fewer if fewer candidates exist).`,
    }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '[]'
  const match = raw.match(/\[[\s\S]*\]/)
  const suggestions = match ? JSON.parse(match[0]) : []

  return NextResponse.json({ suggestions })
}
