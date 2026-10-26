'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { User, GuardianInfo } from '@/types/users'
import { SkeletonCard } from '@/components/SkeletonCard'
import {
  RefreshCw, WifiOff, Users as UsersIcon, School, ShieldAlert,
  Plus, KeyRound, X, Copy, Check, Search, Loader2,
} from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

async function authToken() {
  const m = document.cookie.match(/(?:^|; )auth_token=([^;]*)/)
  return m ? decodeURIComponent(m[1]) : ''
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1 — DIRECTORY  (Users, with account-type + city + school filters)
// ═══════════════════════════════════════════════════════════════════════════
type AccountFilter = 'all' | 'children' | 'individuals' | 'parents' | 'schools' | 'tlabs'

function accountTypeOf(user: User): { key: AccountFilter; label: string; badgeClass: string } {
  const isChild = user.phoneNumber?.startsWith('child_')
  if (isChild) return { key: 'children', label: '🧒 Child', badgeClass: 'bg-blue-100 text-blue-700' }
  if (user.mentorType === 'SCHOOL') return { key: 'schools', label: '🏫 School', badgeClass: 'bg-indigo-100 text-indigo-700' }
  if (user.mentorType === 'TLAB') return { key: 'tlabs', label: '🔬 T-LAB', badgeClass: 'bg-emerald-100 text-emerald-700' }
  if (user.isMentor) return { key: 'parents', label: '👨‍👩‍👧 Parent', badgeClass: 'bg-purple-100 text-purple-700' }
  return { key: 'individuals', label: '🧒 Individual learner (own account)', badgeClass: 'bg-green-100 text-green-700' }
}

function DirectoryTab() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)

  const [accountFilter, setAccountFilter] = useState<AccountFilter>('all')
  const [cityFilter, setCityFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const fetchUsers = async () => {
    try {
      setLoading(true); setError(null)
      const token = await authToken()
      const res = await fetch(`${API_BASE}/admin/users/`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.status === 502 || res.status === 503) { setError('backend_down'); return }
      if (res.status === 403) { setError('forbidden'); return }
      if (!res.ok) { setError(`${res.status}`); return }
      const data = await res.json()
      setUsers(Array.isArray(data.data) ? data.data : [])
    } catch (err: any) {
      setError(err?.message || 'unknown')
    } finally {
      setLoading(false); setRetrying(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleRetry = () => { setRetrying(true); fetchUsers() }

  // Change a wrong account type (individual / parent / school / T-LAB)
  const handleChangeType = async (user: User, newType: string) => {
    if (!newType) return
    let institutionName = ''
    if (newType === 'school' || newType === 'tlab') {
      const entered = window.prompt(`Name of the ${newType === 'school' ? 'school' : 'T-LAB'} for ${user.name}:`, user.guardianInfo?.institutionName || '')
      if (!entered || !entered.trim()) return
      institutionName = entered.trim()
    }
    if (!confirm(`Change ${user.name} to "${newType}"? Goins and projects stay as they are.`)) return
    try {
      const token = await authToken()
      const res = await fetch(`${API_BASE}/admin/users/${user.id}/account-type`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: newType, institutionName }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { alert(body.message || `Could not change (${res.status})`); return }
      await fetchUsers()
    } catch (e: any) {
      alert(e?.message || 'Could not change the account type')
    }
  }

  // Safe delete (Oct 2026): opens a dialog that explains what happens to students and content first.
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const handleDeleteUser = (userId: string) => {
    const u = users.find(x => x.id === userId)
    if (u) setDeleteTarget(u)
  }

  // Cities that actually exist in the data — built dynamically, so this
  // never needs manual upkeep as new schools/parents are added.
  const cities = useMemo(() => {
    const set = new Set<string>()
    users.forEach(u => { if (u.guardianInfo?.city) set.add(u.guardianInfo.city) })
    return Array.from(set).sort()
  }, [users])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return users.filter(u => {
      const type = accountTypeOf(u)
      if (accountFilter !== 'all' && type.key !== accountFilter) return false
      if (cityFilter !== 'all' && u.guardianInfo?.city !== cityFilter) return false
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false
      return true
    })
  }, [users, accountFilter, cityFilter, search])

  const counts = useMemo(() => {
    const c: Record<AccountFilter, number> = { all: users.length, children: 0, individuals: 0, parents: 0, schools: 0, tlabs: 0 }
    users.forEach(u => { c[accountTypeOf(u).key]++ })
    return c
  }, [users])

  if (loading) {
    return <div className="space-y-4">{[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}</div>
  }

  if (error) {
    const isBackendDown = error === 'backend_down'
    const isForbidden = error === 'forbidden'
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isBackendDown ? 'bg-red-100' : 'bg-amber-100'}`}>
          <WifiOff className={`h-8 w-8 ${isBackendDown ? 'text-red-500' : 'text-amber-500'}`} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {isBackendDown ? 'Backend Server is Down' : isForbidden ? 'Access Denied' : 'Could Not Load Users'}
        </h2>
        <p className="text-gray-500 text-sm mb-6 max-w-sm">
          {isBackendDown ? 'The API server returned a 502 error. Your backend is not running or is unreachable.'
            : isForbidden ? 'Your admin token does not have permission to view users.'
            : `Error: ${error}`}
        </p>
        <button onClick={handleRetry} disabled={retrying}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
          {retrying ? 'Retrying...' : 'Retry'}
        </button>
      </div>
    )
  }

  const chips: { key: AccountFilter; label: string }[] = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'children', label: `🧒 Children (${counts.children})` },
    { key: 'individuals', label: `🧒 Individual learners (${counts.individuals})` },
    { key: 'parents', label: `👨‍👩‍👧 Parents (${counts.parents})` },
    { key: 'schools', label: `🏫 Schools (${counts.schools})` },
    { key: 'tlabs', label: `🔬 T-LABs (${counts.tlabs})` },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">One click to see just children, just parents, a whole city, or search by name/email.</p>
        <button onClick={handleRetry} disabled={retrying}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map(c => (
          <button key={c.key} onClick={() => setAccountFilter(c.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              accountFilter === c.key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>{c.label}</button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Search by name or email..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {cities.length > 0 && (
          <select value={cityFilter} onChange={e => setCityFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="all">All Cities</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      <Card className="border-0 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Email / Login ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">City / Institution</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Goins</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Wallet ₹</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No users match these filters</td></tr>
              ) : filtered.map(user => {
                const type = accountTypeOf(user)
                const g: GuardianInfo | null | undefined = user.guardianInfo
                return (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${type.badgeClass}`}>{type.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {g?.institutionName || g?.city
                        ? [g.institutionName, g.city].filter(Boolean).join(' · ')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 font-bold text-amber-600">⬡ {user.score ?? 0}</td>
                    <td className="px-4 py-3 font-semibold text-green-700">₹{(user.wallet?.balance ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/users/${user.id}`}>View</Link>
                        </Button>
                        {!user.phoneNumber?.startsWith('child_') && user.role === 'USER' && (
                          <select defaultValue="" onChange={e => { handleChangeType(user, e.target.value); e.target.value = '' }}
                            className="px-2 py-1 border border-gray-200 rounded-md text-xs bg-white" title="Change account type">
                            <option value="">Change type…</option>
                            <option value="individual">Individual</option>
                            <option value="parent">Parent</option>
                            <option value="school">School</option>
                            <option value="tlab">T-LAB</option>
                          </select>
                        )}
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(user.id)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {deleteTarget && (
        <DeleteUserDialog
          user={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => { const id = deleteTarget.id; setDeleteTarget(null); setUsers(prev => prev.filter(u => u.id !== id)) }}
        />
      )}
    </div>
  )
}

// Dialog for "Delete" in the Directory: shows the students and content first, lets the admin
// keep the content (moved to the MiniGuru account) or remove everything. Students always stay.
function DeleteUserDialog({ user, onClose, onDeleted }: { user: User; onClose: () => void; onDeleted: () => void }) {
  const [preview, setPreview] = useState<any>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mode, setMode] = useState<'keep' | 'remove'>('keep')
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const token = await authToken()
        const res = await fetch(`${API_BASE}/admin/users/${user.id}/delete-preview`, { headers: { Authorization: `Bearer ${token}` } })
        const body = await res.json().catch(() => ({}))
        if (!alive) return
        if (!res.ok) { setLoadError(body.message || `Could not load (${res.status})`); return }
        setPreview(body)
      } catch (e: any) {
        if (alive) setLoadError(e?.message || 'Could not load')
      }
    })()
    return () => { alive = false }
  }, [user.id])

  const confirmDelete = async () => {
    if (busy) return
    setBusy(true); setError(null)
    try {
      const token = await authToken()
      const res = await fetch(`${API_BASE}/admin/users/${user.id}/delete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, confirm: 'DELETE' }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setError(body.message || `Could not delete (${res.status})`); return }
      onDeleted()
    } catch (e: any) {
      setError(e?.message || 'Could not delete')
    } finally {
      setBusy(false)
    }
  }

  const c = preview?.content
  const st = preview?.students
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-gray-900">Delete {user.name}?</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        {loadError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-3">{loadError}</div>}
        {!preview && !loadError && <div className="py-6 text-center text-gray-500 text-sm"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Checking what this account has…</div>}
        {preview && (
          <>
            {(st.count > 0 || st.withoutLogin > 0) && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 mb-3">
                <b>{st.count} student{st.count === 1 ? '' : 's'} will stay on MiniGuru</b> as independent learners, with their own login, Goins and projects.
                {st.names.length > 0 && <div className="text-xs mt-1">{st.names.join(', ')}{st.count > st.names.length ? ' …' : ''}</div>}
                {st.withoutLogin > 0 && <div className="text-xs mt-1 text-amber-700">{st.withoutLogin} older student entr{st.withoutLogin === 1 ? 'y has' : 'ies have'} no login of their own and will be removed.</div>}
              </div>
            )}
            {preview.inSomeonesList > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 mb-3">This person is in a school or family list. They will be taken out of it.</div>
            )}
            <div className="text-sm text-gray-700 mb-3">
              Their account has {c.projects} project{c.projects === 1 ? '' : 's'}, {c.projectComments + c.videoComments} comment{c.projectComments + c.videoComments === 1 ? '' : 's'} and ⬡ {preview.user.score} Goins.
              YouTube videos always stay online either way.
            </div>
            <label className="flex items-start gap-2 p-3 border rounded-lg mb-2 cursor-pointer">
              <input type="radio" className="mt-1" checked={mode === 'keep'} onChange={() => setMode('keep')} />
              <span className="text-sm"><b>Delete and keep content (recommended)</b><br />
                <span className="text-gray-600">Projects, comments, ratings and Goins move to the MiniGuru account ({preview.keepAccount ? preview.keepAccount.email : 'not found'}), then the person is deleted.</span>
              </span>
            </label>
            {mode === 'keep' && !preview.keepAccount && (
              <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 mb-2">The MiniGuru account was not found, so this option will not work. Choose "remove everything" or create that account first.</div>
            )}
            <label className="flex items-start gap-2 p-3 border rounded-lg mb-3 cursor-pointer">
              <input type="radio" className="mt-1" checked={mode === 'remove'} onChange={() => setMode('remove')} />
              <span className="text-sm"><b>Delete and remove everything of theirs</b><br />
                <span className="text-gray-600">Projects, comments and Goins records are removed from MiniGuru. This cannot be undone.</span>
              </span>
            </label>
            <label className="text-xs font-medium text-gray-500">Type DELETE to confirm</label>
            <input value={typed} onChange={e => setTyped(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3" placeholder="DELETE" />
          </>
        )}
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-3">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="destructive" onClick={confirmDelete}
            disabled={busy || !preview || typed !== 'DELETE' || (mode === 'keep' && !preview?.keepAccount)}>
            {busy ? 'Deleting…' : 'Delete account'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — SCHOOLS & T-LABS  (unchanged logic from the old /schools page)
// ═══════════════════════════════════════════════════════════════════════════
interface SchoolAccount {
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

interface Credentials { email: string; password: string; label: string }

const EMPTY_SCHOOL_FORM = {
  institutionName: '', mentorType: 'SCHOOL' as 'SCHOOL' | 'TLAB',
  contactName: '', contactPhone: '', contactEmail: '',
  city: '', state: '', pincode: '',
}

function CredentialsModal({ creds, onClose }: { creds: Credentials; onClose: () => void }) {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const copy = (text: string, field: string) => {
    navigator.clipboard.writeText(text); setCopiedField(field); setTimeout(() => setCopiedField(null), 1500)
  }
  const copyBoth = () => {
    navigator.clipboard.writeText(`Login: ${creds.email}\nPassword: ${creds.password}`)
    setCopiedField('both'); setTimeout(() => setCopiedField(null), 1500)
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-gray-900">{creds.label}</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 mb-4">
          Save or share these now. The password will not be shown again.
        </div>
        <label className="text-xs font-medium text-gray-500">Login ID</label>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono bg-gray-50">{creds.email}</div>
          <button onClick={() => copy(creds.email, 'email')} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            {copiedField === 'email' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-500" />}
          </button>
        </div>
        <label className="text-xs font-medium text-gray-500">Password</label>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono bg-gray-50">{creds.password}</div>
          <button onClick={() => copy(creds.password, 'password')} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            {copiedField === 'password' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-500" />}
          </button>
        </div>
        <button onClick={copyBoth}
          className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center justify-center gap-2">
          {copiedField === 'both' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          Copy login + password
        </button>
      </div>
    </div>
  )
}

function SchoolsTab() {
  const router = useRouter()
  const [schools, setSchools] = useState<SchoolAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(EMPTY_SCHOOL_FORM)
  const [saving, setSaving] = useState(false)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [creds, setCreds] = useState<Credentials | null>(null)

  const flash = (msg: string, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(''), 6000) }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  }

  const load = async () => {
    setLoading(true); setError('')
    try {
      const token = await authToken()
      const res = await fetch(`${API_BASE}/admin/schools`, { headers: { Authorization: `Bearer ${token}` } })
      const data = res.ok ? await res.json() : []
      setSchools(Array.isArray(data) ? data : [])
    } catch (e: any) {
      flash('Backend not connected: ' + e.message, true)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = schools.filter(s => {
    const q = search.toLowerCase()
    return s.institutionName?.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.city?.toLowerCase().includes(q)
  })

  const handleCreate = async () => {
    if (!form.institutionName.trim()) { flash('Institution name is required', true); return }
    setSaving(true)
    try {
      const token = await authToken()
      const res = await fetch(`${API_BASE}/admin/create-school-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to create account')
      setShowCreate(false); setForm(EMPTY_SCHOOL_FORM)
      flash('School account created: ' + data.credentials.email)
      setCreds({ ...data.credentials, label: 'Account created' })
      load()
    } catch (e: any) {
      flash(e.message, true)
    } finally { setSaving(false) }
  }

  const handleResetPassword = async (s: SchoolAccount) => {
    if (!confirm(`Reset password for ${s.institutionName || s.name}?`)) return
    setResettingId(s.id)
    try {
      const token = await authToken()
      const res = await fetch(`${API_BASE}/admin/users/${s.id}/reset-password`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to reset password')
      setCreds({ email: s.email, password: data.newPassword, label: 'Password reset' })
    } catch (e: any) {
      flash(e.message, true)
    } finally { setResettingId(null) }
  }

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      {success && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>}

      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search school, city, or login ID..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Plus className="h-4 w-4" /> Add School / T-LAB
        </button>
      </div>

      <Card className="border-0 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-500">Institution</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500">Type</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500">Login ID</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500">Location</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500">Students</th>
                <th className="text-right px-3 py-2 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">No school or T-LAB accounts yet. Add one to get started.</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} onClick={() => router.push(`/schools/${s.id}`)} className="hover:bg-indigo-50/30 cursor-pointer">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-gray-900">{s.institutionName || s.name}</div>
                    {s.phoneNumber && <div className="text-xs text-gray-400">{s.phoneNumber}</div>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${s.mentorType === 'SCHOOL' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {s.mentorType === 'SCHOOL' ? 'School' : 'T-LAB'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{s.email}</td>
                  <td className="px-3 py-2.5 text-gray-600">{[s.city, s.state].filter(Boolean).join(', ') || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600">{s.studentCount}</td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); router.push(`/schools/${s.id}`) }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50">
                        Manage
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleResetPassword(s) }} disabled={resettingId === s.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50 disabled:opacity-40">
                        {resettingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                        Reset Password
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Add School / T-LAB Account</h3>
              <button onClick={() => setShowCreate(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Institution name *</label>
                <input value={form.institutionName} onChange={e => setForm({ ...form, institutionName: e.target.value })}
                  placeholder="e.g. Sunrise Public School"
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Account type</label>
                <select value={form.mentorType} onChange={e => setForm({ ...form, mentorType: e.target.value as 'SCHOOL' | 'TLAB' })}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="SCHOOL">School</option>
                  <option value="TLAB">T-LAB</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">Contact name</label>
                  <input value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })}
                    placeholder="Teacher / coordinator"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Contact phone</label>
                  <input value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })}
                    placeholder="Optional"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Contact email (real inbox)</label>
                <input value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })}
                  placeholder="teacher's real email — needed to send credentials"
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                <p className="mt-1 text-[11px] text-gray-400">
                  The login ID below will be auto-generated and isn't a real inbox — this is where student credentials actually get emailed.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">City</label>
                  <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">State</label>
                  <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Pincode</label>
                  <input value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
              </div>
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-700">
                A login ID will be generated automatically from the institution name
                (e.g. <span className="font-mono">sunrise.public.school@miniguru.in</span>) along with a
                random password. You will see both once, right after creating the account.
              </div>
              <button onClick={handleCreate} disabled={saving}
                className="w-full mt-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Account
              </button>
            </div>
          </div>
        </div>
      )}

      {creds && <CredentialsModal creds={creds} onClose={() => setCreds(null)} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3 — CONTACT CHANGE REQUESTS  (unchanged logic from the old page)
// ═══════════════════════════════════════════════════════════════════════════
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

function ContactChangesTab() {
  const [requests, setRequests] = useState<ChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const token = await authToken()
      const res = await fetch(`${API_BASE}/admin/contact-change-requests`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setRequests(Array.isArray(data.requests) ? data.requests : [])
    } catch {
      setRequests([])
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const act = async (userId: string, action: 'approve' | 'reject') => {
    setBusyId(userId)
    try {
      const token = await authToken()
      await fetch(`${API_BASE}/admin/contact-change-requests/${userId}/${action}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      })
      await load()
    } finally { setBusyId(null) }
  }

  return (
    <div className="max-w-3xl">
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
                    <p className="text-xs text-gray-400 mt-1">Requested {new Date(r.contactChangeRequestedAt).toLocaleString()}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button disabled={busyId === r.id} onClick={() => act(r.id, 'approve')}
                    className="text-xs px-3 py-1.5 rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Approve
                  </button>
                  <button disabled={busyId === r.id} onClick={() => act(r.id, 'reject')}
                    className="text-xs px-3 py-1.5 rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 flex items-center gap-1">
                    <X className="w-3 h-3" /> Reject
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 4 — MERGE DUPLICATE ACCOUNTS (admin only)
// ═══════════════════════════════════════════════════════════════════════════
type MergeUser = { id: string; name: string; email: string; age?: number; score: number; projects: number; school: string | null }

function MergePicker({ label, tone, value, onPick }: { label: string; tone: string; value: MergeUser | null; onPick: (u: MergeUser | null) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<MergeUser[]>([])
  const [busy, setBusy] = useState(false)

  const search = async () => {
    if (q.trim().length < 2) return
    setBusy(true)
    try {
      const token = await authToken()
      const res = await fetch(`${API_BASE}/admin/merge-accounts/search?q=${encodeURIComponent(q.trim())}`, { headers: { Authorization: `Bearer ${token}` } })
      const j = await res.json()
      setResults(j.users || [])
    } catch { setResults([]) }
    setBusy(false)
  }

  return (
    <Card className={`p-4 border-2 ${tone}`}>
      <h3 className="font-semibold text-sm mb-2">{label}</h3>
      {value ? (
        <div className="text-sm">
          <p className="font-semibold">{value.name}</p>
          <p className="text-gray-500">{value.email}</p>
          <p className="text-gray-600 mt-1">🪙 {value.score} Goins · {value.projects} projects{value.school ? ` · ${value.school}` : ' · individual'}</p>
          <button className="text-xs text-blue-600 mt-2 underline" onClick={() => onPick(null)}>Change</button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') search() }}
              placeholder="Type name or login ID, press Enter"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <Button variant="outline" onClick={search} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button>
          </div>
          <div className="mt-2 space-y-1 max-h-56 overflow-auto">
            {results.map(u => (
              <button key={u.id} onClick={() => onPick(u)} className="w-full text-left text-sm border rounded-lg px-3 py-2 hover:bg-gray-50">
                <span className="font-medium">{u.name}</span> <span className="text-gray-500">{u.email}</span>
                <span className="block text-xs text-gray-500">🪙 {u.score} · {u.projects} projects{u.school ? ` · ${u.school}` : ' · individual'}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}

function MergeTab() {
  const [keep, setKeep] = useState<MergeUser | null>(null)
  const [drop, setDrop] = useState<MergeUser | null>(null)
  const [preview, setPreview] = useState<any>(null)
  const [err, setErr] = useState('')
  const [excludeStarter, setExcludeStarter] = useState(true)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<any>(null)

  const reset = () => { setKeep(null); setDrop(null); setPreview(null); setErr(''); setTyped(''); setDone(null) }

  const loadPreview = async () => {
    if (!keep || !drop) return
    setErr(''); setPreview(null); setBusy(true)
    try {
      const token = await authToken()
      const res = await fetch(`${API_BASE}/admin/merge-accounts/preview?keepId=${keep.id}&dropId=${drop.id}`, { headers: { Authorization: `Bearer ${token}` } })
      const j = await res.json()
      if (!res.ok) setErr(j.message || 'Could not preview')
      else setPreview(j)
    } catch { setErr('Could not reach the server') }
    setBusy(false)
  }

  const doMerge = async () => {
    if (!keep || !drop) return
    setBusy(true); setErr('')
    try {
      const token = await authToken()
      const res = await fetch(`${API_BASE}/admin/merge-accounts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepId: keep.id, dropId: drop.id, excludeStarterGoins: excludeStarter, confirm: typed }),
      })
      const j = await res.json()
      if (!res.ok) setErr(j.message || 'Merge failed')
      else setDone(j)
    } catch { setErr('Could not reach the server') }
    setBusy(false)
  }

  const labels: Record<string, string> = {
    projects: 'Projects', collaborations: 'Projects as collaborator', videoViews: 'Video views', videoLikes: 'Video likes',
    videoComments: 'Video comments', notifications: 'Notifications', projectComments: 'Project comments', projectLikes: 'Project likes',
    orders: 'Orders', ratingsGiven: 'Ratings given', ratingsReceived: 'Ratings received', goinsLedgerRows: 'Goins ledger rows',
    dailyQuestDays: 'Daily quest days', goinsRequests: 'Goins requests', videoUploads: 'Video uploads', activeSchoolLinks: 'School links', pendingJoinRequests: 'Waiting join requests',
  }

  if (done) {
    return (
      <Card className="p-6 space-y-3">
        <h2 className="text-lg font-semibold text-green-700 flex items-center gap-2"><Check className="h-5 w-5" /> Accounts merged</h2>
        <p className="text-sm">Everything now lives on <b>{done.keptName}</b>. New Goins total: <b>{done.goinsAfter}</b>. The other account is closed and can no longer log in.</p>
        <Button onClick={reset}>Merge another pair</Button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-amber-50 border-amber-200 text-sm text-amber-900">
        Use this when one child made two accounts. Pick the account to <b>keep</b> and the duplicate to <b>close</b>. Goins add up, projects and
        everything else move to the kept account, and the child's name on projects becomes the kept account's name. The closed account is not
        deleted but can no longer log in. This cannot be undone from here, so check the preview first.
      </Card>
      <div className="grid md:grid-cols-2 gap-4">
        <MergePicker label="1. Account to KEEP" tone="border-green-300" value={keep} onPick={u => { setKeep(u); setPreview(null) }} />
        <MergePicker label="2. Duplicate account to CLOSE" tone="border-red-300" value={drop} onPick={u => { setDrop(u); setPreview(null) }} />
      </div>
      {keep && drop && !preview && (
        <Button onClick={loadPreview} disabled={busy}>{busy ? 'Checking...' : 'Show what will move'}</Button>
      )}
      {err && <p className="text-sm text-red-600">{err}</p>}
      {preview && (
        <Card className="p-5 space-y-4">
          <h3 className="font-semibold">Preview — nothing has changed yet</h3>
          <div className="text-sm grid sm:grid-cols-2 gap-x-6 gap-y-1">
            {Object.entries(preview.counts).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-gray-100 py-1"><span className="text-gray-600">{labels[k] || k}</span><b>{String(v)}</b></div>
            ))}
          </div>
          <div className="text-sm bg-gray-50 rounded-lg p-3 space-y-1">
            <p>Goins now: {preview.keep.name} <b>{preview.goins.keepNow}</b> + {preview.drop.name} <b>{preview.goins.dropNow}</b></p>
            <label className="flex items-center gap-2 mt-1">
              <input type="checkbox" checked={excludeStarter} onChange={e => setExcludeStarter(e.target.checked)} />
              Do not count the closed account's {preview.goins.starterBonusOfClosed} starter Goins (every new account gets 100 free)
            </label>
            <p>New total: <b>{excludeStarter ? preview.goins.totalWithoutStarter : preview.goins.totalIfAll}</b></p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input value={typed} onChange={e => setTyped(e.target.value)} placeholder="Type MERGE to confirm"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48" />
            <Button onClick={doMerge} disabled={busy || typed !== 'MERGE'} className="bg-red-600 hover:bg-red-700 text-white">
              {busy ? 'Merging...' : 'Merge accounts'}
            </Button>
            <Button variant="outline" onClick={reset}>Start over</Button>
          </div>
        </Card>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE — one nav entry, four tabs
// ═══════════════════════════════════════════════════════════════════════════
function PeoplePageInner() {
  const searchParams = useSearchParams()
  const initialTab = (['directory', 'schools', 'contact', 'merge'].includes(searchParams.get('tab') || '')
    ? searchParams.get('tab') : 'directory') as 'directory' | 'schools' | 'contact' | 'merge'
  const [tab, setTab] = useState<'directory' | 'schools' | 'contact' | 'merge'>(initialTab)

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UsersIcon className="h-6 w-6 text-blue-600" /> People
          </h1>
          <p className="text-sm text-gray-500 mt-1">Everyone on MiniGuru — children, parents, schools — and requests about their accounts.</p>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setTab('directory')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'directory' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}><UsersIcon className="h-4 w-4" /> Directory</button>
          <button onClick={() => setTab('schools')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'schools' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}><School className="h-4 w-4" /> Schools &amp; T-LABs</button>
          <button onClick={() => setTab('contact')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'contact' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}><ShieldAlert className="h-4 w-4" /> Contact Changes</button>
          <button onClick={() => setTab('merge')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'merge' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}><UsersIcon className="h-4 w-4" /> Merge Accounts</button>
        </div>

        {tab === 'directory' && <DirectoryTab />}
        {tab === 'schools' && <SchoolsTab />}
        {tab === 'contact' && <ContactChangesTab />}
        {tab === 'merge' && <MergeTab />}
      </div>
    </AdminLayout>
  )
}

// Next.js 15 requires any component that calls useSearchParams() to be
// wrapped in a Suspense boundary, or `next build` fails outright. Same
// fix as goins/page.tsx — see the comment there for what this caused.
export default function PeoplePage() {
  return (
    <Suspense fallback={null}>
      <PeoplePageInner />
    </Suspense>
  )
}
