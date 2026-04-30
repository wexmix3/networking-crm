'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Upload, Users } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import type { Contact } from '@/types'
import { stalenessLevel, stalenessColor, stalenessLabel } from '@/types'
import AddContactModal from '@/components/ui/AddContactModal'

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

const FILTER_LABELS: Record<string, string> = {
  stale: 'Overdue',
  warm: 'Due soon',
  never: 'Never contacted',
  fresh: 'Fresh',
}

export default function DashboardPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'stale' | 'warm' | 'fresh' | 'never'>('all')
  const [companyFilter, setCompanyFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
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

  const stalenessBar = [
    { key: 'stale', count: counts.stale, color: '#ef4444' },
    { key: 'warm', count: counts.warm, color: '#f59e0b' },
    { key: 'never', count: counts.never, color: '#94a3b8' },
  ].filter((s) => s.count > 0)

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

      {/* Status bar */}
      {contacts.length > 0 && stalenessBar.length > 0 && (
        <div className="flex gap-2 mb-5 flex-wrap">
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
            return (
              <Link
                key={c.id}
                href={`/contacts/${c.id}`}
                className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors ${
                  idx !== 0 ? 'border-t border-slate-100' : ''
                }`}
              >
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: color }}
                >
                  {initials(c.name)}
                </div>

                {/* Name + meta */}
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

                {/* Staleness */}
                <div className="shrink-0 text-right">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stalenessColor(level)}`}>
                    {stalenessLabel(c.days_since_contact)}
                  </span>
                  <p className="text-xs text-slate-400 mt-1">{c.interaction_count ?? 0} interactions</p>
                </div>
              </Link>
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
