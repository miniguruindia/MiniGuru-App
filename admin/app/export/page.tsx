"use client"

import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import { Download, AlertCircle, CheckCircle, Loader2, ShieldCheck } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

function token() {
  const m = document.cookie.match(/(?:^|; )auth_token=([^;]*)/)
  return m ? decodeURIComponent(m[1]) : ''
}

interface Dataset { key: string; label: string; description: string }

// Downloads one file: the login token must travel with the request, so the file is
// fetched first and then handed to the browser as a download.
async function downloadCsv(key: string) {
  const res = await fetch(`${API_BASE}/admin/export/${key}`, { headers: { Authorization: `Bearer ${token()}` } })
  if (!res.ok) throw new Error('Download failed')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const day = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)
  a.href = url
  a.download = `miniguru-${key}-${day}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export default function ExportPage() {
  const [sets, setSets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/admin/export`, { headers: { Authorization: `Bearer ${token()}` } })
        if (!r.ok) throw new Error()
        const d = await r.json()
        setSets(d.datasets || [])
      } catch { setErr('Could not load the list. Please refresh.') }
      finally { setLoading(false) }
    })()
  }, [])

  const one = async (key: string, label: string) => {
    setBusy(key); setMsg(''); setErr('')
    try { await downloadCsv(key); setMsg(`Downloaded: ${label}`) }
    catch { setErr(`Could not download ${label}. Please try again.`) }
    finally { setBusy(null) }
  }

  const all = async () => {
    setBusy('all'); setMsg(''); setErr('')
    try {
      for (const s of sets) { await downloadCsv(s.key); await new Promise(r => setTimeout(r, 700)) }
      setMsg('All files downloaded. If your browser asked, allow multiple downloads.')
    } catch { setErr('One of the downloads failed. Please try again.') }
    finally { setBusy(null) }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Export</h1>
          <p className="text-sm text-gray-500 mt-1">Download MiniGuru data as spreadsheet files (CSV). They open in Excel and Google Sheets.</p>
        </div>

        <Card className="p-4 flex items-start gap-3 text-sm text-gray-600">
          <ShieldCheck className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            Passwords, PINs, login tokens and verification codes are <b>never</b> included. These files contain children&apos;s and parents&apos; personal details,
            so keep them on a private device, do not share them in chats or open links, and delete them when you no longer need them.
            This is a readable copy for your records. It does not replace the full backup.
          </div>
        </Card>

        {msg && <div className="flex items-center gap-2 p-4 rounded-lg text-sm border bg-green-50 border-green-200 text-green-700"><CheckCircle className="h-4 w-4" />{msg}</div>}
        {err && <div className="flex items-center gap-2 p-4 rounded-lg text-sm border bg-red-50 border-red-200 text-red-700"><AlertCircle className="h-4 w-4" />{err}</div>}

        {loading ? (
          <div className="text-center text-sm text-gray-400 py-12">Loading…</div>
        ) : (
          <>
            <div>
              <button onClick={all} disabled={busy !== null || sets.length === 0}
                className="px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {busy === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download everything ({sets.length} files)
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {sets.map(s => (
                <Card key={s.key} className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900">{s.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{s.description}</div>
                  </div>
                  <button onClick={() => one(s.key, s.label)} disabled={busy !== null}
                    className="text-xs px-3 py-1.5 rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 flex items-center gap-1 shrink-0">
                    {busy === s.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} Download
                  </button>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
