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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('contacts').insert({
      user_id: user.id,
      name: form.name.trim(),
      company: form.company || null,
      role: form.role || null,
      linkedin_url: form.linkedin_url || null,
      email: form.email || null,
      notes: form.notes || null,
      source: 'manual',
      tags: [],
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Add contact</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
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
              <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
              <input
                type="text"
                placeholder={placeholder}
                value={form[field as keyof typeof form]}
                onChange={(e) => set(field, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!form.name.trim() || saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save contact'}
          </button>
        </div>
      </div>
    </div>
  )
}