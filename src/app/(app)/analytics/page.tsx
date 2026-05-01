'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line,
} from 'recharts'
import { format, subDays, startOfWeek, eachWeekOfInterval } from 'date-fns'

interface RawContact {
  company: string | null
  created_at: string
  email: string | null
  phone: string | null
  role: string | null
  linkedin_url: string | null
  notes: string | null
  tags: string[]
  follow_up_date: string | null
  days_since_contact: number | null
}

interface RawInteraction {
  type: string
  interaction_date: string
}

const INTERACTION_COLORS: Record<string, string> = {
  met: '#6366f1',
  emailed: '#0ea5e9',
  called: '#10b981',
  dm: '#8b5cf6',
  other: '#94a3b8',
}
const INTERACTION_LABELS: Record<string, string> = {
  met: 'Met in person',
  emailed: 'Emailed',
  called: 'Called',
  dm: "DM'd",
  other: 'Other',
}

const COMPANY_COLORS = ['#6366f1', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#14b8a6', '#ec4899']

const COMPANY_ALIASES: Record<string, string> = {
  'banco bilbao vizcaya': 'BBVA',
  'bbva': 'BBVA',
  'stx group': 'STX',
  'stx': 'STX',
}

function normalizeCompany(name: string): string {
  const lower = name.toLowerCase().trim()
  for (const [alias, canonical] of Object.entries(COMPANY_ALIASES)) {
    if (lower.startsWith(alias)) return canonical
  }
  return name
}

// Profile completeness for a contact (same logic as dashboard)
const COMPLETENESS_FIELDS: (keyof RawContact)[] = ['company', 'role', 'email', 'phone', 'linkedin_url', 'notes', 'follow_up_date']
function contactCompleteness(c: RawContact): number {
  const filled = COMPLETENESS_FIELDS.filter((f) => {
    const v = c[f]
    if (Array.isArray(v)) return v.length > 0
    return v !== null && v !== undefined && v !== ''
  }).length
  const hasTag = (c.tags ?? []).length > 0
  return Math.round(((filled + (hasTag ? 1 : 0)) / (COMPLETENESS_FIELDS.length + 1)) * 100)
}

function healthScoreColor(score: number): string {
  if (score >= 70) return '#10b981'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

function healthScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Fair'
  return 'Needs work'
}

export default function AnalyticsPage() {
  const supabase = createBrowserSupabaseClient()
  const [contacts, setContacts] = useState<RawContact[]>([])
  const [interactions, setInteractions] = useState<RawInteraction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: c }, { data: i }] = await Promise.all([
        supabase
          .from('crm_contacts_with_staleness')
          .select('company, created_at, email, phone, role, linkedin_url, notes, tags, follow_up_date, days_since_contact'),
        supabase.from('crm_interactions').select('type, interaction_date'),
      ])
      setContacts((c as RawContact[]) ?? [])
      setInteractions((i as RawInteraction[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // 1. Interaction type breakdown
  const interactionBreakdown = Object.entries(
    interactions.reduce((acc, i) => {
      acc[i.type] = (acc[i.type] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)
  ).map(([type, count]) => ({ type, count, label: INTERACTION_LABELS[type] ?? type }))

  // 2. Companies breakdown — top 8 + Other
  const allCompanyCounts = Object.entries(
    contacts.reduce((acc, c) => {
      const key = c.company ? normalizeCompany(c.company) : 'Unknown'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)
  )
    .map(([company, count]) => ({ company, count }))
    .sort((a, b) => b.count - a.count)

  const TOP_N = 8
  const topCompanies = allCompanyCounts.slice(0, TOP_N)
  const otherCount = allCompanyCounts.slice(TOP_N).reduce((sum, c) => sum + c.count, 0)
  const companyCounts = otherCount > 0
    ? [...topCompanies, { company: `Other (${allCompanyCounts.length - TOP_N} more)`, count: otherCount }]
    : topCompanies

  // 3. Interaction timeline — last 90 days by week
  const now = new Date()
  const ninetyDaysAgo = subDays(now, 90)
  const weeks = eachWeekOfInterval({ start: ninetyDaysAgo, end: now }, { weekStartsOn: 1 })
  const timelineData = weeks.map((weekStart) => {
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
    const count = interactions.filter((i) => {
      const d = new Date(i.interaction_date)
      return d >= weekStart && d < weekEnd
    }).length
    return { week: format(weekStart, 'MMM d'), count }
  })

  // 4. Contact growth — cumulative by week
  const sortedContacts = [...contacts].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  const growthData = (() => {
    if (sortedContacts.length === 0) return []
    const first = startOfWeek(new Date(sortedContacts[0].created_at), { weekStartsOn: 1 })
    const growthWeeks = eachWeekOfInterval({ start: first, end: now }, { weekStartsOn: 1 })
    let cumulative = 0
    return growthWeeks.map((weekStart) => {
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
      cumulative += sortedContacts.filter((c) => {
        const d = new Date(c.created_at)
        return d >= weekStart && d < weekEnd
      }).length
      return { week: format(weekStart, 'MMM d'), total: cumulative }
    })
  })()

  // 5. Network health score
  const healthMetrics = (() => {
    if (contacts.length === 0) return null
    const contactedRecently = contacts.filter(
      (c) => c.days_since_contact !== null && c.days_since_contact <= 90
    ).length
    const activeRate = Math.round((contactedRecently / contacts.length) * 100)

    const avgFillRate = Math.round(
      contacts.reduce((sum, c) => sum + contactCompleteness(c), 0) / contacts.length
    )

    const contactedEver = contacts.filter((c) => c.days_since_contact !== null)
    const avgStaleness = contactedEver.length > 0
      ? Math.round(contactedEver.reduce((sum, c) => sum + (c.days_since_contact ?? 0), 0) / contactedEver.length)
      : null
    // Staleness score: 0 days = 100, 90+ days = 0
    const stalenessScore = avgStaleness !== null ? Math.max(0, Math.round(100 - (avgStaleness / 90) * 100)) : 50

    const freshCount = contacts.filter((c) => c.days_since_contact !== null && c.days_since_contact <= 30).length
    const freshRate = Math.round((freshCount / contacts.length) * 100)

    // Composite: 40% active rate, 30% fill rate, 30% staleness score
    const composite = Math.round(activeRate * 0.4 + avgFillRate * 0.3 + stalenessScore * 0.3)

    return { activeRate, avgFillRate, stalenessScore, freshRate, composite, avgStaleness }
  })()

  const totalInteractions = interactions.length
  const topCompany = companyCounts[0]

  if (loading) return <div className="p-8 text-sm text-slate-400">Loading…</div>

  const isEmpty = contacts.length === 0

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Analytics</h1>
        <p className="text-sm text-slate-500 mt-0.5">Network overview and activity trends</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total contacts', value: contacts.length },
          { label: 'Total interactions', value: totalInteractions },
          { label: 'Top company', value: topCompany?.company ?? '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">{label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 truncate">{value}</p>
          </div>
        ))}
      </div>

      {isEmpty ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
          <p className="text-slate-500 font-medium">No data yet</p>
          <p className="text-slate-400 text-sm mt-1">Add contacts and log interactions to see your analytics.</p>
        </div>
      ) : (
        <>
          {/* Network Health Score */}
          {healthMetrics && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm mb-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Network Health Score</h2>
                  <p className="text-xs text-slate-400 mt-0.5">How well you're maintaining your network</p>
                </div>
                <div className="text-right">
                  <span
                    className="text-3xl font-bold"
                    style={{ color: healthScoreColor(healthMetrics.composite) }}
                  >
                    {healthMetrics.composite}
                  </span>
                  <span className="text-sm text-slate-400">/100</span>
                  <p className="text-xs font-medium mt-0.5" style={{ color: healthScoreColor(healthMetrics.composite) }}>
                    {healthScoreLabel(healthMetrics.composite)}
                  </p>
                </div>
              </div>

              {/* Score bar */}
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-5">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${healthMetrics.composite}%`, background: healthScoreColor(healthMetrics.composite) }}
                />
              </div>

              {/* Component metrics */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: 'Active (90d)',
                    value: `${healthMetrics.activeRate}%`,
                    desc: `${contacts.filter((c) => c.days_since_contact !== null && c.days_since_contact <= 90).length} of ${contacts.length} contacts`,
                    color: healthScoreColor(healthMetrics.activeRate),
                  },
                  {
                    label: 'Profile fill rate',
                    value: `${healthMetrics.avgFillRate}%`,
                    desc: 'Average fields completed',
                    color: healthScoreColor(healthMetrics.avgFillRate),
                  },
                  {
                    label: 'Avg staleness',
                    value: healthMetrics.avgStaleness !== null ? `${healthMetrics.avgStaleness}d` : 'N/A',
                    desc: 'Days since last contact (avg)',
                    color: healthScoreColor(healthMetrics.stalenessScore),
                  },
                ].map(({ label, value, desc, color }) => (
                  <div key={label} className="bg-slate-50 rounded-lg p-3.5">
                    <p className="text-xs text-slate-500 font-medium">{label}</p>
                    <p className="text-xl font-bold mt-1" style={{ color }}>{value}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">

            {/* Interaction type breakdown */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">Interaction breakdown</h2>
              <p className="text-xs text-slate-400 mb-4">How you stay in touch</p>
              {interactionBreakdown.length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">No interactions logged yet.</p>
              ) : (
                <>
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={interactionBreakdown}
                          dataKey="count"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={3}
                        >
                          {interactionBreakdown.map((entry) => (
                            <Cell key={entry.type} fill={INTERACTION_COLORS[entry.type] ?? '#94a3b8'} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, _name, props) => [value, props.payload.label]}
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Donut center label */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-slate-900">{totalInteractions}</p>
                        <p className="text-xs text-slate-400">total</p>
                      </div>
                    </div>
                  </div>
                  {/* HTML legend */}
                  <div className="grid grid-cols-2 gap-1.5 mt-3">
                    {interactionBreakdown.map((entry) => (
                      <div key={entry.type} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: INTERACTION_COLORS[entry.type] ?? '#94a3b8' }} />
                        <span className="text-xs text-slate-600 truncate">{entry.label}</span>
                        <span className="text-xs text-slate-400 ml-auto">{entry.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Companies breakdown */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">Companies</h2>
              <p className="text-xs text-slate-400 mb-4">Contacts per organisation</p>
              {companyCounts.length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">No company data yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {companyCounts.map(({ company, count }, idx) => {
                    const max = companyCounts[0].count
                    const pct = Math.round((count / max) * 100)
                    const isOther = company.startsWith('Other (')
                    return (
                      <div key={company} className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-4 shrink-0 text-right">{isOther ? '' : idx + 1}</span>
                        <span className="text-xs text-slate-700 w-32 shrink-0 truncate" title={company}>{company}</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              background: isOther ? '#cbd5e1' : COMPANY_COLORS[idx % COMPANY_COLORS.length],
                            }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-600 w-5 shrink-0 text-right">{count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Interaction timeline */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">Interaction timeline</h2>
              <p className="text-xs text-slate-400 mb-4">Last 90 days by week</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={timelineData} margin={{ left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={2} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    formatter={(v) => [v, 'Interactions']}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Contact growth */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">Network growth</h2>
              <p className="text-xs text-slate-400 mb-4">Cumulative contacts over time</p>
              {growthData.length <= 1 ? (
                <p className="text-sm text-slate-400 py-8 text-center">Add more contacts over time to see growth.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={growthData} margin={{ left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={Math.floor(growthData.length / 5)} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                      formatter={(v) => [v, 'Contacts']}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#8b5cf6' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

          </div>
        </>
      )}
    </div>
  )
}
