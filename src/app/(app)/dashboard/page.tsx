'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Plus, Search, Upload, Users, Sparkles, ChevronDown, ChevronUp, Bell, Tag, Download } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import type { Contact, InteractionType } from '@/types'
import { stalenessLevel, stalenessColor, stalenessLabel } from '@/types'
import AddContactModal from '@/components/ui/AddContactModal'
import { format, isToday, isTomorrow, parseISO, differenceInDays } from 'date-fns'

function avatarColor(name: string): string {
  const palette = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#0ea5e9', '#f43f5e', '#14b8a6',
  ]
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return palette[hash % palette.length]
}

function initials(name: string): string {
  const parts = name.trim().split(' ')
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

function reminderLabel(dateStr: string): { label: string; color: string } | null {
  const date = parseISO(dateStr)
  const daysUntil = differenceInDays(date, new Date())
  if (daysUntil < 0) return { label: 'Overdue', color: 'bg-red-100 text-red-700' }
  if (isToday(date)) return { label: 'Due today', color: 'bg-orange-100 text-orange-700' }
  if (isTomorrow(date)) return { label: 'Due tomorrow', color: 'bg-amber-100 text-amber-700' }
  if (daysUntil <= 7) return { label: `Due in ${daysUntil}d`, color: 'bg-yellow-100 text-yellow-700' }
  return null
}

// 8 profile fields — higher = more complete
const COMPLETENESS_FIELDS: (keyof Contact)[] = [
  'company', 'role', 'email', 'phone', 'linkedin_url', 'notes', 'follow_up_date',
]

function completeness(c: Contact): number {
  const filled = COMPLETENESS_FIELDS.filter((f) => {
    const v = c[f]
    if (Array.isArray(v)) return v.length > 0
    return v !== null && v !== undefined && v !== ''
  }).length
  // tags count too
  const hasTag = (c.tags ?? []).length > 0
  return Math.round(((filled + (hasTag ? 1 : 0)) / (COMPLETENESS_FIELDS.length + 1)) * 100)
}

function completenessColor(pct: number): string {
  if (pct >= 75) return '#10b981'
  if (pct >= 40) return '#f59e0b'
  return '#ef4444'
}

const FILTER_LABELS: Record<string, string> = {
  stale: 'Overdue',
  warm: 'Due soon',
  never: 'Never contacted',
  fresh: 'Fresh',
}

const INTERACTION_TYPES: { value: InteractionType; label: string }[] = [
  { value: 'met', label: 'Met in person' },
  { value: 'emailed', label: 'Emailed' },
  { value: 'called', label: 'Called' },
  { value: 'dm', label: "DM'd" },
  { value: 'other', label: 'Other' },
]

interface Suggestion { contactId: string; reason: string }

export default function DashboardPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'stale' | 'warm' | 'fresh' | 'never' | 'reminder'>('all')
  const [companyFilter, setCompanyFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [sortBy, setSortBy] = useState<'staleness' | 'name' | 'interactions' | 'reminder'>('staleness')
  const [showAdd, setShowAdd] = useState(false)

  // Quick-log state
  const [quickLogId, setQuickLogId] = useState<string | null>(null)
  const [quickLogType, setQuickLogType] = useState<InteractionType>('emailed')
  const [quickLogDate, setQuickLogDate] = useState(new Date().toISOString().split('T')[0])
  const [quickLogNote, setQuickLogNote] = useState('')
  const [quickLogSaving, setQuickLogSaving] = useState(false)

  // Suggestions state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false)
  const [loggedSuggestions, setLoggedSuggestions] = useState<Set<string>>(new Set())
  const [loggingSuggestion, setLoggingSuggestion] = useState<string | null>(null)

  // First-run banner: show until dismissed or contacts exist
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('crm_welcome_dismissed') !== '1'
  })

  const [totalContacts, setTotalContacts] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  const supabase = createBrowserSupabaseClient()

  useEffect(() => { loadContacts(0, true) }, [])

  async function loadContacts(page = 0, replace = false) {
    if (page === 0) setLoading(true)
    else setLoadingMore(true)
    const res = await fetch(`/api/contacts?page=${page}`)
    const json = await res.json()
    const incoming = (json.contacts as Contact[]) ?? []
    setContacts((prev) => replace ? incoming : [...prev, ...incoming])
    setTotalContacts(json.total ?? 0)
    setCurrentPage(page)
    if (page === 0) setLoading(false)
    else setLoadingMore(false)
  }

  function exportCSV() {
    const headers = ['Name', 'Company', 'Role', 'Email', 'Phone', 'LinkedIn URL', 'Tags', 'Notes', 'Follow-up Date', 'Days Since Contact', 'Interactions']
    const rows = contacts.map((c) => [
      c.name,
      c.company ?? '',
      c.role ?? '',
      c.email ?? '',
      c.phone ?? '',
      c.linkedin_url ?? '',
      (c.tags ?? []).join('; '),
      (c.notes ?? '').replace(/\n/g, ' '),
      c.follow_up_date ?? '',
      c.days_since_contact ?? '',
      c.interaction_count ?? 0,
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function loadSuggestions() {
    if (suggestionsLoaded) { setSuggestionsOpen(true); return }
    setSuggestionsLoading(true)
    setSuggestionsOpen(true)
    const res = await fetch('/api/suggestions')
    const { suggestions: s } = await res.json()
    setSuggestions(s ?? [])
    setSuggestionsLoading(false)
    setSuggestionsLoaded(true)
  }

  async function logSuggestionContact(contactId: string) {
    setLoggingSuggestion(contactId)
    await fetch(`/api/contacts/${contactId}/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'emailed', interaction_date: new Date().toISOString().split('T')[0], note: null }),
    })
    setLoggedSuggestions((prev) => new Set([...prev, contactId]))
    setLoggingSuggestion(null)
    loadContacts(0, true)
  }

  async function saveQuickLog(contactId: string) {
    setQuickLogSaving(true)
    await fetch(`/api/contacts/${contactId}/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: quickLogType, interaction_date: quickLogDate, note: quickLogNote || null }),
    })
    setQuickLogSaving(false)
    setQuickLogId(null)
    setQuickLogNote('')
    setQuickLogDate(new Date().toISOString().split('T')[0])
    loadContacts(0, true)
  }

  const companies = Array.from(new Set(contacts.map((c) => c.company).filter(Boolean))).sort() as string[]
  const roles = Array.from(new Set(contacts.map((c) => c.role).filter(Boolean))).sort() as string[]
  const allTags = Array.from(new Set(contacts.flatMap((c) => c.tags ?? []))).sort()

  const filtered = contacts.filter((c) => {
    const matchQuery =
      !query ||
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      (c.company ?? '').toLowerCase().includes(query.toLowerCase()) ||
      (c.role ?? '').toLowerCase().includes(query.toLowerCase())
    const level = stalenessLevel(c.days_since_contact)
    const matchFilter =
      filter === 'all' ||
      (filter === 'reminder'
        ? c.follow_up_date != null && differenceInDays(parseISO(c.follow_up_date), new Date()) <= 7
        : level === filter)
    const matchCompany = !companyFilter || c.company === companyFilter
    const matchRole = !roleFilter || c.role === roleFilter
    const matchTag = !tagFilter || (c.tags ?? []).includes(tagFilter)
    return matchQuery && matchFilter && matchCompany && matchRole && matchTag
  }).sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    if (sortBy === 'interactions') return (b.interaction_count ?? 0) - (a.interaction_count ?? 0)
    if (sortBy === 'reminder') {
      const aDate = a.follow_up_date ? new Date(a.follow_up_date).getTime() : Infinity
      const bDate = b.follow_up_date ? new Date(b.follow_up_date).getTime() : Infinity
      return aDate - bDate
    }
    // staleness: never contacted first, then by days_since_contact desc
    const aVal = a.days_since_contact ?? Infinity
    const bVal = b.days_since_contact ?? Infinity
    return bVal - aVal
  })

  const hasDropdownFilter = companyFilter || roleFilter || tagFilter

  const counts = {
    stale: contacts.filter((c) => stalenessLevel(c.days_since_contact) === 'stale').length,
    warm: contacts.filter((c) => stalenessLevel(c.days_since_contact) === 'warm').length,
    never: contacts.filter((c) => stalenessLevel(c.days_since_contact) === 'never').length,
  }

  const remindersCount = contacts.filter((c) => {
    if (!c.follow_up_date) return false
    const daysUntil = differenceInDays(parseISO(c.follow_up_date), new Date())
    return daysUntil <= 7
  }).length

  const stalenessBar = [
    { key: 'stale', count: counts.stale, color: '#ef4444' },
    { key: 'warm', count: counts.warm, color: '#f59e0b' },
    { key: 'never', count: counts.never, color: '#94a3b8' },
  ].filter((s) => s.count > 0)

  // Map suggestion contactId → contact for display
  const suggestedContacts = suggestions
    .map((s) => ({ ...s, contact: contacts.find((c) => c.id === s.contactId) }))
    .filter((s) => s.contact)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* First-run welcome banner */}
      {showWelcomeBanner && contacts.length === 0 && !loading && (
        <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-xl p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-indigo-900 mb-1">Welcome to your Networking CRM</p>
            <p className="text-sm text-indigo-700 mb-3">Start by importing your LinkedIn connections — it takes about 30 seconds and sets up your whole network at once.</p>
            <div className="flex gap-2">
              <Link href="/import" className="px-3.5 py-1.5 text-xs font-semibold text-white rounded-lg hover:opacity-90 transition-opacity" style={{ background: '#6366f1' }}>
                Import from LinkedIn
              </Link>
              <button
                onClick={() => setShowAdd(true)}
                className="px-3.5 py-1.5 text-xs font-medium text-indigo-700 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                Add manually
              </button>
            </div>
          </div>
          <button
            onClick={() => { setShowWelcomeBanner(false); localStorage.setItem('crm_welcome_dismissed', '1') }}
            className="text-indigo-400 hover:text-indigo-600 transition-colors shrink-0 text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Contacts</h1>
          <p className="text-sm text-slate-500 mt-0.5">{contacts.length} in your network</p>
        </div>
        <div className="flex gap-2">
          {contacts.length > 0 && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
              title="Export all contacts to CSV"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
          <Link
            href="/import"
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
          >
            <Upload className="w-4 h-4" />
            Import
          </Link>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-white transition-all shadow-sm hover:opacity-90"
            style={{ background: '#6366f1' }}
          >
            <Plus className="w-4 h-4" />
            Add contact
          </button>
        </div>
      </div>

      {/* Suggestions card */}
      {contacts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-5 overflow-hidden">
          <button
            onClick={() => suggestionsOpen ? setSuggestionsOpen(false) : loadSuggestions()}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <span className="text-sm font-semibold text-slate-900">Reach out this week</span>
              <span className="text-xs text-slate-400">· AI-suggested</span>
            </div>
            {suggestionsOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {suggestionsOpen && (
            <div className="border-t border-slate-100 px-5 py-4">
              {suggestionsLoading ? (
                <p className="text-sm text-slate-400 py-2">Analyzing your network…</p>
              ) : suggestedContacts.length === 0 ? (
                <p className="text-sm text-slate-400 py-2">No suggestions right now — you're on top of your network!</p>
              ) : (
                <div className="space-y-2.5">
                  {suggestedContacts.map(({ contactId, reason, contact }) => (
                    <div key={contactId} className="flex items-center gap-3">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: avatarColor(contact!.name) }}
                      >
                        {initials(contact!.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-slate-900">{contact!.name}</span>
                        {contact!.company && <span className="text-xs text-slate-400 ml-1.5">· {contact!.company}</span>}
                        <p className="text-xs text-slate-500 mt-0.5">{reason}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => logSuggestionContact(contactId)}
                          disabled={loggingSuggestion === contactId || loggedSuggestions.has(contactId)}
                          className="text-xs font-medium px-2.5 py-1 rounded-lg border transition-all disabled:opacity-60"
                          style={loggedSuggestions.has(contactId)
                            ? { background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }
                            : { background: '#f8fafc', color: '#475569', borderColor: '#e2e8f0' }
                          }
                        >
                          {loggedSuggestions.has(contactId) ? '✓ Logged' : loggingSuggestion === contactId ? '…' : 'Contacted'}
                        </button>
                        <Link
                          href={`/contacts/${contactId}`}
                          className="text-xs font-medium px-2.5 py-1 rounded-lg text-white shrink-0 hover:opacity-90 transition-opacity"
                          style={{ background: '#8b5cf6' }}
                        >
                          View →
                        </Link>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => { setSuggestionsLoaded(false); loadSuggestions() }}
                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors mt-1"
                  >
                    Refresh suggestions
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reminders + staleness bar */}
      {contacts.length > 0 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {remindersCount > 0 && (
            <button
              onClick={() => setFilter(filter === 'reminder' ? 'all' : 'reminder')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                filter === 'reminder'
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-orange-50 text-orange-700 border-orange-200'
              }`}
            >
              <Bell className="w-3 h-3" />
              {remindersCount} reminder{remindersCount > 1 ? 's' : ''} due
            </button>
          )}
          {stalenessBar.map(({ key, count, color }) => (
            <button
              key={key}
              onClick={() => setFilter(filter === key as typeof filter ? 'all' : key as typeof filter)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                filter === key
                  ? 'text-white border-transparent'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
              style={filter === key ? { background: color, borderColor: color } : {}}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: filter === key ? 'rgba(255,255,255,0.8)' : color }}
              />
              {count} {FILTER_LABELS[key]}
            </button>
          ))}
          {filter !== 'all' && (
            <button
              onClick={() => setFilter('all')}
              className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Search + filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, company, or role…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all shadow-sm"
            style={{ '--tw-ring-color': '#6366f1' } as React.CSSProperties}
          />
        </div>
        {companies.length > 0 && (
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className={`px-3 py-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all shadow-sm ${
              companyFilter ? 'border-indigo-400 text-slate-900 font-medium' : 'border-slate-200 text-slate-500'
            }`}
            style={{ '--tw-ring-color': '#6366f1' } as React.CSSProperties}
          >
            <option value="">Company</option>
            {companies.map((co) => <option key={co} value={co}>{co}</option>)}
          </select>
        )}
        {roles.length > 0 && (
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className={`px-3 py-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all shadow-sm ${
              roleFilter ? 'border-indigo-400 text-slate-900 font-medium' : 'border-slate-200 text-slate-500'
            }`}
            style={{ '--tw-ring-color': '#6366f1' } as React.CSSProperties}
          >
            <option value="">Position</option>
            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        {allTags.length > 0 && (
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className={`px-3 py-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all shadow-sm ${
              tagFilter ? 'border-indigo-400 text-slate-900 font-medium' : 'border-slate-200 text-slate-500'
            }`}
            style={{ '--tw-ring-color': '#6366f1' } as React.CSSProperties}
          >
            <option value="">Tag</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:border-transparent transition-all shadow-sm"
          style={{ '--tw-ring-color': '#6366f1' } as React.CSSProperties}
        >
          <option value="staleness">Sort: Most stale</option>
          <option value="name">Sort: A → Z</option>
          <option value="interactions">Sort: Most active</option>
          <option value="reminder">Sort: Reminders first</option>
        </select>
        {hasDropdownFilter && (
          <button
            onClick={() => { setCompanyFilter(''); setRoleFilter(''); setTagFilter('') }}
            className="px-3 py-2.5 text-sm text-slate-400 hover:text-slate-700 bg-white border border-slate-200 rounded-lg transition-colors shadow-sm"
          >
            Clear
          </button>
        )}
      </div>

      {/* Contact list */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium mb-1">
            {contacts.length === 0 ? 'No contacts yet' : 'No contacts match your search'}
          </p>
          <p className="text-slate-400 text-sm mb-5">
            {contacts.length === 0 ? 'Add someone from your network to get started.' : 'Try a different search term or clear the filter.'}
          </p>
          {contacts.length === 0 && (
            <div className="flex gap-3">
              <Link href="/import" className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90" style={{ background: '#6366f1' }}>
                Import from LinkedIn
              </Link>
              <button onClick={() => setShowAdd(true)} className="px-4 py-2 text-sm font-medium bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
                Add manually
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {filtered.map((c, idx) => {
            const level = stalenessLevel(c.days_since_contact)
            const color = avatarColor(c.name)
            const reminder = c.follow_up_date ? reminderLabel(c.follow_up_date) : null
            const isQuickLogging = quickLogId === c.id
            const pct = completeness(c)
            const pctColor = completenessColor(pct)

            return (
              <div key={c.id} className={idx !== 0 ? 'border-t border-slate-100' : ''}>
                {/* Contact row */}
                <div className="flex items-center gap-2 px-5 py-3.5 hover:bg-slate-50 transition-colors group">
                  <Link href={`/contacts/${c.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Avatar with completeness ring */}
                    <div className="relative shrink-0">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: color }}
                      >
                        {initials(c.name)}
                      </div>
                      {/* Completeness arc as a small colored dot in corner */}
                      <div
                        className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                        style={{ background: pctColor }}
                        title={`Profile ${pct}% complete`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-slate-900 truncate">{c.name}</span>
                        {c.enrichment_status === 'not_found' && (
                          <span title="Couldn't find additional info" className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        )}
                        {c.enrichment_status === 'pending' && (
                          <span title="Enrichment in progress…" className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {[c.role, c.company].filter(Boolean).join(' · ') || 'No company info'}
                      </p>
                      {/* Tags row */}
                      {(c.tags ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(c.tags ?? []).slice(0, 3).map((tag) => (
                            <button
                              key={tag}
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTagFilter(tag === tagFilter ? '' : tag) }}
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                tag === tagFilter
                                  ? 'bg-indigo-500 text-white'
                                  : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                          {(c.tags ?? []).length > 3 && (
                            <span className="text-[10px] text-slate-400">+{(c.tags ?? []).length - 3} more</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right flex flex-col items-end gap-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stalenessColor(level)}`}>
                        {stalenessLabel(c.days_since_contact)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {reminder && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${reminder.color}`}>
                            <Bell className="w-2.5 h-2.5 mr-1" />{reminder.label}
                          </span>
                        )}
                        <p className="text-xs text-slate-400">{c.interaction_count ?? 0} interactions</p>
                      </div>
                      {/* Completeness bar */}
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pctColor }} />
                        </div>
                        <span className="text-[10px] text-slate-400">{pct}%</span>
                      </div>
                    </div>
                  </Link>

                  {/* Quick-log button */}
                  <button
                    onClick={() => {
                      setQuickLogId(isQuickLogging ? null : c.id)
                      setQuickLogNote('')
                      setQuickLogDate(new Date().toISOString().split('T')[0])
                    }}
                    title="Log interaction"
                    className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                      isQuickLogging
                        ? 'text-white'
                        : 'text-slate-300 hover:text-white opacity-0 group-hover:opacity-100'
                    }`}
                    style={isQuickLogging ? { background: '#6366f1' } : { background: '#6366f1' }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Inline quick-log form */}
                {isQuickLogging && (
                  <div className="px-5 pb-4 pt-1 bg-indigo-50/60 border-t border-indigo-100">
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={quickLogType}
                        onChange={(e) => setQuickLogType(e.target.value as InteractionType)}
                        className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {INTERACTION_TYPES.map(({ value, label }) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={quickLogDate}
                        onChange={(e) => setQuickLogDate(e.target.value)}
                        className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        type="text"
                        placeholder="Note (optional)"
                        value={quickLogNote}
                        onChange={(e) => setQuickLogNote(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveQuickLog(c.id)}
                        className="flex-1 min-w-32 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        onClick={() => saveQuickLog(c.id)}
                        disabled={quickLogSaving}
                        className="px-3 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity"
                        style={{ background: '#6366f1' }}
                      >
                        {quickLogSaving ? 'Saving…' : 'Log'}
                      </button>
                      <button
                        onClick={() => setQuickLogId(null)}
                        className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Load more */}
      {contacts.length < totalContacts && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => loadContacts(currentPage + 1)}
            disabled={loadingMore}
            className="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : `Load more (${totalContacts - contacts.length} remaining)`}
          </button>
        </div>
      )}

      {showAdd && (
        <AddContactModal
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); loadContacts(0, true) }}
        />
      )}
    </div>
  )
}
