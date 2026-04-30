'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Plus, Search, Upload, Users, Sparkles, ChevronDown, ChevronUp, Bell } from 'lucide-react'
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
  const [filter, setFilter] = useState<'all' | 'stale' | 'warm' | 'fresh' | 'never'>('all')
  const [companyFilter, setCompanyFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
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

  const supabase = createBrowserSupabaseClient()

  useEffect(() => { loadContacts() }, [])

  async function loadContacts() {
    setLoading(true)
    const { data } = await supabase
      .from('crm_contacts_with_staleness')
      .select('*')
      .order('days_since_contact', { ascending: false, nullsFirst: true })
    setContacts((data as Contact[]) ?? [])
    setLoading(false)
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
    loadContacts()
  }

  const companies = Array.from(new Set(contacts.map((c) => c.company).filter(Boolean))).sort() as string[]
  const roles = Array.from(new Set(contacts.map((c) => c.role).filter(Boolean))).sort() as string[]

  const filtered = contacts.filter((c) => {
    const matchQuery =
      !query ||
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      (c.company ?? '').toLowerCase().includes(query.toLowerCase()) ||
      (c.role ?? '').toLowerCase().includes(query.toLowerCase())
    const level = stalenessLevel(c.days_since_contact)
    const matchFilter = filter === 'all' || level === filter
    const matchCompany = !companyFilter || c.company === companyFilter
    const matchRole = !roleFilter || c.role === roleFilter
    return matchQuery && matchFilter && matchCompany && matchRole
  })

  const hasDropdownFilter = companyFilter || roleFilter

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
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Contacts</h1>
          <p className="text-sm text-slate-500 mt-0.5">{contacts.length} in your network</p>
        </div>
        <div className="flex gap-2">
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
                      <Link
                        href={`/contacts/${contactId}`}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg text-white shrink-0 hover:opacity-90 transition-opacity"
                        style={{ background: '#8b5cf6' }}
                      >
                        View →
                      </Link>
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
              onClick={() => setFilter(filter === 'all' ? 'all' : 'all')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200"
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
              Clear
            </button>
          )}
        </div>
      )}

      {/* Search + filters */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
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
        {hasDropdownFilter && (
          <button
            onClick={() => { setCompanyFilter(''); setRoleFilter('') }}
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

            return (
              <div key={c.id} className={idx !== 0 ? 'border-t border-slate-100' : ''}>
                {/* Contact row */}
                <div className="flex items-center gap-2 px-5 py-3.5 hover:bg-slate-50 transition-colors group">
                  <Link href={`/contacts/${c.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: color }}
                    >
                      {initials(c.name)}
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

      {showAdd && (
        <AddContactModal
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); loadContacts() }}
        />
      )}
    </div>
  )
}
