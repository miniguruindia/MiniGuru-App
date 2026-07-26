'use client'

import React, { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import {
  Megaphone, Trophy, Check, X, Pencil, Trash2, Plus, Loader2, School, Globe,
  RefreshCw, BarChart3, BookOpen,
} from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

async function authToken() {
  const v = `; ${document.cookie}`
  const p = v.split('; auth_token=')
  return p.length === 2 ? p.pop()!.split(';').shift()! : ''
}

async function fetchContent(key: string) {
  const token = await authToken()
  const res = await fetch(`${API_BASE}/cms/${key}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`${res.status}`)
  return (await res.json()).value
}

async function saveContent(key: string, value: any) {
  const token = await authToken()
  const res = await fetch(`${API_BASE}/admin/cms/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ value }),
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

interface Happening {
  id: string
  title: string
  description: string
  date: string
  city: string | null
  schoolName: string | null
  emoji: string
  tag: string
  tagColor: string | null
  imageUrl: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  submittedByName: string | null
  rejectionReason: string | null
}

interface ChallengeItem {
  id: string
  title: string
  description: string
  category: string
  categoryEmoji: string | null
  difficulty: string
  goinsReward: number
  endDate: string
  participants: number
  color: string | null
  lifecycleStatus: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  audience: 'ALL' | 'OWN_SCHOOL'
  submittedByName: string | null
  rejectionReason: string | null
}

type Tab = 'happenings' | 'challenges'
type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'

const EMPTY_HAPPENING = {
  title: '', description: '', date: new Date().toISOString().slice(0, 10),
  city: '', schoolName: '', emoji: '🏫', tag: 'NEW', tagColor: '', imageUrl: '',
}
const EMPTY_CHALLENGE = {
  title: '', description: '', category: '', categoryEmoji: '', difficulty: 'Medium',
  goinsReward: 100, endDate: new Date().toISOString().slice(0, 10), participants: 0,
  color: '', lifecycleStatus: 'upcoming', audience: 'ALL' as 'ALL' | 'OWN_SCHOOL',
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-700',
    APPROVED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

export function SubmissionsModerationTab() {
  const [tab, setTab] = useState<Tab>('happenings')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING')
  const [happenings, setHappenings] = useState<Happening[]>([])
  const [challenges, setChallenges] = useState<ChallengeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const [happeningForm, setHappeningForm] = useState<any>(null) // null = closed, object = open (new or edit)
  const [challengeForm, setChallengeForm] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const token = await authToken()
      const [hRes, cRes] = await Promise.all([
        fetch(`${API_BASE}/admin/happenings`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/admin/challenges`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const hData = hRes.ok ? await hRes.json() : { happenings: [] }
      const cData = cRes.ok ? await cRes.json() : { challenges: [] }
      setHappenings(Array.isArray(hData.happenings) ? hData.happenings : [])
      setChallenges(Array.isArray(cData.challenges) ? cData.challenges : [])
    } catch (e: any) {
      setError('Backend not connected: ' + e.message)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const approve = async (kind: Tab, id: string) => {
    const token = await authToken()
    await fetch(`${API_BASE}/admin/${kind}/${id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    load()
  }

  const confirmReject = async (kind: Tab) => {
    if (!rejectingId) return
    const token = await authToken()
    await fetch(`${API_BASE}/admin/${kind}/${rejectingId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason: rejectReason || 'Not specified' }),
    })
    setRejectingId(null); setRejectReason('')
    load()
  }

  const remove = async (kind: Tab, id: string) => {
    if (!confirm('Delete this permanently? This cannot be undone.')) return
    const token = await authToken()
    await fetch(`${API_BASE}/admin/${kind}/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    load()
  }

  const saveHappening = async () => {
    setSaving(true)
    try {
      const token = await authToken()
      const isNew = !happeningForm.id
      const url = isNew ? `${API_BASE}/happenings` : `${API_BASE}/admin/happenings/${happeningForm.id}`
      await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(happeningForm),
      })
      setHappeningForm(null)
      load()
    } finally { setSaving(false) }
  }

  const saveChallenge = async () => {
    setSaving(true)
    try {
      const token = await authToken()
      const isNew = !challengeForm.id
      const url = isNew ? `${API_BASE}/challenges` : `${API_BASE}/admin/challenges/${challengeForm.id}`
      await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(challengeForm),
      })
      setChallengeForm(null)
      load()
    } finally { setSaving(false) }
  }

  const filteredHappenings = happenings.filter(h => statusFilter === 'ALL' || h.status === statusFilter)
  const filteredChallenges = challenges.filter(c => statusFilter === 'ALL' || c.status === statusFilter)
  const pendingCount = happenings.filter(h => h.status === 'PENDING').length + challenges.filter(c => c.status === 'PENDING').length

  return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Community Submissions</h1>
            <p className="text-sm text-gray-500 mt-1">
              Teacher/school-submitted T-LAB Happenings and STEAM Challenges await your review here.
              {pendingCount > 0 && <span className="text-amber-600 font-semibold"> {pendingCount} pending.</span>}
            </p>
          </div>
          <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100" title="Refresh">
            <RefreshCw className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('happenings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'happenings' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border'}`}
          >
            <Megaphone className="w-4 h-4" /> Happenings ({happenings.length})
          </button>
          <button
            onClick={() => setTab('challenges')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'challenges' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border'}`}
          >
            <Trophy className="w-4 h-4" /> Challenges ({challenges.length})
          </button>
          <div className="flex-1" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="PENDING">Pending only</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="ALL">All</option>
          </select>
          <button
            onClick={() => tab === 'happenings' ? setHappeningForm({ ...EMPTY_HAPPENING }) : setChallengeForm({ ...EMPTY_CHALLENGE })}
            className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white"
          >
            <Plus className="w-4 h-4" /> Add New
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
        ) : tab === 'happenings' ? (
          <div className="space-y-3">
            {filteredHappenings.length === 0 && <Card className="p-6 text-center text-gray-400">Nothing here.</Card>}
            {filteredHappenings.map(h => (
              <Card key={h.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg">{h.emoji}</span>
                      <span className="font-semibold text-gray-900">{h.title}</span>
                      <StatusBadge status={h.status} />
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{h.tag}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{h.description}</p>
                    <div className="text-xs text-gray-400 mt-2 flex gap-3 flex-wrap">
                      <span>📅 {h.date?.slice(0, 10)}</span>
                      {h.city && <span>📍 {h.city}</span>}
                      {h.schoolName && <span>🏫 {h.schoolName}</span>}
                      <span>Submitted by: {h.submittedByName || 'Admin'}</span>
                    </div>
                    {h.status === 'REJECTED' && h.rejectionReason && (
                      <p className="text-xs text-red-600 mt-1">Rejected: {h.rejectionReason}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {h.status !== 'APPROVED' && (
                      <button onClick={() => approve('happenings', h.id)} className="p-2 rounded-lg bg-green-50 hover:bg-green-100" title="Approve">
                        <Check className="w-4 h-4 text-green-600" />
                      </button>
                    )}
                    {h.status !== 'REJECTED' && (
                      <button onClick={() => setRejectingId(h.id)} className="p-2 rounded-lg bg-red-50 hover:bg-red-100" title="Reject">
                        <X className="w-4 h-4 text-red-600" />
                      </button>
                    )}
                    <button onClick={() => setHappeningForm({ ...h })} className="p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100" title="Edit">
                      <Pencil className="w-4 h-4 text-indigo-600" />
                    </button>
                    <button onClick={() => remove('happenings', h.id)} className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100" title="Delete">
                      <Trash2 className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>
                {rejectingId === h.id && (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection (shown nowhere to the child — internal note)"
                      className="flex-1 border rounded-lg px-3 py-2 text-sm"
                    />
                    <button onClick={() => confirmReject('happenings')} className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold">Confirm Reject</button>
                    <button onClick={() => setRejectingId(null)} className="px-3 py-2 rounded-lg border text-sm">Cancel</button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredChallenges.length === 0 && <Card className="p-6 text-center text-gray-400">Nothing here.</Card>}
            {filteredChallenges.map(c => (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg">{c.categoryEmoji || '🏆'}</span>
                      <span className="font-semibold text-gray-900">{c.title}</span>
                      <StatusBadge status={c.status} />
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{c.lifecycleStatus}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${c.audience === 'ALL' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                        {c.audience === 'ALL' ? <><Globe className="w-3 h-3" /> Open to all</> : <><School className="w-3 h-3" /> Own school only</>}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{c.description}</p>
                    <div className="text-xs text-gray-400 mt-2 flex gap-3 flex-wrap">
                      <span>📂 {c.category}</span>
                      <span>🪙 {c.goinsReward} Goins</span>
                      <span>📅 Ends {c.endDate?.slice(0, 10)}</span>
                      <span>👥 {c.participants} participants</span>
                      <span>Submitted by: {c.submittedByName || 'Admin'}</span>
                    </div>
                    {c.status === 'REJECTED' && c.rejectionReason && (
                      <p className="text-xs text-red-600 mt-1">Rejected: {c.rejectionReason}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {c.status !== 'APPROVED' && (
                      <button onClick={() => approve('challenges', c.id)} className="p-2 rounded-lg bg-green-50 hover:bg-green-100" title="Approve">
                        <Check className="w-4 h-4 text-green-600" />
                      </button>
                    )}
                    {c.status !== 'REJECTED' && (
                      <button onClick={() => setRejectingId(c.id)} className="p-2 rounded-lg bg-red-50 hover:bg-red-100" title="Reject">
                        <X className="w-4 h-4 text-red-600" />
                      </button>
                    )}
                    <button onClick={() => setChallengeForm({ ...c })} className="p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100" title="Edit">
                      <Pencil className="w-4 h-4 text-indigo-600" />
                    </button>
                    <button onClick={() => remove('challenges', c.id)} className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100" title="Delete">
                      <Trash2 className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>
                {rejectingId === c.id && (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection (internal note)"
                      className="flex-1 border rounded-lg px-3 py-2 text-sm"
                    />
                    <button onClick={() => confirmReject('challenges')} className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold">Confirm Reject</button>
                    <button onClick={() => setRejectingId(null)} className="px-3 py-2 rounded-lg border text-sm">Cancel</button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* ── Happening add/edit modal ─────────────────────────────────── */}
        {happeningForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-bold mb-4">{happeningForm.id ? 'Edit' : 'New'} Happening</h2>
              <div className="space-y-3">
                <input placeholder="Title" value={happeningForm.title}
                  onChange={e => setHappeningForm({ ...happeningForm, title: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
                <textarea placeholder="Description" value={happeningForm.description} rows={3}
                  onChange={e => setHappeningForm({ ...happeningForm, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" value={happeningForm.date?.slice(0, 10)}
                    onChange={e => setHappeningForm({ ...happeningForm, date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="City" value={happeningForm.city || ''}
                    onChange={e => setHappeningForm({ ...happeningForm, city: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <input placeholder="School name (leave blank for platform-wide)" value={happeningForm.schoolName || ''}
                  onChange={e => setHappeningForm({ ...happeningForm, schoolName: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
                <div className="grid grid-cols-3 gap-3">
                  <input placeholder="Emoji" value={happeningForm.emoji || ''}
                    onChange={e => setHappeningForm({ ...happeningForm, emoji: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                  <select value={happeningForm.tag || 'NEW'}
                    onChange={e => setHappeningForm({ ...happeningForm, tag: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="NEW">NEW</option>
                    <option value="UPCOMING">UPCOMING</option>
                    <option value="MILESTONE">MILESTONE</option>
                    <option value="AWARD">AWARD</option>
                    <option value="PAST">PAST</option>
                  </select>
                  <input placeholder="Color hex (optional)" value={happeningForm.tagColor || ''}
                    onChange={e => setHappeningForm({ ...happeningForm, tagColor: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                {happeningForm.id && (
                  <select value={happeningForm.status || 'PENDING'}
                    onChange={e => setHappeningForm({ ...happeningForm, status: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="PENDING">PENDING</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                )}
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={saveHappening} disabled={saving} className="flex-1 py-2 rounded-lg bg-indigo-600 text-white font-semibold text-sm">
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setHappeningForm(null)} className="flex-1 py-2 rounded-lg border text-sm">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Challenge add/edit modal ─────────────────────────────────── */}
        {challengeForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-bold mb-4">{challengeForm.id ? 'Edit' : 'New'} Challenge</h2>
              <div className="space-y-3">
                <input placeholder="Title" value={challengeForm.title}
                  onChange={e => setChallengeForm({ ...challengeForm, title: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
                <textarea placeholder="Description" value={challengeForm.description} rows={3}
                  onChange={e => setChallengeForm({ ...challengeForm, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Category" value={challengeForm.category}
                    onChange={e => setChallengeForm({ ...challengeForm, category: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="Category emoji (optional)" value={challengeForm.categoryEmoji || ''}
                    onChange={e => setChallengeForm({ ...challengeForm, categoryEmoji: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" placeholder="Goins Reward" value={challengeForm.goinsReward}
                    onChange={e => setChallengeForm({ ...challengeForm, goinsReward: Number(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                  <select value={challengeForm.difficulty || 'Medium'}
                    onChange={e => setChallengeForm({ ...challengeForm, difficulty: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" value={challengeForm.endDate?.slice(0, 10)}
                    onChange={e => setChallengeForm({ ...challengeForm, endDate: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                  <input type="number" placeholder="Participants" value={challengeForm.participants || 0}
                    onChange={e => setChallengeForm({ ...challengeForm, participants: Number(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <select value={challengeForm.audience || 'ALL'}
                  onChange={e => setChallengeForm({ ...challengeForm, audience: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="ALL">Open to everyone</option>
                  <option value="OWN_SCHOOL">Restricted to one school's children (set via that school's own submission)</option>
                </select>
                <select value={challengeForm.lifecycleStatus || 'upcoming'}
                  onChange={e => setChallengeForm({ ...challengeForm, lifecycleStatus: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="ongoing">Ongoing</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="past">Past</option>
                </select>
                {challengeForm.id && (
                  <select value={challengeForm.status || 'PENDING'}
                    onChange={e => setChallengeForm({ ...challengeForm, status: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="PENDING">PENDING</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                )}
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={saveChallenge} disabled={saving} className="flex-1 py-2 rounded-lg bg-indigo-600 text-white font-semibold text-sm">
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setChallengeForm(null)} className="flex-1 py-2 rounded-lg border text-sm">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
  )
}
// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — STATS & RESOURCES  (the only pieces of the old CMS 'community' blob
// still actually read by community_screen.dart — Happenings and Challenges
// moved to the real Happening/Challenge models above, and the Progression
// Ladder was always driven by the real leaderboard API, never this blob, so
// neither is shown here anymore — those fields were editable but silently
// did nothing.)
// ═══════════════════════════════════════════════════════════════════════════
function StatsResourcesTab() {
  const [data, setData] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true)
    try { setData((await fetchContent('community')) || {}) }
    catch { setMessage('Could not load — showing empty defaults') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true)
    try {
      await saveContent('community', data)
      setMessage('Saved ✅')
      setTimeout(() => setMessage(''), 3000)
    } catch { setMessage('Save failed — check backend connection') }
    finally { setSaving(false) }
  }

  const stats = data.stats || {}
  const setStat = (k: string, v: string) => setData({ ...data, stats: { ...stats, [k]: v } })
  const resources: any[] = data.resources || []
  const updateResource = (i: number, field: string, val: string) => {
    const next = [...resources]
    next[i] = { ...next[i], [field]: val }
    setData({ ...data, resources: next })
  }
  const removeResource = (i: number) => setData({ ...data, resources: resources.filter((_: any, idx: number) => idx !== i) })
  const addResource = () => setData({ ...data, resources: [...resources, { id: Date.now().toString(), title: '', type: 'PDF', tag: '', url: '', description: '' }] })

  if (loading) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">These are the only two pieces of the Community tab that are still admin-editable text — everything else (Happenings, Challenges, Ladder) lives in the Happenings &amp; Challenges tab or the real leaderboard.</p>
        <button onClick={save} disabled={saving}
          className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 ml-4">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      {message && <div className="text-sm text-gray-500">{message}</div>}

      <Card className="border-0 shadow-sm p-5 space-y-3">
        <p className="text-sm font-semibold text-gray-700 flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Stats Strip</p>
        <p className="text-xs text-gray-400">Shown at the top of the Community screen. Keep these honest — they're visible to every user.</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500">Makers</label>
            <input className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="e.g. Growing" value={stats.makers || ''} onChange={e => setStat('makers', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Videos</label>
            <input className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="e.g. New" value={stats.videos || ''} onChange={e => setStat('videos', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">T-LABs</label>
            <input className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="e.g. 32+" value={stats.labs || ''} onChange={e => setStat('labs', e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="border-0 shadow-sm p-5 space-y-3">
        <p className="text-sm font-semibold text-gray-700 flex items-center gap-2"><BookOpen className="h-4 w-4" /> Resources ({resources.length})</p>
        {resources.map((r, i) => (
          <div key={r.id || i} className="border border-gray-100 rounded-lg p-4 space-y-3 bg-gray-50 relative">
            <button onClick={() => removeResource(i)} className="absolute top-3 right-3 text-red-400 hover:text-red-600">
              <Trash2 className="h-4 w-4" />
            </button>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Title</label>
                <input className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" value={r.title || ''} onChange={e => updateResource(i, 'title', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Type (PDF/DOC/VIDEO)</label>
                <input className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" value={r.type || ''} onChange={e => updateResource(i, 'type', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Tag</label>
                <input className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" value={r.tag || ''} onChange={e => updateResource(i, 'tag', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Download URL</label>
              <input className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" value={r.url || ''} onChange={e => updateResource(i, 'url', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Description</label>
              <textarea className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none" rows={2} value={r.description || ''} onChange={e => updateResource(i, 'description', e.target.value)} />
            </div>
          </div>
        ))}
        <button onClick={addResource} className="flex items-center gap-2 text-sm text-blue-600 font-medium">
          <Plus className="h-4 w-4" /> Add Resource
        </button>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE — one nav entry, two tabs, instead of Community Submissions being
// separate from the Community CMS content buried inside Site Content
// ═══════════════════════════════════════════════════════════════════════════
export default function CommunityPage() {
  const [tab, setTab] = useState<'moderation' | 'stats'>('moderation')

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-indigo-600" /> Community
          </h1>
          <p className="text-sm text-gray-500 mt-1">Approve teacher/school submissions, and edit the stats strip &amp; resources list.</p>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setTab('moderation')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'moderation' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}><Trophy className="h-4 w-4" /> Happenings &amp; Challenges</button>
          <button onClick={() => setTab('stats')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'stats' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}><BarChart3 className="h-4 w-4" /> Stats &amp; Resources</button>
        </div>

        {tab === 'moderation' ? <SubmissionsModerationTab /> : <StatsResourcesTab />}
      </div>
    </AdminLayout>
  )
}
