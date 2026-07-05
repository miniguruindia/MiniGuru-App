'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import {
  ArrowLeft, School, KeyRound, Copy, Check, X, Plus, Trash2, Pencil,
  Loader2, RefreshCw, Hash, Trophy, FileVideo,
} from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

interface SchoolDetail {
  id: string
  name: string
  email: string
  phoneNumber: string | null
  mentorType: 'SCHOOL' | 'TLAB'
  institutionName: string | null
  city: string | null
  state: string | null
  pincode: string | null
  studentCount: number
  createdAt: string
}

interface StudentRow {
  id: string
  name: string
  age: number
  grade: string | null
  score: number
  loginEmail: string | null
  phoneNumber: string | null
  hasLogin: boolean
  createdAt: string
}

interface LeaderboardRow {
  rank: number
  childId: string
  name: string
  score: number
}

interface ProjectRow {
  id: string
  title: string
  status: string // "pending" | "published"
  category: string | null
  studentName: string
  createdAt: string
}

interface Credentials {
  email?: string
  password?: string
  pin?: string
  label: string
}

async function authToken() {
  const v = `; ${document.cookie}`
  const p = v.split('; auth_token=')
  return p.length === 2 ? p.pop()!.split(';').shift()! : ''
}

async function authedFetch(path: string, opts: RequestInit = {}) {
  const token = await authToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || 'Request failed')
  return data
}

