'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Upload } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import type { Contact } from '@/types'
import { stalenessLevel, stalenessColor, stalenessLabel } from '@/types'
import AddContactModal from '@/components/ui/AddContactModal'

export default function DashboardPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'stale' | 'warm' | 'fresh' | 'never'>('all')
  const [showAdd, setShowAdd] = useState(false)
  const supabase = createBrowserSupabaseClient()

  useEffect(() => {
    loadContacts()
  }, [])

  async function loadContacts() {
    setLoading(true)
    const { data } = await supabase
      .from('contacts_with_staleness')
      .select('*')
      .order('days_since_contact', { ascending: false, nullsFirst: true })
    setContacts((data as Contact[]) ?? [])
    setLoading(false)
  }

  const filtered = contacts.filter((c) => {
    const matchQuery =
      !query ||
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      (c.company ?? '').toLowerCase().includes(query.toLowerCase()) ||
      (c.role ?? '').toLowerCase().includes(query.toLowerCase())
    const level = stalenessLevel(c.days_since_contact)
    const matchFilter = filter === 'all' || level === filter
    return matchQuery && matchFilter
  })

  const counts = {
    stale: contacts.filter((c) => stalenessLevel(c.days_since_contact) === 'stale').length,
    warm: contacts.filter((c) => stalenessLevel(c.days_since_contact) === 'warm').length,
    never: contacts.filter((c) => stalenessLevel(c.days_since_contact) === 'never').length,
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-500 mt-0.5">{contacts.length} total</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/import"
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import
          </Link>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add contact
          </button>
        </div>
      </div>

      {/* Summary pills */}
      {contacts.length > 0 && (
        <div className="flex gap-2 mb-5">
          {counts.stale > 0 && (
            <button
              onClick={() => setFilter(filter === 'stale' ? 'all' : 'stale')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === 'stale' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-800 hover:bg-red-200'
              }`}
            >
              {counts.stale} overdue (90+ days)
            </button>
          )}
          {counts.warm > 0 && (
            <button
              onClick={() => setFilter(filter === 'warm' ? 'all' : 'warm')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === 'warm' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
              }`}
            >
              {counts.warm} due soon (31–90 days)
            </button>
          )}
          {counts.never > 0 && (
            <button
              onClick={() => setFilter(filter === 'never' ? 'all' : 'never')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === 'never' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {counts.never} never contacted
            </button>
          )}
          {filter !== 'all' && (
            <button
              onClick={() => setFilter('all')}
              className="px-3 py-1.5 rounded-full text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search contacts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-sm mb-4">
            {contacts.length === 0 ? 'No contacts yet.' : 'No contacts match your search.'}
          </p>
          {contacts.length === 0 && (
            <div className="flex gap-3 justify-center">
              <Link href="/import" className="text-sm text-blue-600 hover:underline">Import from LinkedIn</Link>
              <span className="text-gray-300">or</span>
              <button onClick={() => setShowAdd(true)} className="text-sm text-blue-600 hover:underline">Add manually</button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-1/3">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Company / Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Last contact</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Interactions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((c) => {
                const level = stalenessLevel(c.days_since_contact)
                return (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/contacts/${c.id}`} className="font-medium text-gray-900 hover:text-blue-600 transition-colors">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {[c.role, c.company].filter(Boolean).join(' @ ') || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stalenessColor(level)}`}>
                        {stalenessLabel(c.days_since_contact)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{c.interaction_count ?? 0}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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