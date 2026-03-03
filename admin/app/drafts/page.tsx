'use client'

import React, { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import { Search, RefreshCw, Trash2, Eye, FileEdit, ChevronDown, ChevronUp, CheckCircle, Clock, Filter } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

interface DraftMaterial {
  id: string
  name: string
  quantity: number
  goinsPerUnit: number
}

interface AdminDraft {
  id: number
  userId: string
  studentName: string
  studentEmail: string
  title: string
  description: string
  category: string
  startDate: string | null
  endDate: string | null
  materials: DraftMaterial[]
  totalGoinsNeeded: number
  hasVideo: boolean
  hasThumbnail: boolean
  createdAt: string
  updatedAt: string
}

async function authHeader() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') || '' : ''
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

// ── Mock data (shown when backend not ready) ──────────────────────────────
const MOCK_DRAFTS: AdminDraft[] = [
  {
    id: 1, userId: 'u1', studentName: 'Arjun Kumar', studentEmail: 'arjun@test.com',
    title: 'Solar Powered Robot', description: 'A robot that runs on solar panels built with servo motors',
    category: 'Robotics', startDate: '2026-01-10', endDate: '2026-02-10',
    materials: [{ id: 'm1', name: 'Servo Motor', quantity: 2, goinsPerUnit: 50 }, { id: 'm2', name: 'Solar Panel', quantity: 1, goinsPerUnit: 100 }],
    totalGoinsNeeded: 200, hasVideo: false, hasThumbnail: false, createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-01-20T14:00:00Z',
  },
  {
    id: 2, userId: 'u2', studentName: 'Priya Sharma', studentEmail: 'priya@test.com',
    title: 'Paper Bridge Challenge', description: 'Engineering a bridge made of newspaper that holds maximum weight',
    category: 'Mechanics', startDate: '2026-01-05', endDate: '2026-01-25',
    materials: [{ id: 'm3', name: 'Newspaper Roll', quantity: 5, goinsPerUnit: 10 }],
    totalGoinsNeeded: 50, hasVideo: true, hasThumbnail: true, createdAt: '2026-01-08T09:00:00Z', updatedAt: '2026-01-22T16:30:00Z',
  },
  {
    id: 3, userId: 'u3', studentName: 'Ravi Patel', studentEmail: 'ravi@test.com',
    title: 'Art from Recycled Cans', description: 'Creating artwork using recycled aluminium cans and paints',
    category: 'ArtCraft', startDate: null, endDate: null,
    materials: [],
    totalGoinsNeeded: 0, hasVideo: false, hasThumbnail: false, createdAt: '2026-01-18T11:00:00Z', updatedAt: '2026-01-18T11:00:00Z',
  },
]

function readinessLabel(draft: AdminDraft) {
  if (draft.hasVideo && draft.hasThumbnail && draft.startDate && draft.endDate && draft.materials.length > 0) {
    return { label: 'Ready to Submit', color: 'bg-green-100 text-green-700', icon: '✅' }
  }
  if (draft.hasVideo || draft.hasThumbnail) {
    return { label: 'Partially Done', color: 'bg-yellow-100 text-yellow-700', icon: '🔶' }
  }
  return { label: 'Just Started', color: 'bg-gray-100 text-gray-500', icon: '📝' }
}

export default function DraftsPage() {
  const [drafts, setDrafts]       = useState<AdminDraft[]>([])
  const [filtered, setFiltered]   = useState<AdminDraft[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [catFilter, setCatFilter] = useState('All')
  const [expanded, setExpanded]   = useState<number | null>(null)
  const [error, setError]         = useState('')
  const [categories, setCategories] = useState<string[]>(['All'])

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res  = await fetch(`${API_BASE}/admin/drafts`, { headers: await authHeader() })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      const list: AdminDraft[] = Array.isArray(data) ? data : data.drafts ?? []
      setDrafts(list); setFiltered(list)
      const cats = ['All', ...new Set(list.map(d => d.category).filter(Boolean))]
      setCategories(cats)
    } catch {
      setError('Backend not connected — showing sample data. Needs: GET /admin/drafts')
      setDrafts(MOCK_DRAFTS); setFiltered(MOCK_DRAFTS)
      setCategories(['All', 'Robotics', 'Mechanics', 'ArtCraft', 'Science'])
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(drafts.filter(d => {
      const matchSearch = d.title.toLowerCase().includes(q) ||
        d.studentName.toLowerCase().includes(q) ||
        d.studentEmail.toLowerCase().includes(q)
      const matchCat = catFilter === 'All' || d.category === catFilter
      return matchSearch && matchCat
    }))
  }, [search, catFilter, drafts])

  const deleteDraft = async (id: number) => {
    if (!confirm('Delete this draft? This cannot be undone.')) return
    try {
      const res = await fetch(`${API_BASE}/admin/drafts/${id}`, { method: 'DELETE', headers: await authHeader() })
      if (!res.ok) throw new Error(`${res.status}`)
      setDrafts(prev => prev.filter(d => d.id !== id))
    } catch { alert('Could not delete — check backend connection') }
  }

  // ── Summary stats ──────────────────────────────────────────
  const readyCount    = drafts.filter(d => d.hasVideo && d.hasThumbnail && d.startDate && d.endDate && d.materials.length > 0).length
  const partialCount  = drafts.filter(d => !d.hasVideo || !d.hasThumbnail).length
  const totalGoins    = drafts.reduce((s, d) => s + d.totalGoinsNeeded, 0)

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📝 Student Drafts</h1>
            <p className="text-sm text-gray-500 mt-1">Monitor all in-progress student projects</p>
          </div>
          <button onClick={load}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {error && <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">{error}</div>}

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 border-0 shadow-sm">
            <p className="text-xs text-gray-400 uppercase font-semibold">Total Drafts</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{drafts.length}</p>
          </Card>
          <Card className="p-4 border-0 shadow-sm">
            <p className="text-xs text-gray-400 uppercase font-semibold">Ready to Submit</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{readyCount}</p>
          </Card>
          <Card className="p-4 border-0 shadow-sm">
            <p className="text-xs text-gray-400 uppercase font-semibold">Missing Media</p>
            <p className="text-3xl font-bold text-yellow-600 mt-1">{partialCount}</p>
          </Card>
          <Card className="p-4 border-0 shadow-sm">
            <p className="text-xs text-gray-400 uppercase font-semibold">Goines Committed</p>
            <p className="text-3xl font-bold text-amber-600 mt-1">{totalGoins.toLocaleString()}</p>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4 border-0 shadow-sm">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Search by title, student name or email..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </Card>

        {/* Drafts table */}
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">Student</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">Project</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3 hidden md:table-cell">Category</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase px-5 py-3 hidden md:table-cell">Status</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase px-5 py-3 hidden lg:table-cell">Goines</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">No drafts found</td></tr>
                ) : filtered.map(d => {
                  const status = readinessLabel(d)
                  const isExp  = expanded === d.id
                  return (
                    <React.Fragment key={d.id}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        {/* Student */}
                        <td className="px-5 py-4">
                          <p className="font-medium text-gray-900 text-sm">{d.studentName}</p>
                          <p className="text-xs text-gray-400">{d.studentEmail}</p>
                        </td>
                        {/* Project */}
                        <td className="px-5 py-4">
                          <p className="font-medium text-gray-900 text-sm">{d.title}</p>
                          <p className="text-xs text-gray-400 line-clamp-1">{d.description}</p>
                        </td>
                        {/* Category */}
                        <td className="px-5 py-4 hidden md:table-cell">
                          <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">{d.category || '—'}</span>
                        </td>
                        {/* Status */}
                        <td className="px-5 py-4 hidden md:table-cell text-center">
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${status.color}`}>
                            {status.icon} {status.label}
                          </span>
                        </td>
                        {/* Goines */}
                        <td className="px-5 py-4 hidden lg:table-cell text-center">
                          <span className="text-amber-600 font-bold text-sm">
                            {d.totalGoinsNeeded > 0 ? `${d.totalGoinsNeeded} G` : '—'}
                          </span>
                        </td>
                        {/* Actions */}
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => setExpanded(isExp ? null : d.id)}
                              className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-gray-50"
                              title="View details">
                              {isExp ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              Details
                            </button>
                            <button onClick={() => deleteDraft(d.id)}
                              className="p-1.5 border border-red-200 rounded-lg hover:bg-red-50 text-red-500"
                              title="Delete draft">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExp && (
                        <tr className="bg-gray-50">
                          <td colSpan={6} className="px-5 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* Timeline */}
                              <div className="bg-white rounded-lg p-3 border border-gray-100">
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">📅 Timeline</p>
                                <p className="text-sm text-gray-700">Start: <span className="font-medium">{d.startDate ? new Date(d.startDate).toLocaleDateString('en-IN') : '—'}</span></p>
                                <p className="text-sm text-gray-700">End: <span className="font-medium">{d.endDate ? new Date(d.endDate).toLocaleDateString('en-IN') : '—'}</span></p>
                              </div>

                              {/* Media status */}
                              <div className="bg-white rounded-lg p-3 border border-gray-100">
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">🎬 Media</p>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={d.hasVideo ? 'text-green-500' : 'text-gray-300'}>●</span>
                                  <span className="text-sm text-gray-700">Video {d.hasVideo ? '✅ uploaded' : '❌ missing'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={d.hasThumbnail ? 'text-green-500' : 'text-gray-300'}>●</span>
                                  <span className="text-sm text-gray-700">Thumbnail {d.hasThumbnail ? '✅ uploaded' : '❌ missing'}</span>
                                </div>
                              </div>

                              {/* Materials */}
                              <div className="bg-white rounded-lg p-3 border border-gray-100">
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">🧰 Materials ({d.materials.length})</p>
                                {d.materials.length === 0
                                  ? <p className="text-sm text-gray-400">No materials selected</p>
                                  : d.materials.slice(0, 4).map(m => (
                                    <div key={m.id} className="flex justify-between text-sm text-gray-700">
                                      <span>{m.name} ×{m.quantity}</span>
                                      <span className="text-amber-600 font-medium">{m.quantity * m.goinsPerUnit}G</span>
                                    </div>
                                  ))}
                                {d.materials.length > 4 && <p className="text-xs text-gray-400 mt-1">+{d.materials.length - 4} more</p>}
                              </div>
                            </div>

                            {/* Description */}
                            <div className="mt-3 bg-white rounded-lg p-3 border border-gray-100">
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">📋 Description</p>
                              <p className="text-sm text-gray-700">{d.description}</p>
                            </div>

                            <p className="text-xs text-gray-300 mt-2 text-right">
                              Created {new Date(d.createdAt).toLocaleDateString('en-IN')} · Updated {new Date(d.updatedAt).toLocaleDateString('en-IN')}
                            </p>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AdminLayout>
  )
}