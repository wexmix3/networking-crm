import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}

export async function POST(req: Request) {
  // Verify cron secret
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Get all users with digest enabled
  const { data: prefs } = await supabase
    .from('crm_digest_preferences')
    .select('*')
    .eq('digest_enabled', true)

  if (!prefs?.length) return NextResponse.json({ sent: 0 })

  let sent = 0

  for (const pref of prefs) {
    // Stale + never-contacted contacts
    const { data: contacts } = await supabase
      .from('crm_contacts_with_staleness')
      .select('*')
      .eq('user_id', pref.user_id)
      .or(`days_since_contact.gte.${pref.stale_threshold_days},days_since_contact.is.null`)
      .order('days_since_contact', { ascending: false, nullsFirst: true })
      .limit(10)

    // Overdue follow-ups (follow_up_date <= today, not already in stale list)
    const today = new Date().toISOString().split('T')[0]
    const { data: overdue } = await supabase
      .from('crm_contacts')
      .select('id, name, role, company, follow_up_date')
      .eq('user_id', pref.user_id)
      .lte('follow_up_date', today)
      .not('follow_up_date', 'is', null)
      .limit(5)

    const staleIds = new Set((contacts ?? []).map((c: { id: string }) => c.id))
    const overdueOnly = (overdue ?? []).filter((c) => !staleIds.has(c.id))

    if (!contacts?.length && !overdueOnly.length) continue

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    const staleRows = (contacts ?? []).map((c: { name: string; role?: string; company?: string; days_since_contact?: number }) => {
      const where = [c.role, c.company].filter(Boolean).join(' @ ')
      const when = c.days_since_contact == null ? 'Never contacted' : `${c.days_since_contact} days ago`
      return `<tr style="border-bottom:1px solid #f3f4f6">
        <td style="padding:10px 0;font-weight:500;color:#111">${c.name}</td>
        <td style="padding:10px 0;color:#6b7280;font-size:13px">${where || '—'}</td>
        <td style="padding:10px 0;color:#ef4444;font-size:13px">${when}</td>
      </tr>`
    }).join('')

    const overdueSection = overdueOnly.length > 0 ? `
      <h2 style="font-size:14px;font-weight:600;color:#111;margin:24px 0 12px">⏰ Overdue follow-ups</h2>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:2px solid #f3f4f6">
            <th style="text-align:left;padding:8px 0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em">Name</th>
            <th style="text-align:left;padding:8px 0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em">Role / Company</th>
            <th style="text-align:left;padding:8px 0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em">Follow-up due</th>
          </tr>
        </thead>
        <tbody>
          ${overdueOnly.map((c) => {
            const where = [c.role, c.company].filter(Boolean).join(' @ ')
            return `<tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:10px 0;font-weight:500;color:#111">${c.name}</td>
              <td style="padding:10px 0;color:#6b7280;font-size:13px">${where || '—'}</td>
              <td style="padding:10px 0;color:#f59e0b;font-size:13px">${c.follow_up_date}</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>` : ''

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 0">
        <div style="background:#2563eb;border-radius:12px 12px 0 0;padding:24px 28px">
          <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0">Your Weekly Networking Digest</h1>
          <p style="color:#bfdbfe;font-size:13px;margin:4px 0 0">Who to reach out to this week</p>
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:28px">
          ${(contacts ?? []).length > 0 ? `
          <h2 style="font-size:14px;font-weight:600;color:#111;margin:0 0 12px">Overdue check-ins</h2>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:2px solid #f3f4f6">
                <th style="text-align:left;padding:8px 0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em">Name</th>
                <th style="text-align:left;padding:8px 0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em">Role / Company</th>
                <th style="text-align:left;padding:8px 0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em">Last contact</th>
              </tr>
            </thead>
            <tbody>${staleRows}</tbody>
          </table>` : ''}
          ${overdueSection}
          <div style="margin-top:24px;text-align:center">
            <a href="${appUrl}/dashboard" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;display:inline-block">
              Open Networking CRM →
            </a>
          </div>
        </div>
      </div>
    `

    const total = (contacts?.length ?? 0) + overdueOnly.length
    try {
      await getResend().emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com',
        to: pref.email,
        subject: `${total} networking action${total !== 1 ? 's' : ''} this week`,
        html,
      })
      sent++
    } catch {
      // continue to next user
    }
  }

  return NextResponse.json({ sent })
}