'use client'

import { useState, useEffect, useCallback } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, Mail, Sparkles, Youtube, Database, HardDrive, ExternalLink, AlertTriangle } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

async function authToken() {
  const m = document.cookie.match(/(?:^|; )auth_token=([^;]*)/)
  return m ? decodeURIComponent(m[1]) : ''
}

interface Snapshot {
  email: {
    provider: string
    sentToday: number
    dailyLimit: number
    cutoffAt: number
    monthlyLimit: number
    currentlyBlocked: boolean
  }
  gemini: { callsToday: number; note: string }
  youtube: { estimatedUnitsToday: number; dailyLimit: number; authoritative: boolean; note: string }
  mongodb: { usedMB: number | null; limitMB: number; checkedLive: boolean }
  firebaseStorage: { usedGB: number | null; limitGB: number; cached: boolean; error?: string }
  gcpConsoleOnly: { note: string }
}

function Bar({ used, limit, dangerAt = 0.85 }: { used: number; limit: number; dangerAt?: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const color = pct / 100 >= dangerAt ? 'bg-red-500' : pct / 100 >= 0.6 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
      <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function QuotaCard({
  icon: Icon, title, used, limit, unit, note, blocked, subtitle,
}: {
  icon: any; title: string; used: number | null; limit: number; unit: string
  note?: string; blocked?: boolean; subtitle?: string
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-500" />
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        {blocked && (
          <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" /> Blocked today
          </span>
        )}
      </div>
      <div className="mt-3">
        <span className="text-2xl font-bold">{used ?? '—'}</span>
        <span className="text-sm text-gray-400"> / {limit} {unit}</span>
      </div>
      {used != null && <Bar used={used} limit={limit} />}
      {subtitle && <p className="text-xs text-gray-500 mt-2">{subtitle}</p>}
      {note && <p className="text-xs text-gray-400 mt-1 italic">{note}</p>}
    </Card>
  )
}

export default function CostDashboardPage() {
  const [data, setData] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await authToken()
      const res = await fetch(`${API_BASE}/admin/cost-dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e: any) {
      setError(e?.message || 'Could not load cost dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Cost & Quota Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">
              Live usage against every free-tier ceiling MiniGuru depends on.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <Card className="p-4 mb-6 bg-red-50 border-red-200 text-red-700 text-sm">{error}</Card>
        )}

        {data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <QuotaCard
                icon={Mail}
                title={`Email (${data.email.provider})`}
                used={data.email.sentToday}
                limit={data.email.dailyLimit}
                unit="today"
                blocked={data.email.currentlyBlocked}
                subtitle={`Sending auto-stops at ${data.email.cutoffAt}/day, resumes automatically at midnight. Monthly cap: ${data.email.monthlyLimit}.`}
              />
              <QuotaCard
                icon={Sparkles}
                title="Gemini AI Video Review"
                used={data.gemini.callsToday}
                limit={1450}
                unit="today"
                note={data.gemini.note}
              />
              <QuotaCard
                icon={Youtube}
                title="YouTube Data API v3"
                used={data.youtube.estimatedUnitsToday}
                limit={data.youtube.dailyLimit}
                unit="units (estimated)"
                note={data.youtube.note}
              />
              <QuotaCard
                icon={Database}
                title="MongoDB Atlas Storage"
                used={data.mongodb.usedMB}
                limit={data.mongodb.limitMB}
                unit="MB"
                subtitle={data.mongodb.checkedLive ? 'Checked live via db.stats().' : 'Could not reach the database for a live check.'}
              />
              <QuotaCard
                icon={HardDrive}
                title="Firebase Storage"
                used={data.firebaseStorage.usedGB}
                limit={data.firebaseStorage.limitGB}
                unit="GB"
                subtitle={data.firebaseStorage.error || (data.firebaseStorage.cached ? 'Cached (refreshed every 15 min).' : 'Checked live.')}
              />
            </div>

            <Card className="p-5 mt-4 bg-gray-50 border-dashed">
              <div className="flex items-center gap-2 mb-1">
                <ExternalLink className="w-4 h-4 text-gray-500" />
                <h3 className="font-semibold text-sm">Cloud Run & Artifact Registry</h3>
              </div>
              <p className="text-xs text-gray-500">{data.gcpConsoleOnly.note}</p>
              <a
                href="https://console.cloud.google.com/billing"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline mt-2 inline-block"
              >
                Open GCP Billing Console →
              </a>
            </Card>
          </>
        )}

        {loading && !data && (
          <Card className="p-8 text-center text-gray-400 text-sm">Loading...</Card>
        )}
      </div>
    </AdminLayout>
  )
}
