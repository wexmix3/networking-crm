import { NextResponse } from 'next/server'
import { createRouteSupabaseClient } from '@/lib/supabase-server'
import { tasks } from '@trigger.dev/sdk/v3'

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createRouteSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: contact } = await supabase
    .from('crm_contacts')
    .select('id, name, company')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await supabase
    .from('crm_contacts')
    .update({ enrichment_status: 'pending' })
    .eq('id', id)

  await tasks.trigger('enrich-contact', {
    contactId: contact.id,
    name: contact.name,
    company: contact.company ?? null,
  })

  return NextResponse.json({ ok: true })
}
