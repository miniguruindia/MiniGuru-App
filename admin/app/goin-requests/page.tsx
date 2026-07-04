'use client'

import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import { Coins, Check, X, RefreshCw, Loader2 } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

interface TopUpRequest {
  id: string
  requesterId: string
  requesterName: string
  amount: number
  reason: string | null
  projectDraftContext: string | null
  status: string
  createdAt: string
}

async function authHeader() {
  const v = `; ${document.cookie}`
  const p = v.split('; auth_token=')
  const token = p.length === 2 ? p.pop()!.split(';').shift()! : ''
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

export default function GoinRequestsPage() {
  const [requests, setRequests] = useState<TopUpRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/goins/admin/topup/pending`, { headers: await authHeader() })
      const data = await res.json()
      setRequests(Array.isArray(data.requests) ? data.requests : [])
    } catch (e) {
      console.error('Failed to load requests', e)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const decide = async (id: string, approve: boolean) => {
    setActingId(id)
    try {
      const action = approve ? 'approve' : 'deny'
      const res = await fetch(`${API_BASE}/goins/admin/topup/${id}/${action}`, {
        method: 'POST',
        headers: await authHeader(),
        body: JSON.stringify({}),
      })
      if (res.ok) {
        setRequests(prev => prev.filter(r => r.id !== id))
      } else {
        alert('Action failed — please try again.')
      }
    } catch (e) {
      alert('Network error — please try again.')
    } finally {
      setActingId(null)
    }
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Coins className="w-6 h-6 text-amber-500" />
            <h1 className="text-2xl font-bold">Goin Top-Up Requests</h1>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : requests.length === 0 ? (
          <Card className="p-8 text-center text-gray-500">
            No pending requests. All caught up! 🎉
          </Card>
        ) : (
          <div className="space-y-3">
            {requests.map(r => (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-gray-900">{r.requesterName}</div>
                    <div className="text-amber-600 font-bold text-lg">+{r.amount} Goins</div>
                    {r.projectDraftContext && (
                      <div className="text-sm text-gray-500 mt-1">
                        For: {r.projectDraftContext}
                      </div>
                    )}
                    {r.reason && (
                      <div className="text-sm text-gray-400 mt-0.5">{r.reason}</div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(r.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => decide(r.id, true)}
                      disabled={actingId === r.id}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 text-sm font-medium"
                    >
                      <Check className="w-4 h-4" /> Approve
                    </button>
                    <button
                      onClick={() => decide(r.id, false)}
                      disabled={actingId === r.id}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 text-sm font-medium"
                    >
                      <X className="w-4 h-4" /> Deny
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}