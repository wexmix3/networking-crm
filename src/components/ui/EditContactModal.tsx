'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { Contact } from '@/types'

interface Props {
  contact: Contact
  onClose: () => void
  onSaved: () => void
}

export default function EditContactModal({ contact, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: contact.name ?? '',
    company: contact.company ?? '',
    role: contact.role ?? '',
    linkedin_url: contact.linkedin_url ?? '',
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    notes: contact.notes ?? '',
    follow_up_date: contact.follow_up_date ?? '',
  })

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    await fetch(`/api/contacts/${contact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        company: form.company || null,
        role: form.role || null,
        linkedin_url: form.linkedin_url || null,
        email: form.email || null,
        phone: form.phone || null,
        notes: form.notes || null,
        follow_up_date: form.follow_up_date || null,
      }),
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Edit contact</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {[
            { label: 'Name *', field: 'name', placeholder: 'Jane Smith' },
            { label: 'Company', field: 'company', placeholder: 'Acme Corp' },
            { label: 'Role', field: 'role', placeholder: 'VP of Finance' },
            { label: 'Email', field: 'email', placeholder: 'jane@acme.com' },
            { label: 'Phone', field: 'phone', placeholder: '+1 555 000 0000' },
            { label: 'LinkedIn URL', field: 'linkedin_url', placeholder: 'linkedin.com/in/…' },
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
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Follow-up reminder</label>
            <input
              type="date"
              value={form.follow_up_date}
              onChange={(e) => set('follow_up_date', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Notes</label>
            <textarea
              rows={3}
              placeholder="Context, how you met, topics discussed…"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!form.name.trim() || saving}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
