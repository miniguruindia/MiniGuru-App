'use client'

// Ideas (Nov 2026): ideas children shared in the Idea Pool. Nothing to approve.
// Admin can only hide one (it disappears from the pool) or show it again.
import { useState, useEffect, useCallback } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import { RefreshCw } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

async function authToken() {
  const m = document.cookie.match(/(?:^|; )auth_token=([^;]*)/)
  return m ? decodeURIComponent(m[1]) : ''
}

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setBusy(true); setError(null)
    try {
      const token = await authToken()
      const r = await fetch(`${API_BASE}/admin/ideas`, { headers: { Authorization: `Bearer ${token}` } })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || `Could not load (${r.status})`)
      setIdeas(j.ideas || [])
    } catch (e: any) {
      setError(e?.message || 'Could not load')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function setStatus(id: string, status: 'hidden' | 'visible') {
    const token = await authToken()
    const r = await fetch(`${API_BASE}/admin/ideas/${id}/status`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (r.ok) setIdeas((x) => x.map((i) => (i.id === id ? { ...i, status } : i)))
    else setError('Could not change it. Please try again.')
  }

  const t = q.trim().toLowerCase()
  const rows = ideas.filter((i) => !t || `${i.title} ${i.code} ${i.makerName}`.toLowerCase().includes(t))

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">Ideas</h1>
            <p className="text-sm text-gray-500">Ideas shared by children. They are checked automatically, not by staff. Hide one if it should not be there.</p>
          </div>
          <button onClick={load} className="flex items-center gap-1 text-sm border rounded px-3 py-1.5">
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, ID or name"
          className="border rounded px-3 py-2 text-sm w-full max-w-sm" />
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr><th className="p-2">Idea</th><th className="p-2">ID</th><th className="p-2">Maker</th><th className="p-2">Tried</th><th className="p-2">Date</th><th className="p-2"></th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td className="p-3 text-gray-500" colSpan={6}>No ideas yet.</td></tr>}
              {rows.map((i) => (
                <tr key={i.id} className="border-t align-top">
                  <td className="p-2"><b>{i.title}</b><div className="text-gray-500 max-w-md">{String(i.description || '').slice(0, 140)}</div></td>
                  <td className="p-2 whitespace-nowrap">{i.code}</td>
                  <td className="p-2">{i.makerName}</td>
                  <td className="p-2">{i.tries}</td>
                  <td className="p-2 whitespace-nowrap">{new Date(i.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</td>
                  <td className="p-2">
                    {i.status === 'hidden'
                      ? <button onClick={() => setStatus(i.id, 'visible')} className="border rounded px-2 py-1 text-green-700">Show again</button>
                      : <button onClick={() => setStatus(i.id, 'hidden')} className="border rounded px-2 py-1 text-red-700">Hide</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </AdminLayout>
  )
}
