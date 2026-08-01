'use client'

import React, { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import {
  RefreshCw, CheckCircle, XCircle, Eye, Video, Plus, Trash2,
  ClipboardCheck, MessageSquare,
} from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

async function authHeader() {
  const token = (() => { const v = `; ${document.cookie}`; const p = v.split('; auth_token='); return p.length === 2 ? p.pop()!.split(';').shift()! : '' })()
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1 — PENDING APPROVALS  (unchanged logic from the old /videos page)
// ═══════════════════════════════════════════════════════════════════════════
interface ProjectUser { id: string; name: string; email: string }
interface ProjectCategory { id: string; name: string }
interface PendingProject {
  id: string; title: string; description: string; status: string
  thumbnail: string; video: { url: string; uploadedAt?: string }
  user: ProjectUser; category: ProjectCategory | null; createdAt: string
  aiVerdict?: 'APPROVE' | 'REJECT' | 'UNSURE' | null
  aiReason?: string | null
  aiConfidence?: number | null
}

function AiVerdictBadge({ p }: { p: PendingProject }) {
  if (!p.aiVerdict) {
    return <span className="text-xs text-gray-300">—</span>
  }
  const confidencePct = typeof p.aiConfidence === 'number' ? `${Math.round(p.aiConfidence * 100)}%` : null
  const styles: Record<string, string> = {
    REJECT:  'bg-red-50 text-red-600',
    UNSURE:  'bg-amber-50 text-amber-700',
    APPROVE: 'bg-green-50 text-green-700',
  }
  const icons: Record<string, string> = { REJECT: '🚫', UNSURE: '🤔', APPROVE: '✅' }
  return (
    <div className="text-left" title={p.aiReason || ''}>
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[p.aiVerdict]}`}>
        {icons[p.aiVerdict]} {p.aiVerdict}{confidencePct ? ` · ${confidencePct}` : ''}
      </span>
      {p.aiReason && (
        <p className="text-xs text-gray-400 mt-1 line-clamp-2 max-w-[220px]">{p.aiReason}</p>
      )}
    </div>
  )
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

function ApprovalsTab() {
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
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const data = await res.json()
      setProjects(Array.isArray(data) ? data : data.projects ?? [])
      setError('')
    } catch (e: any) {
      const msg = e?.message || String(e)
      setError(`⚠️ Backend error: ${msg}. Showing sample data. Make sure backend is running at ${API_BASE}`)
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

      <div className="flex items-center justify-end">
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
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">AI Review</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase px-5 py-3 hidden md:table-cell">Video</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase px-5 py-3 hidden lg:table-cell">Submitted</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                </td></tr>
              ) : projects.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16">
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
                  <td className="px-5 py-4">
                    <AiVerdictBadge p={p} />
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
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — OUTSIDE VIDEOS  (unchanged logic, moved from the Content page)
// ═══════════════════════════════════════════════════════════════════════════
async function fetchContent(key: string) {
  const res = await fetch(`${API_BASE}/cms/${key}`, { headers: await authHeader() })
  if (!res.ok) throw new Error(`${res.status}`)
  return (await res.json()).value
}

async function saveContent(key: string, value: any) {
  const res = await fetch(`${API_BASE}/admin/cms/${key}`, {
    method: 'PUT',
    headers: await authHeader(),
    body: JSON.stringify({ value }),
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

function OutsideVideosTab() {
  const [data, setData] = useState<{ videos: any[] }>({ videos: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true)
    try { setData((await fetchContent('external_videos')) || { videos: [] }) }
    catch { setMessage('Could not load — showing empty list') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true)
    try {
      await saveContent('external_videos', data)
      setMessage('Saved ✅')
      setTimeout(() => setMessage(''), 3000)
    } catch { setMessage('Save failed — check backend connection') }
    finally { setSaving(false) }
  }

  const videos = data.videos || []

  const extractVideoId = (input: string): string => {
    const trimmed = input.trim()
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed
    const match = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)
    return match ? match[1] : trimmed
  }

  const addVideo = () => {
    setData({ ...data, videos: [...videos, { videoId: '', title: '', description: '', addedAt: new Date().toISOString().slice(0, 10) }] })
  }
  const updateVideo = (i: number, field: string, val: string) => {
    const next = [...videos]
    next[i] = { ...next[i], [field]: field === 'videoId' ? extractVideoId(val) : val }
    setData({ ...data, videos: next })
  }
  const removeVideo = (i: number) => {
    setData({ ...data, videos: videos.filter((_: any, idx: number) => idx !== i) })
  }

  if (loading) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="p-4 bg-pink-50 border border-pink-100 rounded-xl text-sm text-pink-700 flex-1 mr-4">
          <p className="font-semibold mb-1">💡 What this is for</p>
          <p>Videos shown in a separate "More Ideas From Outside" row on the home screen — clearly
             distinct from student-uploaded projects. Good for pre-app MiniGuru content, or any
             inspiring project video you want to showcase that wasn't uploaded through the app.</p>
        </div>
        <button onClick={save} disabled={saving}
          className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-pink-600 text-white rounded-lg text-sm font-semibold hover:bg-pink-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      {message && <div className="text-sm text-gray-500">{message}</div>}

      <Card className="border-0 shadow-sm p-5 space-y-4">
        <p className="text-sm font-semibold text-gray-700">Outside Videos ({videos.length})</p>
        {videos.map((v: any, i: number) => (
          <div key={i} className="p-4 border border-gray-100 rounded-lg space-y-3 relative bg-gray-50">
            <button onClick={() => removeVideo(i)} className="absolute top-3 right-3 text-red-400 hover:text-red-600">
              <Trash2 className="h-4 w-4" />
            </button>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">YouTube video ID or full URL</label>
              <p className="text-xs text-gray-400 mb-1">Paste either — a full youtube.com/youtu.be link or just the 11-character ID</p>
              <input className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                placeholder="e.g. dQw4w9WgXcQ or https://youtu.be/dQw4w9WgXcQ"
                value={v.videoId || ''} onChange={e => updateVideo(i, 'videoId', e.target.value)} />
            </div>
            {v.videoId && /^[a-zA-Z0-9_-]{11}$/.test(v.videoId) && (
              <img src={`https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`} alt="thumbnail preview"
                className="h-24 rounded border border-gray-200" />
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
              <input className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                value={v.title || ''} onChange={e => updateVideo(i, 'title', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <textarea className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-400"
                rows={2} value={v.description || ''} onChange={e => updateVideo(i, 'description', e.target.value)} />
            </div>
          </div>
        ))}
        <button onClick={addVideo} className="flex items-center gap-1 text-sm text-pink-600 font-medium">
          <Plus className="h-4 w-4" /> Add outside video
        </button>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE — one nav entry, two tabs
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// TAB 3 — COMMENTS  (moderation: delete any comment, manually push approved
// ones to the real YouTube video — comments no longer auto-post on their
// own, per the comment-farming fix)
// ═══════════════════════════════════════════════════════════════════════════
interface ModerationComment {
  id: string; videoId: string; userId: string; userName: string
  comment: string; createdAt: string
  postedToYouTube: boolean; youtubeCommentId: string | null
}

function CommentsTab() {
  const [comments, setComments] = useState<ModerationComment[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/videos/admin/comments?limit=200`, { headers: await authHeader() })
      const data = await res.json()
      setComments(Array.isArray(data.comments) ? data.comments : [])
    } catch {
      setComments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const deleteComment = async (id: string) => {
    if (!confirm('Delete this comment permanently?')) return
    setBusyId(id)
    try {
      const res = await fetch(`${API_BASE}/api/videos/comments/${id}`, { method: 'DELETE', headers: await authHeader() })
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== id))
        showToast('Comment deleted', true)
      } else {
        showToast('Failed to delete comment', false)
      }
    } finally {
      setBusyId(null)
    }
  }

  const pushToYouTube = async (id: string) => {
    setBusyId(id)
    try {
      const res = await fetch(`${API_BASE}/api/videos/admin/comments/${id}/post-to-youtube`, { method: 'POST', headers: await authHeader() })
      const data = await res.json()
      if (res.ok) {
        setComments((prev) => prev.map((c) => c.id === id ? { ...c, postedToYouTube: true, youtubeCommentId: data.youtubeCommentId } : c))
        showToast('Posted to YouTube', true)
      } else {
        showToast(data.message || 'Failed to post to YouTube', false)
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`px-4 py-2 rounded-lg text-sm ${toast.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {toast.msg}
        </div>
      )}
      <p className="text-sm text-gray-500">
        Comments no longer post to YouTube automatically — each child can post up to 2 comments per
        video, then must edit instead of spamming new ones. Review here and push the good ones to
        the real YouTube video yourself.
      </p>
      {loading ? (
        <Card className="p-8 text-center text-gray-400">Loading comments…</Card>
      ) : comments.length === 0 ? (
        <Card className="p-8 text-center text-gray-400">No comments yet.</Card>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                    <span className="font-medium text-gray-700">{c.userName}</span>
                    <span>·</span>
                    <span>{new Date(c.createdAt).toLocaleString()}</span>
                    <span>·</span>
                    <span className="truncate">video: {c.videoId}</span>
                    {c.postedToYouTube ? (
                      <span className="ml-2 px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">On YouTube</span>
                    ) : (
                      <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">Not posted</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{c.comment}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {!c.postedToYouTube && (
                    <button
                      onClick={() => pushToYouTube(c.id)}
                      disabled={busyId === c.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-50"
                    >Push to YouTube</button>
                  )}
                  <button
                    onClick={() => deleteComment(c.id)}
                    disabled={busyId === c.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  ><Trash2 className="h-3.5 w-3.5 inline -mt-0.5" /> Delete</button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ContentModerationPage() {
  const [tab, setTab] = useState<'approvals' | 'outside' | 'comments'>('approvals')

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-blue-600" /> Content Moderation
          </h1>
          <p className="text-sm text-gray-500 mt-1">Review student projects before they publish, curate outside videos for the home screen, and moderate comments.</p>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setTab('approvals')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'approvals' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}><ClipboardCheck className="h-4 w-4" /> Pending Approvals</button>
          <button onClick={() => setTab('outside')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'outside' ? 'bg-pink-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}><Video className="h-4 w-4" /> Outside Videos</button>
          <button onClick={() => setTab('comments')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'comments' ? 'bg-purple-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}><MessageSquare className="h-4 w-4" /> Comments</button>
        </div>

        {tab === 'approvals' ? <ApprovalsTab /> : tab === 'outside' ? <OutsideVideosTab /> : <CommentsTab />}
      </div>
    </AdminLayout>
  )
}
