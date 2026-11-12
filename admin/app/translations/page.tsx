'use client'

// Hindi words (Nov 2026). The app ships with machine-translated Hindi. Anyone can suggest a better word from the About page;
// nothing goes live until it is approved here. Approved words override the built-in Hindi within about 5 minutes.
import { useState, useEffect, useCallback } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import { RefreshCw } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

async function authToken() {
  const m = document.cookie.match(/(?:^|; )auth_token=([^;]*)/)
  return m ? decodeURIComponent(m[1]) : ''
}

export default function TranslationsPage() {
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [live, setLive] = useState<any[]>([])
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setBusy(true); setError(null)
    try {
      const token = await authToken()
      const h = { Authorization: `Bearer ${token}` }
      const [a, b] = await Promise.all([
        fetch(`${API_BASE}/admin/translations/suggestions?status=pending`, { headers: h }),
        fetch(`${API_BASE}/admin/translations`, { headers: h }),
      ])
      const ja = await a.json().catch(() => ({}))
      const jb = await b.json().catch(() => ({}))
      if (!a.ok) throw new Error(ja.error || `Could not load (${a.status})`)
      setSuggestions(ja.suggestions || [])
      setLive(jb.translations || [])
    } catch (e: any) {
      setError(e?.message || 'Could not load')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function act(path: string, method: string, body?: any) {
    const token = await authToken()
    const r = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      setError(j.error || 'Could not do that. Please try again.')
      return
    }
    load()
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">Hindi words</h1>
            <p className="text-sm text-gray-500">
              Better Hindi words suggested by teachers, parents or children. Nothing changes in the app until you approve it.
              Approved words show in the app within about 5 minutes.
            </p>
          </div>
          <button onClick={load} className="flex items-center gap-1 text-sm border rounded px-3 py-1.5">
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}

        <div>
          <h2 className="font-semibold mb-2">Waiting for your decision ({suggestions.length})</h2>
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr><th className="p-2">English (in the app)</th><th className="p-2">Suggested Hindi (you can edit)</th><th className="p-2">From</th><th className="p-2"></th></tr>
              </thead>
              <tbody>
                {suggestions.length === 0 && <tr><td className="p-3 text-gray-500" colSpan={4}>No suggestions waiting.</td></tr>}
                {suggestions.map((s) => (
                  <tr key={s.id} className="border-t align-top">
                    <td className="p-2 max-w-xs">{s.key}</td>
                    <td className="p-2">
                      <input
                        value={edits[s.id] ?? s.suggestion}
                        onChange={(e) => setEdits((x) => ({ ...x, [s.id]: e.target.value }))}
                        className="border rounded px-2 py-1 w-full min-w-[16rem]"
                      />
                    </td>
                    <td className="p-2 whitespace-nowrap text-gray-500">
                      {s.screen || '-'}<div>{new Date(s.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</div>
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <button onClick={() => act(`/admin/translations/suggestions/${s.id}/approve`, 'POST', { hi: edits[s.id] ?? s.suggestion })}
                        className="border rounded px-2 py-1 text-green-700 mr-2">Approve</button>
                      <button onClick={() => act(`/admin/translations/suggestions/${s.id}/reject`, 'POST')}
                        className="border rounded px-2 py-1 text-red-700">Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div>
          <h2 className="font-semibold mb-2">Approved words now live ({live.length})</h2>
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr><th className="p-2">English</th><th className="p-2">Hindi</th><th className="p-2"></th></tr>
              </thead>
              <tbody>
                {live.length === 0 && <tr><td className="p-3 text-gray-500" colSpan={3}>None yet. The built-in Hindi is being used.</td></tr>}
                {live.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="p-2">{t.key}</td>
                    <td className="p-2">{t.hi}</td>
                    <td className="p-2">
                      <button onClick={() => act(`/admin/translations/${t.id}`, 'DELETE')} className="border rounded px-2 py-1 text-red-700">Undo</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}
