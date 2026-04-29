import { NextResponse } from 'next/server'
import { createRouteSupabaseClient } from '@/lib/supabase-server'
import { tasks } from '@trigger.dev/sdk/v3'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createRouteSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('crm_contacts_with_staleness')
    .select('*')
    .eq('user_id', user.id)
    .order('days_since_contact', { ascending: false, nullsFirst: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = await createRouteSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { enrich, ...body } = await req.json()

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