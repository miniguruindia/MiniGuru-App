'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import {
  School, Plus, KeyRound, X, Copy, Check, Search, RefreshCw, Loader2,
} from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

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

interface Credentials {
  email: string
  password: string
  label: string
}

const EMPTY_FORM = {
  institutionName: '',
  mentorType: 'SCHOOL' as 'SCHOOL' | 'TLAB',
  contactName: '',
  contactPhone: '',
  city: '',
  state: '',
  pincode: '',
}

async function authToken() {
  const v = `; ${document.cookie}`
  const p = v.split('; auth_token=')
  return p.length === 2 ? p.pop()!.split(';').shift()! : ''
}

function CredentialsModal({ creds, onClose }: { creds: Credentials; onClose: () => void }) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 1500)
  }

  const copyBoth = () => {
    navigator.clipboard.writeText(`Login: ${creds.email}\nPassword: ${creds.password}`)
    setCopiedField('both')
    setTimeout(() => setCopiedField(null), 1500)
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
          <div className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono bg-gray-50">
            {creds.email}
          </div>
          <button
            onClick={() => copy(creds.email, 'email')}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            {copiedField === 'email' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-500" />}
          </button>
        </div>

        <label className="text-xs font-medium text-gray-500">Password</label>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono bg-gray-50">
            {creds.password}
          </div>
          <button
            onClick={() => copy(creds.password, 'password')}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            {copiedField === 'password' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-500" />}
          </button>
        </div>

        <button
          onClick={copyBoth}
          className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center justify-center gap-2"
        >
          {copiedField === 'both' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          Copy login + password
        </button>
      </div>
    </div>
  )
}

export default function SchoolsPage() {
  const router = useRouter()
  const [schools, setSchools]   = useState<SchoolAccount[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)

  const [resettingId, setResettingId] = useState<string | null>(null)
  const [creds, setCreds]             = useState<Credentials | null>(null)

  const flash = (msg: string, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(''), 6000) }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  }

  const load = async () => {
    setLoading(true); setError('')
    try {
      const token = await authToken()
      const res = await fetch(`${API_BASE}/admin/schools`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = res.ok ? await res.json() : []
      setSchools(Array.isArray(data) ? data : [])
    } catch (e: any) {
      flash('Backend not connected: ' + e.message, true)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = schools.filter(s => {
    const q = search.toLowerCase()
    return (
      s.institutionName?.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.city?.toLowerCase().includes(q)
    )
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

      setShowCreate(false)
      setForm(EMPTY_FORM)
      flash('School account created: ' + data.credentials.email)
      setCreds({ ...data.credentials, label: 'Account created' })
      load()
    } catch (e: any) {
      flash(e.message, true)
    } finally { setSaving(false) }
  }

  const handleResetPassword = async (s: SchoolAccount) => {
    if (!confirm(`Reset password for ${s.institutionName || s.name} (${s.email})?\n\nThe old password will stop working immediately.`)) return
    setResettingId(s.id)
    try {
      const token = await authToken()
      const res = await fetch(`${API_BASE}/admin/users/${s.id}/reset-password`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to reset password')

      flash('Password reset for ' + s.email)
      setCreds({ ...data.credentials, label: 'Password reset' })
    } catch (e: any) {
      flash(e.message, true)
    } finally { setResettingId(null) }
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <School className="h-6 w-6 text-indigo-600" /> Schools &amp; T-LABs
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Every school/T-LAB account logs in with a <span className="font-mono">@miniguru.in</span> ID
              that the admin controls. Reset the password any time staff changes — the school keeps all
              its student data.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
          >
            <Plus className="h-4 w-4" /> Add School / T-LAB
          </button>
        </div>

        {error   && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        {success && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>}

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, login ID, or city..."
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-72 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>

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
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">
                    No school or T-LAB accounts yet. Add one to get started.
                  </td></tr>
                ) : filtered.map(s => (
                  <tr
                    key={s.id}
                    onClick={() => router.push(`/schools/${s.id}`)}
                    className="hover:bg-indigo-50/30 cursor-pointer"
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-gray-900">{s.institutionName || s.name}</div>
                      {s.phoneNumber && <div className="text-xs text-gray-400">{s.phoneNumber}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        s.mentorType === 'SCHOOL' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {s.mentorType === 'SCHOOL' ? 'School' : 'T-LAB'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{s.email}</td>
                    <td className="px-3 py-2.5 text-gray-600">
                      {[s.city, s.state].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{s.studentCount}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/schools/${s.id}`) }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50"
                        >
                          Manage
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleResetPassword(s) }}
                          disabled={resettingId === s.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50 disabled:opacity-40"
                        >
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
      </div>

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
                <input
                  value={form.institutionName}
                  onChange={e => setForm({ ...form, institutionName: e.target.value })}
                  placeholder="e.g. Sunrise Public School"
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500">Account type</label>
                <select
                  value={form.mentorType}
                  onChange={e => setForm({ ...form, mentorType: e.target.value as 'SCHOOL' | 'TLAB' })}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="SCHOOL">School</option>
                  <option value="TLAB">T-LAB</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">Contact name</label>
                  <input
                    value={form.contactName}
                    onChange={e => setForm({ ...form, contactName: e.target.value })}
                    placeholder="Teacher / coordinator"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Contact phone</label>
                  <input
                    value={form.contactPhone}
                    onChange={e => setForm({ ...form, contactPhone: e.target.value })}
                    placeholder="Optional"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
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
              </div>

              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-700">
                A login ID will be generated automatically from the institution name
                (e.g. <span className="font-mono">sunrise.public.school@miniguru.in</span>) along with a
                random password. You will see both once, right after creating the account.
              </div>

              <button
                onClick={handleCreate}
                disabled={saving}
                className="w-full mt-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Account
              </button>
            </div>
          </div>
        </div>
      )}

      {creds && <CredentialsModal creds={creds} onClose={() => setCreds(null)} />}
    </AdminLayout>
  )
}
