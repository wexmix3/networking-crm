import { NextResponse } from 'next/server'
import { createRouteSupabaseClient } from '@/lib/supabase-server'
import { tasks } from '@trigger.dev/sdk/v3'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

export async function GET(req: Request) {
  const supabase = await createRouteSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10))
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data, error, count } = await supabase
    .from('crm_contacts_with_staleness')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('days_since_contact', { ascending: false, nullsFirst: true })
    .range(from, to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contacts: data, total: count ?? 0, page, pageSize: PAGE_SIZE })
}

export async function POST(req: Request) {
  const supabase = await createRouteSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { enrich, ...body } = await req.json()

  if (body.email) {
    const { data: existing } = await supabase
      .from('crm_contacts')
      .select('id, name')
      .eq('user_id', user.id)
      .eq('email', body.email)
      .maybeSingle()
    if (existing) {
      return NextResponse.json(
        { error: 'A contact with this email already exists', existingId: existing.id, existingName: existing.name },
        { status: 409 },
      )
    }
  }

  const { data, error } = await supabase
    .from('crm_contacts')
    .insert({
      ...body,
      user_id: user.id,
      enrichment_status: enrich ? 'pending' : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (enrich && data) {
    await tasks.trigger('enrich-contact', {
      contactId: data.id,
      name: data.name,
      company: data.company ?? null,
    })
  }

  return NextResponse.json(data, { status: 201 })
}