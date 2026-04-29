import { NextResponse } from 'next/server'
import { createRouteSupabaseClient } from '@/lib/supabase-server'
import { tasks } from '@trigger.dev/sdk/v3'

export const dynamic = 'force-dynamic'

interface LinkedInRow {
  'First Name'?: string
  'Last Name'?: string
  'Company'?: string
  'Position'?: string
  'Connected On'?: string
  'Email Address'?: string
  [key: string]: string | undefined
}

function parseCSV(text: string): LinkedInRow[] {
  const lines = text.split(/\r?\n/).filter(Boolean)
  // LinkedIn CSVs sometimes have note lines before headers
  const headerIdx = lines.findIndex((l) => l.includes('First Name') || l.includes('FirstName'))
  if (headerIdx === -1) return []

  const headers = lines[headerIdx].split(',').map((h) => h.replace(/^"|"$/g, '').trim())
  return lines.slice(headerIdx + 1).map((line) => {
    const values = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) ?? []
    const row: LinkedInRow = {}
    headers.forEach((h, i) => {
      row[h] = (values[i] ?? '').replace(/^"|"$/g, '').trim()
    })
    return row
  })
}

const APOLLO_FREE_TIER_LIMIT = 50

export async function POST(req: Request) {
  const supabase = await createRouteSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { csv, enrich = false } = await req.json()
  if (!csv) return NextResponse.json({ error: 'No CSV provided' }, { status: 400 })

  const rows = parseCSV(csv)
  if (rows.length === 0) return NextResponse.json({ error: 'No data found in CSV. Make sure you uploaded the LinkedIn Connections.csv file.' }, { status: 400 })

  let imported = 0
  let skipped = 0
  const errors: string[] = []

  // Fetch existing linkedin_urls to detect duplicates
  const { data: existing } = await supabase
    .from('crm_contacts')
    .select('email, name')
    .eq('user_id', user.id)

  const existingEmails = new Set((existing ?? []).map((c: { email: string }) => c.email?.toLowerCase()).filter(Boolean))

  const toInsert = []
  for (const row of rows.slice(0, 500)) {
    const firstName = row['First Name'] ?? row['FirstName'] ?? ''
    const lastName = row['Last Name'] ?? row['LastName'] ?? ''
    const name = `${firstName} ${lastName}`.trim()
    if (!name) { errors.push('Row missing name'); continue }

    const email = row['Email Address'] ?? row['EmailAddress'] ?? ''
    if (email && existingEmails.has(email.toLowerCase())) { skipped++; continue }

    toInsert.push({
      user_id: user.id,
      name,
      company: row['Company'] || null,
      role: row['Position'] || null,
      email: email || null,
      source: 'linkedin',
      tags: [],
      enrichment_status: enrich ? 'pending' : null,
    })
  }

  if (toInsert.length > 0) {
    const { data: inserted, error } = await supabase
      .from('crm_contacts')
      .insert(toInsert)
      .select('id, name, company')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    imported = inserted?.length ?? 0

    if (enrich && inserted && inserted.length > 0) {
      const toEnrich = inserted.slice(0, APOLLO_FREE_TIER_LIMIT)
      await tasks.batchTrigger(
        'enrich-contact',
        toEnrich.map((c: { id: string; name: string; company: string | null }) => ({
          payload: { contactId: c.id, name: c.name, company: c.company ?? null },
          options: { idempotencyKey: `enrich-${c.id}` },
        }))
      )
    }
  }

  return NextResponse.json({ imported, skipped, errors, enriching: enrich ? Math.min(imported, APOLLO_FREE_TIER_LIMIT) : 0 })
}