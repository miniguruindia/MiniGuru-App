'use client'

import React, { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import { RefreshCw, CheckCircle, XCircle, Eye } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

interface ProjectUser { id: string; name: string; email: string }
interface ProjectCategory { id: string; name: string }
interface PendingProject {
  id: string; title: string; description: string; status: string
  thumbnail: string; video: { url: string; uploadedAt?: string }
  user: ProjectUser; category: ProjectCategory | null; createdAt: string
}

async function authHeader() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') || '' : ''
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

const MOCK_PROJECTS: PendingProject[] = [
  {
    id: 'm1', title: 'Solar Powered Robot',
    description: 'A robot that runs on solar energy using servo motors.',
    status: 'pending', thumbnail: '',
    video: { url: 'https://youtube.com/watch?v=demo1' },
    user: { id: 'u1', name: 'Arjun Kumar', email: 'arjun@test.com' },
    category: { id: 'c1', name: 'Robotics' }, createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'm2', title: 'Paper Bridge Challenge',
    description: 'Engineering a bridge made of newspaper.',
    status: 'pending', thumbnail: '',
    video: { url: 'https://youtube.com/watch?v=demo2' },
    user: { id: 'u2', name: 'Priya Sharma', email: 'priya@test.com' },
    category: { id: 'c2', name: 'Mechanics' }, createdAt: '2026-01-18T09:00:00Z',
  },
  {
    id: 'm3', title: 'Volcano Experiment',
    description: 'Classic baking soda and vinegar volcano.',
    status: 'pending', thumbnail: '', video: { url: '' },
    user: { id: 'u3', name: 'Ravi Patel', email: 'ravi@test.com' },
    category: { id: 'c3', name: 'Science' }, createdAt: '2026-01-20T11:00:00Z',
  },
]

export default function VideoApprovalsPage() {
  const [projects, setProjects]         = useState<PendingProject[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<PendingProject | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [deleteFromYT, setDeleteFromYT] = useState(false)
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API_BASE}/admin/projects/pending`, { headers: await authHeader() })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      setProjects(Array.isArray(data) ? data : data.projects ?? [])
    } catch {
      setError('Backend not connected — showing sample data')
      setProjects(MOCK_PROJECTS)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const approve = async (id: string) => {
    if (!confirm('Approve this project and publish to YouTube?')) return
    setProcessingId(id)
    try {
      const res = await fetch(`${API_BASE}/admin/projects/${id}/approve`, {
        method: 'POST', headers: await authHeader(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed')
      showToast('Project approved and published on YouTube!')
      setProjects(prev => prev.filter(p => p.id !== id))
    } catch (e: any) {
      showToast(e.message || 'Approval failed', false)
    } finally { setProcessingId(null) }
  }

  const reject = async () => {
    if (!rejectTarget) return
    setProcessingId(rejectTarget.id)
    try {
      const res = await fetch(
        `${API_BASE}/admin/projects/${rejectTarget.id}/reject?deleteFromYoutube=${deleteFromYT}`,
        { method: 'POST', headers: await authHeader(), body: JSON.stringify({ reason: rejectReason }) }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed')
      showToast('Project rejected.')
      setProjects(prev => prev.filter(p => p.id !== rejectTarget.id))
      setRejectTarget(null); setRejectReason(''); setDeleteFromYT(false)
    } catch (e: any) {
      showToast(e.message || 'Rejection failed', false)
    } finally { setProcessingId(null) }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">

        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${toast.ok ? 'bg-green-500' : 'bg-red-500'}`}>
            {toast.msg}
          </div>
        )}

        {rejectTarget && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Reject Project</h2>
              <p className="text-sm text-gray-500 mb-4">
                Rejecting <span className="font-medium text-gray-700">{rejectTarget.title}</span> by {rejectTarget.user.name}
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason for student</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="e.g. Video quality too low, please re-record in better lighting."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none mb-4"
              />
              {rejectTarget.video?.url && (
                <label className="flex items-center gap-2 text-sm text-gray-700 mb-5 cursor-pointer">
                  <input type="checkbox" checked={deleteFromYT} onChange={e => setDeleteFromYT(e.target.checked)} className="w-4 h-4 accent-red-500" />
                  Also delete video from YouTube
                </label>
              )}
              <div className="flex gap-3 justify-end">
                <button onClick={() => { setRejectTarget(null); setRejectReason(''); setDeleteFromYT(false) }}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={reject} disabled={!!processingId}
                  className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50">
                  {processingId ? 'Rejecting...' : 'Reject Project'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Video Approvals</h1>
            <p className="text-sm text-gray-500 mt-1">Review student projects before publishing to YouTube</p>
          </div>
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {error && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">{error}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 border-0 shadow-sm">
            <p className="text-xs text-gray-400 uppercase font-semibold">Pending Review</p>
            <p className="text-3xl font-bold text-yellow-600 mt-1">{projects.length}</p>
          </Card>
          <Card className="p-4 border-0 shadow-sm">
            <p className="text-xs text-gray-400 uppercase font-semibold">Have Video</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{projects.filter(p => p.video?.url).length}</p>
          </Card>
          <Card className="p-4 border-0 shadow-sm">
            <p className="text-xs text-gray-400 uppercase font-semibold">No Video Yet</p>
            <p className="text-3xl font-bold text-red-500 mt-1">{projects.filter(p => !p.video?.url).length}</p>
          </Card>
        </div>

        <Card className="border-0 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">Student</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">Project</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3 hidden md:table-cell">Category</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase px-5 py-3 hidden md:table-cell">Video</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase px-5 py-3 hidden lg:table-cell">Submitted</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                  </td></tr>
                ) : projects.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-16">
                    <div className="text-5xl mb-3">🎉</div>
                    <p className="text-gray-500 font-medium">No pending projects — all caught up!</p>
                  </td></tr>
                ) : projects.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900 text-sm">{p.user.name}</p>
                      <p className="text-xs text-gray-400">{p.user.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900 text-sm">{p.title}</p>
                      <p className="text-xs text-gray-400 line-clamp-1">{p.description}</p>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                        {p.category?.name || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell text-center">
                      {p.video?.url ? (
                        <a href={p.video.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full font-medium hover:bg-green-100">
                          <Eye className="h-3 w-3" /> Watch
                        </a>
                      ) : (
                        <span className="px-2 py-1 bg-red-50 text-red-500 text-xs rounded-full font-medium">No video</span>
                      )}
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell text-center">
                      <span className="text-xs text-gray-500">
                        {new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => approve(p.id)}
                          disabled={processingId === p.id || !p.video?.url}
                          title={!p.video?.url ? 'No video to publish' : 'Approve and publish'}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                          <CheckCircle className="h-3.5 w-3.5" />
                          {processingId === p.id ? '...' : 'Approve'}
                        </button>
                        <button onClick={() => setRejectTarget(p)}
                          disabled={processingId === p.id}
                          className="flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-500 hover:bg-red-50 rounded-lg text-xs font-medium disabled:opacity-40">
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AdminLayout>
  )
}