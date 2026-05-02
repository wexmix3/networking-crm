'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import type { DigestPreferences } from '@/types'
import { Pencil, Trash2, Check, X } from 'lucide-react'

interface TagEntry { tag: string; count: number }

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function SettingsPage() {
  const supabase = createBrowserSupabaseClient()
  const [prefs, setPrefs] = useState<Partial<DigestPreferences>>({
    digest_enabled: true,
    digest_day: 1,
    stale_threshold_days: 30,
  })
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  // Tag management
  const [tags, setTags] = useState<TagEntry[]>([])
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [tagSaving, setTagSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setEmail(user.email ?? '')
    const { data } = await supabase.from('crm_digest_preferences').select('*').eq('user_id', user.id).maybeSingle()
    if (data) setPrefs(data)
    setLoading(false)
    loadTags()
  }

  async function loadTags() {
    const res = await fetch('/api/tags')
    const { tags: t } = await res.json()
    setTags(t ?? [])
  }

  async function renameTag(from: string, to: string) {
    setTagSaving(true)
    await fetch('/api/tags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to }),
    })
    setEditingTag(null)
    setTagSaving(false)
    loadTags()
  }

  async function deleteTag(tag: string) {
    if (!confirm(`Remove tag "${tag}" from all contacts?`)) return
    await fetch('/api/tags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: tag, to: '' }),
    })
    loadTags()
  }

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('crm_digest_preferences').upsert({
      user_id: user.id,
      email: email || user.email,
      digest_enabled: prefs.digest_enabled,
      digest_day: prefs.digest_day,
      stale_threshold_days: prefs.stale_threshold_days,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>

  return (
    <div className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Settings</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <div>
          <h2 className="font-semibold text-gray-900 mb-4">Weekly Digest Email</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.digest_enabled ?? true}
                onChange={(e) => setPrefs((p) => ({ ...p, digest_enabled: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Send me a weekly digest email</span>
            </label>

            {prefs.digest_enabled && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Digest email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Send digest on</label>
                  <select
                    value={prefs.digest_day ?? 1}
                    onChange={(e) => setPrefs((p) => ({ ...p, digest_day: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        <div>
          <h2 className="font-semibold text-gray-900 mb-4">Staleness Threshold</h2>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Mark contacts as stale after
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={7}
                max={365}
                value={prefs.stale_threshold_days ?? 30}
                onChange={(e) => setPrefs((p) => ({ ...p, stale_threshold_days: Number(e.target.value) }))}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-500">days without contact</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mt-6">
          <div className="mb-4">
            <h2 className="font-semibold text-slate-900">Tag Management</h2>
            <p className="text-xs text-slate-400 mt-0.5">Rename or delete tags across all contacts at once</p>
          </div>
          <ul className="space-y-2">
            {tags.map(({ tag, count }) => (
              <li key={tag} className="flex items-center gap-3 group">
                {editingTag === tag ? (
                  <>
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') renameTag(tag, editValue.trim())
                        if (e.key === 'Escape') setEditingTag(null)
                      }}
                      className="flex-1 px-2.5 py-1.5 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      onClick={() => renameTag(tag, editValue.trim())}
                      disabled={tagSaving || !editValue.trim()}
                      className="text-emerald-500 hover:text-emerald-700 disabled:opacity-40"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingTag(null)} className="text-slate-300 hover:text-slate-500">
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 inline-flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">
                        {tag}
                      </span>
                      <span className="text-xs text-slate-400">{count} contact{count !== 1 ? 's' : ''}</span>
                    </span>
                    <button
                      onClick={() => { setEditingTag(tag); setEditValue(tag) }}
                      className="text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Rename tag"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteTag(tag)}
                      className="text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete tag from all contacts"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}