'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mail, Phone, ExternalLink, Plus, Sparkles, Trash2 } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import type { Contact, Interaction, InteractionType } from '@/types'
import { stalenessLevel, stalenessColor, stalenessLabel } from '@/types'
import { format } from 'date-fns'

const INTERACTION_LABELS: Record<InteractionType, string> = {
  met: 'Met in person',
  emailed: 'Emailed',
  called: 'Called',
  dm: 'DM\'d',
  other: 'Other',
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()

  const [contact, setContact] = useState<Contact | null>(null)
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showLog, setShowLog] = useState(false)
  const [aiDraft, setAiDraft] = useState('')
  const [drafting, setDrafting] = useState(false)

  // New interaction form
  const [logType, setLogType] = useState<InteractionType>('emailed')
  const [logNote, setLogNote] = useState('')
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0])
  const [logging, setLogging] = useState(false)

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    setLoading(true)
    const [{ data: c }, { data: i }] = await Promise.all([
      supabase.from('contacts_with_staleness').select('*').eq('id', id).maybeSingle(),
      supabase.from('interactions').select('*').eq('contact_id', id).order('interaction_date', { ascending: false }),
    ])
    setContact(c as Contact)
    setInteractions((i as Interaction[]) ?? [])
    setLoading(false)
  }

  async function logInteraction() {
    if (!contact) return
    setLogging(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('interactions').insert({
      contact_id: id,
      user_id: user.id,
      type: logType,
      note: logNote || null,
      interaction_date: logDate,
    })
    setLogNote('')
    setShowLog(false)
    setLogging(false)
    load()
  }

  async function deleteContact() {
    if (!confirm('Delete this contact and all their interactions?')) return
    await supabase.from('contacts').delete().eq('id', id)
    router.push('/dashboard')
  }

  async function getDraft() {
    setDrafting(true)
    setAiDraft('')
    try {
      const res = await fetch(`/api/contacts/${id}/draft-followup`, { method: 'POST' })
      const { draft } = await res.json()
      setAiDraft(draft)
    } finally {
      setDrafting(false)
    }
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>
  if (!contact) return <div className="p-8 text-sm text-gray-500">Contact not found.</div>

  const level = stalenessLevel(contact.days_since_contact)

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/dashboard" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to contacts
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{contact.name}</h1>
            {(contact.role || contact.company) && (
              <p className="text-gray-500 mt-0.5">
                {[contact.role, contact.company].filter(Boolean).join(' @ ')}
              </p>
            )}
            <div className="flex items-center gap-2 mt-3">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${stalenessColor(level)}`}>
                {stalenessLabel(contact.days_since_contact)}
              </span>
              <span className="text-xs text-gray-400">{contact.interaction_count ?? 0} interactions</span>
            </div>
          </div>
          <button onClick={deleteContact} className="text-gray-400 hover:text-red-600 transition-colors p-1">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Links */}
        <div className="flex flex-wrap gap-3 mt-4">
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
              <Mail className="w-4 h-4" /> {contact.email}
            </a>
          )}
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
              <Phone className="w-4 h-4" /> {contact.phone}
            </a>
          )}
          {contact.linkedin_url && (
            <a href={contact.linkedin_url.startsWith('http') ? contact.linkedin_url : `https://${contact.linkedin_url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
              <ExternalLink className="w-4 h-4" /> LinkedIn
            </a>
          )}
        </div>

        {contact.notes && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">{contact.notes}</div>
        )}
      </div>

      {/* AI follow-up draft */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 text-sm">AI Follow-up Draft</h2>
          <button
            onClick={getDraft}
            disabled={drafting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {drafting ? 'Writing…' : 'Generate draft'}
          </button>
        </div>
        {aiDraft ? (
          <div className="bg-violet-50 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {aiDraft}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Click "Generate draft" to get a personalized follow-up message.</p>
        )}
      </div>

      {/* Interaction timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 text-sm">Interactions</h2>
          <button
            onClick={() => setShowLog(!showLog)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Log interaction
          </button>
        </div>

        {/* Log form */}
        {showLog && (
          <div className="border border-gray-200 rounded-lg p-4 mb-4 space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={logType}
                  onChange={(e) => setLogType(e.target.value as InteractionType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(INTERACTION_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Note (optional)</label>
              <textarea
                rows={2}
                placeholder="What did you talk about?"
                value={logNote}
                onChange={(e) => setLogNote(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowLog(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button
                onClick={logInteraction}
                disabled={logging}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {logging ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {interactions.length === 0 ? (
          <p className="text-sm text-gray-400">No interactions logged yet.</p>
        ) : (
          <ol className="relative border-l border-gray-200 ml-2 space-y-4">
            {interactions.map((i) => (
              <li key={i.id} className="ml-4">
                <div className="absolute -left-1.5 w-3 h-3 bg-blue-600 rounded-full border-2 border-white" />
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-medium text-blue-700">{INTERACTION_LABELS[i.type]}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {format(new Date(i.interaction_date), 'MMM d, yyyy')}
                    </span>
                    {i.note && <p className="text-sm text-gray-700 mt-1">{i.note}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}