'use client'

// Duplicate materials finder (Nov 2026). Lists items with the same Amazon ASIN or the same name.
// For each pair/group: hide one, make one a variant of another, or keep both.
import { useState, useEffect, useCallback } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import { RefreshCw } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

async function authToken() {
  const m = document.cookie.match(/(?:^|; )auth_token=([^;]*)/)
  return m ? decodeURIComponent(m[1]) : ''
}

export default function DuplicatesPage() {
  const [groups, setGroups] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [kept, setKept] = useState<string[]>([])

  const load = useCallback(async () => {
    setBusy(true); setMsg(null)
    try {
      const token = await authToken()
      const r = await fetch(`${API_BASE}/materials/admin/duplicates`, { headers: { Authorization: `Bearer ${token}` } })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || `Could not load (${r.status})`)
      setGroups(j.groups || [])
    } catch (e: any) {
      setMsg(e?.message || 'Could not load')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    try { setKept(JSON.parse(localStorage.getItem('dupKept') || '[]')) } catch { /* ignore */ }
    load()
  }, [load])

  async function put(id: string, body: any) {
    const token = await authToken()
    const r = await fetch(`${API_BASE}/materials/admin/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setMsg(j.error || 'Could not save that change.'); return false }
    return true
  }

  async function hide(id: string, name: string) {
    if (!confirm(`Hide "${name}" from the Shop and planning?`)) return
    if (await put(id, { isActive: false })) { setMsg(`"${name}" hidden.`); load() }
  }
  async function makeVariant(id: string, headId: string, name: string, head: string) {
    if (!confirm(`Make "${name}" a variant of "${head}"?`)) return
    if (await put(id, { variantOf: headId })) { setMsg(`"${name}" is now a variant of "${head}".`); load() }
  }
  function keepBoth(key: string) {
    const next = [...kept, key]
    setKept(next)
    try { localStorage.setItem('dupKept', JSON.stringify(next)) } catch { /* ignore */ }
  }

  const shown = groups.filter((g) => !kept.includes(g.items.map((i: any) => i.id).sort().join(',')))

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">Duplicate materials</h1>
            <p className="text-sm text-gray-500">Items with the same Amazon ASIN or the same name. Nothing changes until you press a button.</p>
          </div>
          <div className="flex gap-2">
            <a href="/materials" className="text-sm border rounded px-3 py-1.5">Back to Materials</a>
            <button onClick={load} className="flex items-center gap-1 text-sm border rounded px-3 py-1.5">
              <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>
        {msg && <div className="text-sm p-2 bg-blue-50 border border-blue-200 rounded">{msg}</div>}
        {shown.length === 0 && !busy && <Card className="p-4 text-sm text-gray-600">No duplicates found. 🎉</Card>}
        {shown.map((g, gi) => {
          const key = g.items.map((i: any) => i.id).sort().join(',')
          return (
            <Card key={gi} className="p-3 space-y-2">
              <div className="text-sm font-semibold">{g.reason}</div>
              {g.items.map((it: any) => (
                <div key={it.id} className="flex items-center gap-3 border-t pt-2 text-sm flex-wrap">
                  {it.imageUrl ? <img src={it.imageUrl} alt="" className="h-10 w-10 object-cover rounded" /> : <div className="h-10 w-10 bg-gray-100 rounded" />}
                  <div className="flex-1 min-w-[180px]">
                    <b>{it.name}</b>
                    <div className="text-gray-500">{it.category} · {it.goinsPrice} Goins{it.amazonASIN ? ` · ${it.amazonASIN}` : ''}{it.variantOf ? ' · already a variant' : ''}</div>
                  </div>
                  <button onClick={() => hide(it.id, it.name)} className="border rounded px-2 py-1 text-red-700">Hide this</button>
                  {!it.variantOf && g.items.filter((o: any) => o.id !== it.id && !o.variantOf).slice(0, 1).map((o: any) => (
                    <button key={o.id} onClick={() => makeVariant(it.id, o.id, it.name, o.name)} className="border rounded px-2 py-1">
                      Make variant of “{o.name.slice(0, 24)}”
                    </button>
                  ))}
                </div>
              ))}
              <div><button onClick={() => keepBoth(key)} className="text-sm text-gray-600 underline">Keep both, stop showing this</button></div>
            </Card>
          )
        })}
      </div>
    </AdminLayout>
  )
}
