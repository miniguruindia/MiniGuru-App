'use client'

import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import { ShieldAlert, Check, X, Loader2 } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

interface ChangeRequest {
  id: string
  name: string
  email: string
  guardianEmail: string | null
  phoneNumber: string | null
  pendingEmail: string | null
  pendingPhone: string | null
  contactChangeApprovalFor: 'email' | 'phone'
  contactChangeRequestedAt: string | null
}

async function authToken() {
  const m = document.cookie.match(/(?:^|; )auth_token=([^;]*)/)
  return m ? decodeURIComponent(m[1]) : ''
}

export default function ContactChangeRequestsPage() {
  const [requests, setRequests] = useState<ChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const token = await authToken()
      const res = await fetch(`${API_BASE}/admin/contact-change-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setRequests(Array.isArray(data.requests) ? data.requests : [])
    } catch {
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const act = async (userId: string, action: 'approve' | 'reject') => {
    setBusyId(userId)
    try {
      const token = await authToken()
      await fetch(`${API_BASE}/admin/contact-change-requests/${userId}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="w-6 h-6 text-amber-500" />
          <h1 className="text-2xl font-bold text-gray-900">Contact Change Requests</h1>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          These only show up when someone tried to change a <strong>verified</strong> email or phone but
          couldn't confirm it via their old contact (lost phone, old email gone, or no SMS support for
          phone yet). Approving here applies the change directly — the new contact starts unverified again.
        </p>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
        ) : requests.length === 0 ? (
          <Card className="p-10 text-center text-gray-400">No pending requests.</Card>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900">{r.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Wants to change <strong>{r.contactChangeApprovalFor}</strong> from{' '}
                      <span className="font-mono">
                        {r.contactChangeApprovalFor === 'email' ? (r.guardianEmail || r.email) : r.phoneNumber}
                      </span>{' '}
                      to{' '}
                      <span className="font-mono text-indigo-700">
                        {r.contactChangeApprovalFor === 'email' ? r.pendingEmail : r.pendingPhone}
                      </span>
                    </p>
                    {r.contactChangeRequestedAt && (
                      <p className="text-xs text-gray-400 mt-1">
                        Requested {new Date(r.contactChangeRequestedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      disabled={busyId === r.id}
                      onClick={() => act(r.id, 'approve')}
                      className="text-xs px-3 py-1.5 rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Approve
                    </button>
                    <button
                      disabled={busyId === r.id}
                      onClick={() => act(r.id, 'reject')}
                      className="text-xs px-3 py-1.5 rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Reject
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