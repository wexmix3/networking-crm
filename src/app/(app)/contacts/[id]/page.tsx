'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mail, Phone, ExternalLink, Plus, Sparkles, Pencil } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import type { Contact, Interaction, InteractionType } from '@/types'
import { stalenessLevel, stalenessColor, stalenessLabel } from '@/types'
import { format } from 'date-fns'
import EditContactModal from '@/components/ui/EditContactModal'

const INTERACTION_LABELS: Record<InteractionType, string> = {
  met: 'Met in person',
  emailed: 'Emailed',
  called: 'Called',
  dm: "DM'd",
  other: 'Other',
}

const INTERACTION_COLORS: Record<InteractionType, string> = {
  met: '#6366f1',
  emailed: '#0ea5e9',
  called: '#10b981',
  dm: '#8b5cf6',
  other: '#94a3b8',
}

function avatarColor(name: string): string {
  const palette = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#f43f5e', '#14b8a6']
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return palette[hash % palette.length]
}

function initials(name: string): string {
  const parts = name.trim().split(' ')
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()

  const [contact, setContact] = useState<Contact | null>(null)
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showLog, setShowLog] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [aiDraft, setAiDraft] = useState('')
  const [drafting, setDrafting] = useState(false)

  const [logType, setLogType] = useState<InteractionType>('emailed')
  const [logNote, setLogNote] = useState('')
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0])
  const [logging, setLogging] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const [{ data: c }, { data: i }] = await Promise.all([
      supabase.from('crm_contacts_with_staleness').select('*').eq('id', id).maybeSingle(),
      supabase.from('crm_interactions').select('*').eq('contact_id', id).order('interaction_date', { ascending: false }),
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
    await supabase.from('crm_interactions').insert({
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
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' })
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

  if (loading) return <div className="p-8 text-sm text-slate-400">Loading…</div>
  if (!contact) return <div className="p-8 text-sm text-slate-500">Contact not found.</div>

  const level = stalenessLevel(contact.days_since_contact)
  const color = avatarColor(contact.name)

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to contacts
      </Link>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4 shadow-sm">
        <div className="flex items-start gap-5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white shrink-0"
            style={{ background: color }}
          >
            {initials(contact.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{contact.name}</h1>
                {(contact.role || contact.company) && (
                  <p className="text-sm text-slate-500 mt-0.5">
                    {[contact.role, contact.company].filter(Boolean).join(' · ')}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2.5">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${stalenessColor(level)}`}>
                    {stalenessLabel(contact.days_since_contact)}
                  </span>
                  <span className="text-xs text-slate-400">{contact.interaction_count ?? 0} interactions</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowEdit(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
                <button
                  onClick={deleteContact}
                  className="px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Contact links */}
            <div className="flex flex-wrap gap-3 mt-4">
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors">
                  <Mail className="w-3.5 h-3.5" /> {contact.email}
                </a>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors">
                  <Phone className="w-3.5 h-3.5" /> {contact.phone}
                </a>
              )}
              {contact.linkedin_url && (
                <a
                  href={contact.linkedin_url.startsWith('http') ? contact.linkedin_url : `https://${contact.linkedin_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> LinkedIn
                </a>
              )}
            </div>

            {contact.notes && (
              <p className="mt-4 text-sm text-slate-600 bg-slate-50 rounded-lg px-4 py-3 leading-relaxed border border-slate-100">
                {contact.notes}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* AI draft */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">AI Follow-up Draft</h2>
            <p className="text-xs text-slate-400 mt-0.5">Personalized from interaction history</p>
          </div>
          <button
            onClick={getDraft}
            disabled={drafting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: '#8b5cf6' }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {drafting ? 'Writing…' : 'Generate draft'}
          </button>
        </div>
        {aiDraft ? (
          <div className="rounded-lg px-4 py-3.5 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed border border-violet-100" style={{ background: '#faf5ff' }}>
            {aiDraft}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Click "Generate draft" to get a personalized follow-up message.</p>
        )}
      </div>

      {/* Interactions */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Interaction History</h2>
            <p className="text-xs text-slate-400 mt-0.5">{interactions.length} logged</p>
          </div>
          <button
            onClick={() => setShowLog(!showLog)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-opacity hover:opacity-90"
            style={{ background: '#6366f1' }}
          >
            <Plus className="w-3.5 h-3.5" /> Log interaction
          </button>
        </div>

        {showLog && (
          <div className="border border-slate-200 rounded-xl p-4 mb-5 space-y-3 bg-slate-50/50">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Type</label>
                <select
                  value={logType}
                  onChange={(e) => setLogType(e.target.value as InteractionType)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {Object.entries(INTERACTION_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Date</label>
                <input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Note (optional)</label>
              <textarea
                rows={2}
                placeholder="What did you talk about?"
                value={logNote}
                onChange={(e) => setLogNote(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowLog(false)} className="px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
              <button
                onClick={logInteraction}
                disabled={logging}
                className="px-3 py-1.5 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ background: '#6366f1' }}
              >
                {logging ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {interactions.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No interactions logged yet.</p>
        ) : (
          <ol className="space-y-3">
            {interactions.map((i) => (
              <li key={i.id} className="flex items-start gap-3">
                <div
                  className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                  style={{ background: INTERACTION_COLORS[i.type] }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: INTERACTION_COLORS[i.type] }}>
                      {INTERACTION_LABELS[i.type]}
                    </span>
                    <span className="text-xs text-slate-400">
                      {format(new Date(i.interaction_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                  {i.note && <p className="text-sm text-slate-600 mt-0.5">{i.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {showEdit && contact && (
        <EditContactModal
          contact={contact}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load() }}
        />
      )}
    </div>
  )
}
