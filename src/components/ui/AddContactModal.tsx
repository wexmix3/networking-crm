'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase'

interface Props {
  onClose: () => void
  onSaved: () => void
}

export default function AddContactModal({ onClose, onSaved }: Props) {
  const supabase = createBrowserSupabaseClient()
  const [saving, setSaving] = useState(false)
  const [enrich, setEnrich] = useState(false)
  const [form, setForm] = useState({
    name: '',
    company: '',
    role: '',
    linkedin_url: '',
    email: '',
    notes: '',
  })

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        company: form.company || null,
        role: form.role || null,
        linkedin_url: form.linkedin_url || null,
        email: form.email || null,
        notes: form.notes || null,
        source: 'manual',
        tags: [],
        enrich,
      }),
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Add contact</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {[
            { label: 'Name *', field: 'name', placeholder: 'Jane Smith' },
            { label: 'Company', field: 'company', placeholder: 'Acme Corp' },
            { label: 'Role', field: 'role', placeholder: 'VP of Finance' },
            { label: 'LinkedIn URL', field: 'linkedin_url', placeholder: 'linkedin.com/in/…' },
            { label: 'Email', field: 'email', placeholder: 'jane@acme.com' },
          ].map(({ label, field, placeholder }) => (
            <div key={field}>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
              <input
                type="text"
                placeholder={placeholder}
                value={form[field as keyof typeof form]}
                onChange={(e) => set(field, e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              rows={3}
              placeholder="How you met, context, etc."
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
            />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={enrich}
              onChange={(e) => setEnrich(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="text-xs font-medium text-gray-700">Auto-enrich with Apollo</span>
              <span className="text-xs text-gray-400 ml-1">(fills email, phone, LinkedIn)</span>
            </div>
          </label>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!form.name.trim() || saving}
            className="px-4 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: '#6366f1' }}
          >
            {saving ? 'Saving…' : 'Save contact'}
          </button>
        </div>
      </div>
    </div>
  )
}