'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef } from 'react'
import { Upload, CheckCircle, AlertCircle, Info } from 'lucide-react'

interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
  enriching: number
}

export default function ImportPage() {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [enrich, setEnrich] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file.')
      return
    }
    setError('')
    setResult(null)
    setUploading(true)

    const text = await file.text()
    const res = await fetch('/api/import/linkedin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: text, enrich }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Import failed.')
    } else {
      setResult(data)
    }
    setUploading(false)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Import from LinkedIn</h1>
      <p className="text-sm text-gray-500 mb-8">
        Export your LinkedIn connections and upload the CSV here to bulk-import your network.
      </p>

      {/* Enrich toggle */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-800">Auto-enrich imported contacts</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Fill in missing emails via Hunter.io · Free tier: 25 lookups/month
          </p>
        </div>
        <button
          onClick={() => setEnrich((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            enrich ? 'bg-blue-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              enrich ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 space-y-1">
          <p className="font-medium">How to export your LinkedIn connections:</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-700">
            <li>Go to LinkedIn → Me → Settings &amp; Privacy</li>
            <li>Data Privacy → Get a copy of your data</li>
            <li>Select "Connections" and request the archive</li>
            <li>Download and upload <strong>Connections.csv</strong> here</li>
          </ol>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
      >
        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-700">Drop your Connections.csv here</p>
        <p className="text-xs text-gray-400 mt-1">or click to browse</p>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
      </div>

      {uploading && (
        <div className="mt-6 text-center text-sm text-gray-500">
          Importing contacts… this may take a moment.
        </div>
      )}

      {error && (
        <div className="mt-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-6 bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
            <h2 className="font-semibold text-gray-900">Import complete</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-emerald-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{result.imported}</p>
              <p className="text-xs text-emerald-600 mt-0.5">contacts imported</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-600">{result.skipped}</p>
              <p className="text-xs text-gray-500 mt-0.5">already existed</p>
            </div>
          </div>
          {result.enriching > 0 && (
            <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm text-blue-700 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Enriching {result.enriching} contacts in the background — results will appear shortly.
            </div>
          )}
          {result.errors.length > 0 && (
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer hover:text-gray-700">{result.errors.length} rows skipped due to errors</summary>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}