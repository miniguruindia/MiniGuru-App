'use client'

// Activity (Oct 2026): who is using MiniGuru, what they do, where sign-ups come from.
import { useState, useEffect, useCallback } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import { RefreshCw } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

async function authToken() {
  const m = document.cookie.match(/(?:^|; )auth_token=([^;]*)/)
  return m ? decodeURIComponent(m[1]) : ''
}

function dayText(iso: any) {
  if (!iso) return 'not yet'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export default function ActivityPage() {
  const [sum, setSum] = useState<any>(null)
  const [users, setUsers] = useState<any>(null)
  const [days, setDays] = useState<7 | 30>(7)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setBusy(true); setError(null)
    try {
      const token = await authToken()
      const h = { Authorization: `Bearer ${token}` }
      const [a, b] = await Promise.all([
        fetch(`${API_BASE}/admin/activity/summary`, { headers: h }),
        fetch(`${API_BASE}/admin/activity/users?days=${days}`, { headers: h }),
      ])
      const sa = await a.json().catch(() => ({}))
      const sb = await b.json().catch(() => ({}))
      if (!a.ok) throw new Error(sa.message || `Could not load (${a.status})`)
      setSum(sa)
      if (b.ok) setUsers(sb)
    } catch (e: any) {
      setError(e?.message || 'Could not load')
    } finally {
      setBusy(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  const maxWeek = sum ? Math.max(1, ...sum.weeks.map((w: any) => Math.max(w.active, w.signups))) : 1
  const maxFunnel = sum ? Math.max(1, ...sum.funnel.map((f: any) => f.count)) : 1
  const rows = (users?.active || []).filter((r: any) => {
    const t = q.trim().toLowerCase()
    return !t || r.name.toLowerCase().includes(t) || r.email.toLowerCase().includes(t)
  })

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Activity</h1>
            <p className="text-sm text-gray-500">Who is using MiniGuru, what they do, and where sign-ups come from.</p>
          </div>
          <button onClick={load} disabled={busy}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {error && <Card className="p-4 border-red-200 bg-red-50 text-sm text-red-700">{error}</Card>}
        {!sum && !error && <p className="text-sm text-gray-500">Loading…</p>}

        {sum && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                ['All accounts', sum.totals.total],
                ['New in 7 days', sum.totals.new7],
                ['New in 30 days', sum.totals.new30],
                ['Active today', sum.totals.active1],
                ['Active 7 days', sum.totals.active7],
                ['Active 30 days', sum.totals.active30],
              ].map(([label, n]: any) => (
                <Card key={label} className="p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">{n}</div>
                  <div className="text-xs text-gray-500">{label}</div>
                </Card>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              "Active today / 7 / 30 days" counts accounts that opened the app; it started on {dayText(sum.totals.trackingSince)}, so it
              grows from that day. The weekly numbers below use everything children did, so they go back 8 weeks.
            </p>

            <Card className="p-4">
              <h2 className="font-bold text-gray-900 mb-3">Week by week</h2>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500"><th className="py-1">Week of</th><th>New sign-ups</th><th>Active children</th><th className="w-1/2"></th></tr></thead>
                <tbody>
                  {sum.weeks.map((w: any) => (
                    <tr key={w.start} className="border-t border-gray-100">
                      <td className="py-1">{dayText(w.start)}</td>
                      <td>{w.signups}</td>
                      <td>{w.active}</td>
                      <td>
                        <div className="h-2 bg-blue-500 rounded" style={{ width: `${(w.active / maxWeek) * 100}%` }} />
                        <div className="h-2 bg-amber-400 rounded mt-0.5" style={{ width: `${(w.signups / maxWeek) * 100}%` }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-500 mt-2">Blue: active children. Yellow: new sign-ups.</p>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-4">
                <h2 className="font-bold text-gray-900 mb-1">Sign-up steps (joined in the last 30 days)</h2>
                <div className="space-y-2 mt-2">
                  {sum.funnel.map((f: any) => (
                    <div key={f.step}>
                      <div className="flex justify-between text-sm"><span>{f.step}</span><b>{f.count}</b></div>
                      <div className="h-2 bg-gray-100 rounded"><div className="h-2 bg-green-500 rounded" style={{ width: `${(f.count / maxFunnel) * 100}%` }} /></div>
                      {f.note && <div className="text-xs text-gray-400">{f.note}</div>}
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="p-4">
                <h2 className="font-bold text-gray-900 mb-1">Where sign-ups came from (30 days)</h2>
                <table className="w-full text-sm mt-2">
                  <tbody>
                    {sum.sources.map((s: any) => (
                      <tr key={s.source} className="border-t border-gray-100"><td className="py-1">{s.source}</td><td className="text-right font-bold">{s.count}</td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-gray-500 mt-2">
                  A link ending <code>?src=whatsapp</code> (or any short word) is counted under that word. No word means "direct".
                  Visitors who did not sign up are in Website Traffic on the Dashboard.
                </p>
              </Card>
            </div>

            <Card className="p-4">
              <h2 className="font-bold text-gray-900 mb-1">Shop lists sent to parents</h2>
              <p className="text-sm">
                Last 7 days: <b>{sum.shares.last7}</b> &nbsp; Last 30 days: <b>{sum.shares.last30}</b> &nbsp;
                Amazon value in those lists: <b>Rs {sum.shares.amazonValueLast30}</b>
              </p>
              {sum.shares.latest.length > 0 && (
                <table className="w-full text-sm mt-2">
                  <thead><tr className="text-left text-gray-500"><th>When</th><th>Sent by</th><th>Kind</th><th>Items</th><th>Amazon items</th><th>Amazon value</th></tr></thead>
                  <tbody>
                    {sum.shares.latest.map((s: any, i: number) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="py-1">{dayText(s.createdAt)}</td><td>{s.senderName || '-'}</td><td>{s.source}</td>
                        <td>{s.itemCount}</td><td>{s.amazonItems}</td><td>Rs {s.amazonValue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </>
        )}

        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h2 className="font-bold text-gray-900">What each child did</h2>
            <div className="flex items-center gap-2">
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or ID"
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
              {[7, 30].map(d => (
                <button key={d} onClick={() => setDays(d as 7 | 30)}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${days === d ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200'}`}>
                  {d} days
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500">
                <th className="py-1">Name</th><th>MiniGuru ID</th><th>Videos watched</th><th>Comments</th><th>Likes</th><th>Ratings</th><th>Projects</th><th>Goins earned</th><th>Last opened</th>
              </tr></thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.userId} className="border-t border-gray-100">
                    <td className="py-1">{r.name}</td><td className="text-gray-500">{r.email}</td>
                    <td>{r.views}</td><td>{r.comments}</td><td>{r.likes}</td><td>{r.ratings}</td><td>{r.projects}</td><td>{r.goins}</td>
                    <td>{dayText(r.lastActiveAt)}</td>
                  </tr>
                ))}
                {users && rows.length === 0 && <tr><td colSpan={9} className="py-3 text-gray-500">Nobody matches.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        {users && users.quiet.length > 0 && (
          <Card className="p-4">
            <h2 className="font-bold text-gray-900 mb-1">Gone quiet (not opened for 14 days or more)</h2>
            <p className="text-xs text-gray-500 mb-2">Only accounts seen since tracking started. A gentle note from a teacher or parent often brings them back.</p>
            <table className="w-full text-sm">
              <tbody>
                {users.quiet.map((r: any) => (
                  <tr key={r.userId} className="border-t border-gray-100">
                    <td className="py-1">{r.name}</td><td className="text-gray-500">{r.email}</td><td>{r.school || ''}</td><td className="text-right">last: {dayText(r.lastActiveAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </AdminLayout>
  )
}