// ── Small reusable credentials reveal modal ─────────────────────────────────
function CredentialsModal({ creds, onClose }: { creds: Credentials; onClose: () => void }) {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const copy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 1500)
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-gray-900">{creds.label}</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 mb-4">
          Save or share these now — they will not be shown again.
        </div>
        {creds.email && (
          <>
            <label className="text-xs font-medium text-gray-500">Login ID</label>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono bg-gray-50">{creds.email}</div>
              <button onClick={() => copy(creds.email!, 'email')} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                {copiedField === 'email' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-500" />}
              </button>
            </div>
          </>
        )}
        {creds.password && (
          <>
            <label className="text-xs font-medium text-gray-500">Password</label>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono bg-gray-50">{creds.password}</div>
              <button onClick={() => copy(creds.password!, 'password')} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                {copiedField === 'password' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-500" />}
              </button>
            </div>
          </>
        )}
        {creds.pin && (
          <>
            <label className="text-xs font-medium text-gray-500">Parent/Teacher PIN (view-as)</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono bg-gray-50">{creds.pin}</div>
              <button onClick={() => copy(creds.pin!, 'pin')} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                {copiedField === 'pin' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-500" />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const EMPTY_STUDENT_FORM = { name: '', age: '', grade: '', pin: '' }

export default function SchoolDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const schoolId = params.id

  const [school, setSchool]   = useState<SchoolDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm]   = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const [students, setStudents]     = useState<StudentRow[]>([])
  const [loadingStudents, setLoadingStudents] = useState(true)

  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true)

  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)

  const [showAddStudent, setShowAddStudent] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_STUDENT_FORM)
  const [addSaving, setAddSaving] = useState(false)

  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null)
  const [editForm, setEditForm] = useState<any>(null)
  const [editSaving, setEditSaving] = useState(false)

  const [busyId, setBusyId] = useState<string | null>(null)
  const [creds, setCreds]   = useState<Credentials | null>(null)

  const flash = (msg: string, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(''), 6000) }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  }

  const loadSchool = async () => {
    setLoading(true); setError('')
    try {
      const data = await authedFetch(`/admin/schools/${schoolId}`)
      setSchool(data)
      setForm({
        institutionName: data.institutionName || '',
        name: data.name || '',
        email: data.email || '',
        phoneNumber: data.phoneNumber || '',
        contactEmail: data.contactEmail || '',
        city: data.city || '',
        state: data.state || '',
        pincode: data.pincode || '',
        password: '',
      })
    } catch (e: any) {
      flash(e.message, true)
    } finally { setLoading(false) }
  }

  const loadStudents = async () => {
    setLoadingStudents(true)
    try {
      const data = await authedFetch(`/admin/schools/${schoolId}/children`)
      setStudents(Array.isArray(data) ? data : [])
    } catch (e: any) {
      flash(e.message, true)
    } finally { setLoadingStudents(false) }
  }

  const loadLeaderboard = async () => {
    setLoadingLeaderboard(true)
    try {
      const data = await authedFetch(`/admin/schools/${schoolId}/leaderboard`)
      setLeaderboard(Array.isArray(data.leaderboard) ? data.leaderboard : [])
    } catch (e: any) {
      flash(e.message, true)
    } finally { setLoadingLeaderboard(false) }
  }

  const loadProjects = async () => {
    setLoadingProjects(true)
    try {
      const data = await authedFetch(`/admin/schools/${schoolId}/projects`)
      setProjects(Array.isArray(data.projects) ? data.projects : [])
    } catch (e: any) {
      flash(e.message, true)
    } finally { setLoadingProjects(false) }
  }

  useEffect(() => {
    loadSchool()
    loadStudents()
    loadLeaderboard()
    loadProjects()
  }, [schoolId])

  const handleSaveSchool = async () => {
    setSaving(true)
    try {
      const payload = { ...form }
      if (!payload.password) delete payload.password
      const data = await authedFetch(`/admin/schools/${schoolId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      flash('Account updated')
      setForm((f: any) => ({ ...f, password: '' }))
      loadSchool()
    } catch (e: any) {
      flash(e.message, true)
    } finally { setSaving(false) }
  }

  const handleResetSchoolPassword = async () => {
    if (!school) return
    if (!confirm(`Reset password for ${school.email}? The old password stops working immediately.`)) return
    setSaving(true)
    try {
      const data = await authedFetch(`/admin/users/${schoolId}/reset-password`, { method: 'POST' })
      setCreds({ ...data.credentials, label: 'Password reset' })
    } catch (e: any) {
      flash(e.message, true)
    } finally { setSaving(false) }
  }

  const handleAddStudent = async () => {
    if (!addForm.name.trim() || !addForm.age) { flash('Name and age are required', true); return }
    setAddSaving(true)
    try {
      const data = await authedFetch(`/admin/schools/${schoolId}/children`, {
        method: 'POST',
        body: JSON.stringify(addForm),
      })
      setShowAddStudent(false)
      setAddForm(EMPTY_STUDENT_FORM)
      setCreds({ ...data.credentials, label: 'Student added' })
      loadStudents(); loadSchool()
    } catch (e: any) {
      flash(e.message, true)
    } finally { setAddSaving(false) }
  }

  const openEditStudent = (s: StudentRow) => {
    setEditingStudent(s)
    setEditForm({
      name: s.name, age: String(s.age), grade: s.grade || '',
      email: s.loginEmail || '', phoneNumber: s.phoneNumber || '', password: '',
    })
  }

  const handleSaveStudent = async () => {
    if (!editingStudent) return
    setEditSaving(true)
    try {
      const payload = { ...editForm }
      if (!payload.password) delete payload.password
      await authedFetch(`/admin/children/${editingStudent.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      flash('Student updated')
      setEditingStudent(null)
      loadStudents()
    } catch (e: any) {
      flash(e.message, true)
    } finally { setEditSaving(false) }
  }

  const handleResetStudentPassword = async (s: StudentRow) => {
    if (!confirm(`Reset login password for ${s.name}?`)) return
    setBusyId(s.id)
    try {
      const data = await authedFetch(`/admin/children/${s.id}/reset-password`, { method: 'POST' })
      setCreds({ ...data.credentials, label: `${s.name} — password reset` })
    } catch (e: any) {
      flash(e.message, true)
    } finally { setBusyId(null) }
  }

  const handleResetStudentPin = async (s: StudentRow) => {
    if (!confirm(`Reset the parent/teacher PIN for ${s.name}?`)) return
    setBusyId(s.id)
    try {
      const data = await authedFetch(`/admin/children/${s.id}/reset-pin`, { method: 'POST' })
      setCreds({ pin: data.pin, label: `${s.name} — PIN reset` })
    } catch (e: any) {
      flash(e.message, true)
    } finally { setBusyId(null) }
  }

  const handleRemoveStudent = async (s: StudentRow) => {
    if (!confirm(`Remove ${s.name} from this school? This can be reversed by support if needed, but they will disappear from this roster.`)) return
    setBusyId(s.id)
    try {
      await authedFetch(`/admin/children/${s.id}`, { method: 'DELETE' })
      flash(`${s.name} removed`)
      loadStudents(); loadSchool()
    } catch (e: any) {
      flash(e.message, true)
    } finally { setBusyId(null) }
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <button
          onClick={() => router.push('/schools')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Schools &amp; T-LABs
        </button>

        {error   && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        {success && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>}

        {loading || !form ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <School className="h-6 w-6 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-900">{school?.institutionName || school?.name}</h1>
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                school?.mentorType === 'SCHOOL' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
              }`}>
                {school?.mentorType === 'SCHOOL' ? 'School' : 'T-LAB'}
              </span>
            </div>

            {/* ── Account details ──────────────────────────────────────── */}
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Account Details</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">Institution name</label>
                  <input
                    value={form.institutionName}
                    onChange={e => setForm({ ...form, institutionName: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Contact name</label>
                  <input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Login ID</label>
                  <input
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Phone</label>
                  <input
                    value={form.phoneNumber}
                    onChange={e => setForm({ ...form, phoneNumber: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">
                    Contact email (real inbox — credential emails go here)
                  </label>
                  <input
                    value={form.contactEmail}
                    onChange={e => setForm({ ...form, contactEmail: e.target.value })}
                    placeholder="teacher's real email"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">City</label>
                  <input
                    value={form.city}
                    onChange={e => setForm({ ...form, city: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">State</label>
                  <input
                    value={form.state}
                    onChange={e => setForm({ ...form, state: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Pincode</label>
                  <input
                    value={form.pincode}
                    onChange={e => setForm({ ...form, pincode: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Set new password (optional)</label>
                  <input
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="Leave blank to keep current"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={handleSaveSchool}
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Changes
                </button>
                <button
                  onClick={handleResetSchoolPassword}
                  disabled={saving}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <KeyRound className="h-4 w-4" /> Generate Random Password
                </button>
              </div>
            </Card>

            {/* ── Students roster ──────────────────────────────────────── */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">
                  Students ({students.length})
                </h2>
                <div className="flex items-center gap-2">
                  <button onClick={loadStudents} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-gray-50">
                    <RefreshCw className="h-3.5 w-3.5" /> Refresh
                  </button>
                  <button
                    onClick={() => setShowAddStudent(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Student
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Name</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Age / Grade</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Login ID</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Goins</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loadingStudents ? (
                      <tr><td colSpan={5} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto" />
                      </td></tr>
                    ) : students.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-8 text-gray-400">
                        No students yet. Add one, or have the school use Bulk Add from their own account.
                      </td></tr>
                    ) : students.map(s => (
                      <tr key={s.id}>
                        <td className="px-3 py-2.5 font-medium text-gray-900">{s.name}</td>
                        <td className="px-3 py-2.5 text-gray-600">{s.age}{s.grade ? ` · ${s.grade}` : ''}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{s.loginEmail || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-600">{s.score}</td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => openEditStudent(s)}
                              className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5 text-gray-500" />
                            </button>
                            <button
                              onClick={() => handleResetStudentPassword(s)}
                              disabled={busyId === s.id}
                              className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                              title="Reset login password"
                            >
                              <KeyRound className="h-3.5 w-3.5 text-gray-500" />
                            </button>
                            <button
                              onClick={() => handleResetStudentPin(s)}
                              disabled={busyId === s.id}
                              className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                              title="Reset parent/teacher PIN"
                            >
                              <Hash className="h-3.5 w-3.5 text-gray-500" />
                            </button>
                            <button
                              onClick={() => handleRemoveStudent(s)}
                              disabled={busyId === s.id}
                              className="p-1.5 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40"
                              title="Remove"
                            >
                              {busyId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin text-red-500" /> : <Trash2 className="h-3.5 w-3.5 text-red-500" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* ── Leaderboard ──────────────────────────────────────────── */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-amber-500" /> Leaderboard ({leaderboard.length})
                </h2>
                <button onClick={loadLeaderboard} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-gray-50">
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Rank</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Name</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Goins</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loadingLeaderboard ? (
                      <tr><td colSpan={3} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto" />
                      </td></tr>
                    ) : leaderboard.length === 0 ? (
                      <tr><td colSpan={3} className="text-center py-8 text-gray-400">
                        No students with Goins yet
                      </td></tr>
                    ) : leaderboard.map((row) => (
                      <tr key={row.childId}>
                        <td className="px-3 py-2">
                          {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : `#${row.rank}`}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-900">{row.name}</td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">
                            {row.score} 🪙
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* ── Student projects ────────────────────────────────────────── */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <FileVideo className="h-4 w-4 text-indigo-500" /> Student Projects ({projects.length})
                </h2>
                <button onClick={loadProjects} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-gray-50">
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                Only shows projects a student has actually uploaded. A saved-but-not-yet-uploaded
                plan lives only on the child's own device and won't appear here until they upload.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Student</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Project</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Category</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Status</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Uploaded</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loadingProjects ? (
                      <tr><td colSpan={5} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto" />
                      </td></tr>
                    ) : projects.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-8 text-gray-400">
                        No projects uploaded yet
                      </td></tr>
                    ) : projects.map((p) => (
                      <tr key={p.id}>
                        <td className="px-3 py-2 font-medium text-gray-900">{p.studentName}</td>
                        <td className="px-3 py-2">{p.title}</td>
                        <td className="px-3 py-2 text-gray-500">{p.category ?? '—'}</td>
                        <td className="px-3 py-2">
                          {p.status === 'published' ? (
                            <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-medium">Published</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">Pending Review</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* ── Add student modal ──────────────────────────────────────────── */}
      {showAddStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Add Student</h3>
              <button onClick={() => setShowAddStudent(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Student name *</label>
                <input
                  value={addForm.name}
                  onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">Age *</label>
                  <input
                    type="number"
                    value={addForm.age}
                    onChange={e => setAddForm({ ...addForm, age: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Grade</label>
                  <input
                    value={addForm.grade}
                    onChange={e => setAddForm({ ...addForm, grade: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">PIN (optional — random if blank)</label>
                <input
                  value={addForm.pin}
                  onChange={e => setAddForm({ ...addForm, pin: e.target.value })}
                  placeholder="4 digits"
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <button
                onClick={handleAddStudent}
                disabled={addSaving}
                className="w-full mt-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {addSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Student
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit student modal ─────────────────────────────────────────── */}
      {editingStudent && editForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Edit {editingStudent.name}</h3>
              <button onClick={() => setEditingStudent(null)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Name</label>
                <input
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">Age</label>
                  <input
                    type="number"
                    value={editForm.age}
                    onChange={e => setEditForm({ ...editForm, age: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Grade</label>
                  <input
                    value={editForm.grade}
                    onChange={e => setEditForm({ ...editForm, grade: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Login ID</label>
                <input
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Phone</label>
                <input
                  value={editForm.phoneNumber}
                  onChange={e => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Set new password (optional)</label>
                <input
                  value={editForm.password}
                  onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="Leave blank to keep current"
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <button
                onClick={handleSaveStudent}
                disabled={editSaving}
                className="w-full mt-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {editSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {creds && <CredentialsModal creds={creds} onClose={() => setCreds(null)} />}
    </AdminLayout>
  )
}