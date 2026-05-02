import { NextResponse } from 'next/server'
import { createRouteSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/tags — returns all distinct tags + usage counts for the current user
export async function GET() {
  const supabase = await createRouteSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('crm_contacts')
    .select('tags')
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    for (const tag of row.tags ?? []) {
      counts[tag] = (counts[tag] ?? 0) + 1
    }
  }
  const tags = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, count }))

  return NextResponse.json({ tags })
}

// PATCH /api/tags — rename a tag across all contacts: { from, to }
// If `to` is empty string, the tag is deleted from all contacts
export async function PATCH(req: Request) {
  const supabase = await createRouteSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { from, to } = await req.json() as { from: string; to: string }
  if (!from) return NextResponse.json({ error: 'from is required' }, { status: 400 })

  // Fetch all contacts that have the old tag
  const { data: contacts, error: fetchErr } = await supabase
    .from('crm_contacts')
    .select('id, tags')
    .eq('user_id', user.id)
    .contains('tags', [from])

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

  // Update each contact's tags array
  const updates = (contacts ?? []).map((c) => {
    const newTags = (c.tags ?? [])
      .map((t: string) => t === from ? to : t)
      .filter(Boolean)
    return supabase.from('crm_contacts').update({ tags: newTags }).eq('id', c.id)
  })

  await Promise.all(updates)
  return NextResponse.json({ updated: updates.length })
}
