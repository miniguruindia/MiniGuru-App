'use client'

import React, { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import { Search, RefreshCw, Plus, Pencil, Trash2, X, Grid, Package } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

// CHANGED: matches new Material model (goinsPrice not price, category string not ObjectId)
interface Material {
  id: string
  name: string
  description: string | null
  goinsPrice: number
  unit: string
  icon: string | null
  category: string
  imageUrl: string | null
  isActive: boolean
}

async function authToken() {
  return (() => {
    const v = `; ${document.cookie}`
    const p = v.split('; auth_token=')
    return p.length === 2 ? p.pop()!.split(';').shift()! : ''
  })()
}

const EMPTY_MAT = { name: '', description: '', goinsPrice: '', unit: 'piece', icon: '', category: '' }
const CATEGORY_OPTIONS = ['Electronics', 'Paper', 'Scrap', 'Wood', 'Fabric', 'Plastic', 'Metal', 'Other']
const UNIT_OPTIONS = ['piece', 'gram', 'ml', 'cm', 'sheet', 'meter', 'pair']
const EMOJI_OPTIONS = ['📦','🔌','⚙️','🔧','🧲','🪛','🔩','🧪','🎨','✂️','📐','📏','🔋','💡','🪚','🧵','🪡','🎭','🌿','♻️']

export default function MaterialsPage() {
  const [tab, setTab]                     = useState<'materials'|'bulk'>('materials')
  const [materials, setMaterials]         = useState<Material[]>([])
  const [filtered, setFiltered]           = useState<Material[]>([])
  const [catFilter, setCatFilter]         = useState('All')
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [error, setError]                 = useState('')
  const [success, setSuccess]             = useState('')

  const [showMatForm, setShowMatForm]     = useState(false)
  const [editingMat, setEditingMat]       = useState<Material | null>(null)
  const [matForm, setMatForm]             = useState(EMPTY_MAT)
  const [savingMat, setSavingMat]         = useState(false)
  const [deletingMatId, setDeletingMatId] = useState<string|null>(null)

  const [bulkText, setBulkText]           = useState('')
  const [bulkResult, setBulkResult]       = useState<any>(null)
  const [bulkLoading, setBulkLoading]     = useState(false)

  const flash = (msg: string, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(''), 6000) }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  }

  // CHANGED: /materials/admin/all instead of /products/
  const load = async () => {
    setLoading(true); setError('')
    try {
      const token = await authToken()
      const res = await fetch(`${API_BASE}/materials/admin/all`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = res.ok ? await res.json() : []
      setMaterials(Array.isArray(data) ? data : [])
    } catch (e: any) {
      flash('Backend not connected: ' + e.message, true)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(materials.filter(m => {
      const matchSearch = m.name.toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q)
      const matchCat = catFilter === 'All' || m.category === catFilter
      return matchSearch && matchCat
    }))
  }, [search, materials, catFilter])

  const allCats = ['All', ...Array.from(new Set([
    ...CATEGORY_OPTIONS,
    ...materials.map(m => m.category),
  ])).filter(Boolean).sort()]

  const openAddMat = () => { setEditingMat(null); setMatForm(EMPTY_MAT); setShowMatForm(true) }
  const openEditMat = (m: Material) => {
    setEditingMat(m)
    setMatForm({
      name: m.name,
      description: m.description || '',
      goinsPrice: String(m.goinsPrice),
      unit: m.unit || 'piece',
      icon: m.icon || '',
      category: m.category || '',
    })
    setShowMatForm(true)
  }

  // CHANGED: /materials/admin/create and /materials/admin/:id  (JSON not FormData)
  const handleSaveMat = async () => {
    if (!matForm.name || !matForm.goinsPrice || !matForm.category) {
      flash('Name, Goins cost, and category are required', true); return
    }
    setSavingMat(true)
    try {
      const token = await authToken()
      const body = JSON.stringify({
        name: matForm.name,
        description: matForm.description || null,
        goinsPrice: Number(matForm.goinsPrice),
        unit: matForm.unit,
        icon: matForm.icon || null,
        category: matForm.category,
      })
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      const res = editingMat
        ? await fetch(`${API_BASE}/materials/admin/${editingMat.id}`, { method: 'PUT', headers, body })
        : await fetch(`${API_BASE}/materials/admin/create`, { method: 'POST', headers, body })
      if (!res.ok) throw new Error(await res.text())
      flash(editingMat ? 'Material updated!' : 'Material added!')
      setShowMatForm(false); await load()
    } catch (e: any) { flash('Save failed: ' + e.message, true) }
    finally { setSavingMat(false) }
  }

  // CHANGED: soft delete via PUT isActive:false
  const handleDeleteMat = async (id: string) => {
    if (!confirm('Deactivate this material? It will be hidden from children.')) return
    setDeletingMatId(id)
    try {
      const token = await authToken()
      await fetch(`${API_BASE}/materials/admin/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      })
      setMaterials(prev => prev.filter(m => m.id !== id))
      flash('Material deactivated')
    } catch (e: any) { flash('Failed: ' + e.message, true) }
    finally { setDeletingMatId(null) }
  }

  const handleToggleActive = async (m: Material) => {
    try {
      const token = await authToken()
      await fetch(`${API_BASE}/materials/admin/${m.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !m.isActive }),
      })
      flash(m.isActive ? 'Deactivated' : 'Activated')
      load()
    } catch { flash('Failed to update status', true) }
  }

  // CHANGED: /materials/admin/bulk
  const handleBulkUpload = async () => {
    setBulkLoading(true); setBulkResult(null)
    try {
      const token = await authToken()
      const parsed = JSON.parse(bulkText)
      const items = Array.isArray(parsed) ? parsed : parsed.materials
      const res = await fetch(`${API_BASE}/materials/admin/bulk`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ materials: items }),
      })
      const result = await res.json()
      setBulkResult(result)
      if (result.created > 0) load()
    } catch (e: any) {
      setBulkResult({ error: e.message || 'Invalid JSON or upload failed' })
    } finally { setBulkLoading(false) }
  }

  const BULK_EXAMPLE = JSON.stringify([
    { name: 'LED Bulb', category: 'Electronics', goinsPrice: 15, unit: 'piece', description: 'Small LED, any colour', icon: '💡' },
    { name: 'Cardboard Sheet', category: 'Paper', goinsPrice: 5, unit: 'sheet', icon: '📦' },
    { name: 'Copper Wire', category: 'Electronics', goinsPrice: 8, unit: 'cm', icon: '🔌' },
    { name: 'Rubber Band', category: 'Scrap', goinsPrice: 2, unit: 'piece', icon: '🔗' },
    { name: 'Popsicle Stick', category: 'Wood', goinsPrice: 3, unit: 'piece', icon: '🪵' },
  ], null, 2)

  return (
    <AdminLayout>
      <div className="space-y-6">
        {error   && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        {success && <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Project Materials</h1>
            <p className="text-sm text-gray-500 mt-1">
              Virtual planning items — children spend{' '}
              <span className="font-semibold text-amber-600">Goins</span> to pick these when planning a project.
              Real shop items are in <a href="/products" className="underline text-blue-600">Products →</a>
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button onClick={() => { setTab('bulk'); setBulkResult(null); setBulkText('') }}
              className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium">
              Bulk upload
            </button>
            <button onClick={openAddMat}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
              <Plus className="h-4 w-4" /> Add material
            </button>
          </div>
        </div>

        {/* Distinction callout */}
        <div className="flex gap-3 text-xs">
          <div className="flex-1 border border-amber-200 bg-amber-50 rounded-lg p-3">
            <div className="font-semibold text-amber-800 mb-0.5">🪙 Material (this page)</div>
            <div className="text-amber-700">Virtual. Child picks in project planner. Costs Goins (user.score). No order, no delivery.</div>
          </div>
          <div className="flex-1 border border-green-200 bg-green-50 rounded-lg p-3">
            <div className="font-semibold text-green-800 mb-0.5">₹ Product (/products page)</div>
            <div className="text-green-700">Real. Child buys in Shop. Costs ₹ (wallet.balance). Creates Order. Physical delivery.</div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-5 border-0 shadow-sm">
            <p className="text-sm text-gray-500">Total materials</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{materials.length}</p>
          </Card>
          <Card className="p-5 border-0 shadow-sm">
            <p className="text-sm text-gray-500">Active</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{materials.filter(m => m.isActive).length}</p>
          </Card>
          <Card className="p-5 border-0 shadow-sm">
            <p className="text-sm text-gray-500">Avg Goins cost</p>
            <p className="text-3xl font-bold text-amber-600 mt-1">
              {materials.length > 0 ? Math.round(materials.reduce((s, m) => s + m.goinsPrice, 0) / materials.length) : 0}
            </p>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          <button onClick={() => setTab('materials')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab==='materials' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>
            <Package className="h-4 w-4" /> Materials
          </button>
          <button onClick={() => { setTab('bulk'); setBulkResult(null) }}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab==='bulk' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>
            <Grid className="h-4 w-4" /> Bulk upload
          </button>
        </div>

        {/* ── MATERIALS TAB ── */}
        {tab === 'materials' && (
          <>
            <div className="flex gap-3 flex-wrap items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="text" placeholder="Search materials..." value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-52 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div className="flex gap-1 flex-wrap">
                {allCats.map(cat => (
                  <button key={cat} onClick={() => setCatFilter(cat)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${catFilter === cat ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                    {cat}
                  </button>
                ))}
              </div>
              <span className="text-xs text-gray-400 ml-auto">{filtered.length} items</span>
            </div>

            <Card className="border-0 shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 w-10"></th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Material</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden md:table-cell">Category</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden md:table-cell">Unit</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden md:table-cell">Image</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3">Goins</th>
                      <th className="text-center text-xs font-semibold text-gray-500 uppercase px-4 py-3">Status</th>
                      <th className="text-center text-xs font-semibold text-gray-500 uppercase px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={8} className="text-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
                      </td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-16">
                        <div className="text-5xl mb-3">📦</div>
                        <p className="text-gray-500 font-medium">No materials yet</p>
                        <div className="mt-2 text-sm">
                          <button onClick={openAddMat} className="text-indigo-600 hover:underline">Add one</button>
                          {' or '}
                          <button onClick={() => setTab('bulk')} className="text-indigo-600 hover:underline">bulk upload</button>
                        </div>
                      </td></tr>
                    ) : filtered.map(m => (
                      <tr key={m.id} className={`hover:bg-gray-50 transition-colors ${!m.isActive ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3 text-xl">{m.icon || '📦'}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 text-sm">{m.name}</p>
                          {m.description && <p className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{m.description}</p>}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-full font-medium">{m.category}</span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500">{m.unit}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {m.imageUrl
                            ? <img src={m.imageUrl} alt={m.name} className="h-10 w-10 rounded-lg object-contain border border-gray-200 bg-white" />
                            : <span className="text-xs text-gray-300">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-lg font-bold text-amber-600">{m.goinsPrice}</span>
                          <span className="text-xs text-gray-400 ml-1">G</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => handleToggleActive(m)}
                            className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                              m.isActive ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700' : 'bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700'
                            }`}>
                            {m.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => openEditMat(m)}
                              className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50">
                              <Pencil className="h-3 w-3" /> Edit
                            </button>
                            <button onClick={() => handleDeleteMat(m.id)} disabled={deletingMatId === m.id}
                              className="flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs hover:bg-red-50 disabled:opacity-40">
                              <Trash2 className="h-3 w-3" /> {deletingMatId === m.id ? '…' : 'Deactivate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {/* ── BULK UPLOAD TAB ── */}
        {tab === 'bulk' && (
          <Card className="p-6 border-0 shadow-sm">
            <h2 className="text-lg font-semibold mb-1">Bulk upload materials</h2>
            <p className="text-sm text-gray-500 mb-4">Paste a JSON array. Duplicates (same name + category) are skipped.</p>
            <button onClick={() => setBulkText(BULK_EXAMPLE)} className="text-xs text-indigo-600 hover:underline mb-3 block">
              Load example JSON
            </button>
            <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={14}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-indigo-400 resize-none"
              placeholder={'[\n  { "name": "LED Bulb", "category": "Electronics", "goinsPrice": 15, "unit": "piece", "icon": "💡" },\n  ...\n]'} />

            {bulkResult && (
              <div className={`mt-3 p-3 rounded-lg text-sm ${bulkResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}>
                {bulkResult.error ? <span>Error: {bulkResult.error}</span> : (
                  <>
                    <span className="font-semibold">{bulkResult.created} created</span>, {bulkResult.skipped} skipped.
                    {bulkResult.errors?.length > 0 && (
                      <ul className="mt-2 text-xs text-orange-700 list-disc list-inside">
                        {bulkResult.errors.map((e: any, i: number) => (
                          <li key={i}>Row {e.row} — {e.name}: {e.error}</li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            )}

            <button onClick={handleBulkUpload} disabled={bulkLoading || !bulkText.trim()}
              className="mt-4 px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {bulkLoading ? 'Uploading…' : 'Upload materials'}
            </button>
          </Card>
        )}
      </div>

      {/* ── MATERIAL MODAL ── */}
      {showMatForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6 border-0 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">{editingMat ? 'Edit material' : 'Add material'}</h2>
              <button onClick={() => setShowMatForm(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" placeholder="e.g. LED Bulb" value={matForm.name}
                  onChange={e => setMatForm(f => ({...f, name: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" placeholder="Short description for child" value={matForm.description}
                  onChange={e => setMatForm(f => ({...f, description: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Goins cost *</label>
                  <input type="number" min={1} placeholder="10" value={matForm.goinsPrice}
                    onChange={e => setMatForm(f => ({...f, goinsPrice: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select value={matForm.unit} onChange={e => setMatForm(f => ({...f, unit: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <input list="cat-opts" value={matForm.category}
                    onChange={e => setMatForm(f => ({...f, category: e.target.value}))}
                    placeholder="Electronics, Paper…"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  <datalist id="cat-opts">
                    {CATEGORY_OPTIONS.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Icon (emoji)</label>
                  <input value={matForm.icon} onChange={e => setMatForm(f => ({...f, icon: e.target.value}))}
                    placeholder="💡"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {EMOJI_OPTIONS.map(e => (
                  <button key={e} type="button" onClick={() => setMatForm(f => ({...f, icon: e}))}
                    className={`text-xl p-1.5 rounded-lg border-2 transition-all ${matForm.icon === e ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleSaveMat} disabled={savingMat}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50">
                {savingMat ? 'Saving…' : editingMat ? 'Update material' : 'Add material'}
              </button>
              <button onClick={() => setShowMatForm(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </Card>
        </div>
      )}
    </AdminLayout>
  )
}