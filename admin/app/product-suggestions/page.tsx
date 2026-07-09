'use client'

import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import { Lightbulb, Check, X, Package, Loader2 } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

interface Suggestion {
  id: string
  childName: string | null
  suggestion: string
  category: string | null
  requestedGoinsPrice: number | null
  status: 'pending' | 'approved' | 'added' | 'rejected'
  adminNotes: string | null
  resolvedMaterialId: string | null
  createdAt: string
}

async function authToken() {
  const m = document.cookie.match(/(?:^|; )auth_token=([^;]*)/)
  return m ? decodeURIComponent(m[1]) : ''
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  added: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
}

export default function ProductSuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'added' | 'rejected'>('pending')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({})

  const load = async () => {
    setLoading(true)
    try {
      const token = await authToken()
      const qs = filter === 'all' ? '' : `?status=${filter}`
      const res = await fetch(`${API_BASE}/admin/product-suggestions${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filter])

  const resolve = async (id: string, status: Suggestion['status']) => {
    setBusyId(id)
    try {
      const token = await authToken()
      await fetch(`${API_BASE}/admin/product-suggestions/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNotes: notesDraft[id] ?? undefined }),
      })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-2 mb-1">
          <Lightbulb className="w-6 h-6 text-amber-500" />
          <h1 className="text-2xl font-bold text-gray-900">Product Suggestions</h1>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Materials children asked for that don't exist yet — from the shop's suggestion box and the
          material picker's "Add your own item" custom material flow.
        </p>

        <div className="flex gap-2 mb-5">
          {(['pending', 'approved', 'added', 'rejected', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border capitalize ${
                filter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
        ) : suggestions.length === 0 ? (
          <Card className="p-10 text-center text-gray-400">Nothing here.</Card>
        ) : (
          <div className="space-y-3">
            {suggestions.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{s.suggestion}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${STATUS_STYLES[s.status]}`}>
                        {s.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {s.childName ? `Suggested by ${s.childName}` : 'Anonymous'}
                      {s.category ? ` · ${s.category}` : ''} · {new Date(s.createdAt).toLocaleDateString()}
                    </p>
                    {s.adminNotes && <p className="text-xs text-gray-400 mt-1">Note: {s.adminNotes}</p>}
                    {s.status === 'pending' || s.status === 'approved' ? (
                      <input
                        type="text"
                        placeholder="Admin note (optional)"
                        defaultValue={s.adminNotes || ''}
                        onChange={(e) => setNotesDraft((d) => ({ ...d, [s.id]: e.target.value }))}
                        className="mt-2 w-full px-2 py-1 text-xs border border-gray-200 rounded"
                      />
                    ) : null}
                  </div>
                  {(s.status === 'pending' || s.status === 'approved') && (
                    <div className="flex flex-col gap-1 shrink-0">
                      {s.status === 'pending' && (
                        <button
                          disabled={busyId === s.id}
                          onClick={() => resolve(s.id, 'approved')}
                          className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                        >
                          Mark approved
                        </button>
                      )}
                      <button
                        disabled={busyId === s.id}
                        onClick={() => resolve(s.id, 'added')}
                        className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" /> Mark added
                      </button>
                      <button
                        disabled={busyId === s.id}
                        onClick={() => resolve(s.id, 'rejected')}
                        className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-4">
          "Mark added" doesn't create the Material for you — add it normally via the Materials page
          first (with an Amazon ASIN if relevant), then come back and mark the suggestion as added.
        </p>
      </div>
    </AdminLayout>
  )
}