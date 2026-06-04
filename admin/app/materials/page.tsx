'use client'

import React, { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import { Search, RefreshCw, Plus, Pencil, Trash2, X, Grid, Package, ShoppingBag } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

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
  priceEstimate: number | null
  amazonASIN: string | null
  amazonUrl: string | null
  showInShop: boolean
  showInPlanning: boolean
}

async function authToken() {
  const v = `; ${document.cookie}`
  const p = v.split('; auth_token=')
  return p.length === 2 ? p.pop()!.split(';').shift()! : ''
}

const EMPTY_MAT = {
  name: '', description: '', goinsPrice: '', unit: 'piece',
  icon: '', category: '', priceEstimate: '', amazonASIN: '', imageUrl: '',
  showInShop: true, showInPlanning: true,
}

export default function MaterialsPage() {
  const [tab, setTab]             = useState<'materials'|'amazon'|'bulk'>('materials')
  const [materials, setMaterials] = useState<Material[]>([])
  const [filtered, setFiltered]   = useState<Material[]>([])
  const [catFilter, setCatFilter] = useState('All')
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')

  // Edit modal
  const [showForm, setShowForm]   = useState(false)
  const [editingMat, setEditingMat] = useState<Material | null>(null)
  const [form, setForm]           = useState(EMPTY_MAT)
  const [saving, setSaving]       = useState(false)

  // Inline ASIN editing
  const [editingAsin, setEditingAsin]   = useState<string | null>(null)
  const [asinValue, setAsinValue]       = useState('')
  const [priceValue, setPriceValue]     = useState('')
  const [savingAsin, setSavingAsin]     = useState(false)
  const [onlyUnlinked, setOnlyUnlinked] = useState(false)

  const flash = (msg: string, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(''), 6000) }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  }

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
      const matchSearch = m.name.toLowerCase().includes(q)
      const matchCat    = catFilter === 'All' || m.category === catFilter
      return matchSearch && matchCat
    }))
  }, [search, materials, catFilter])

  const allCats = ['All', ...Array.from(new Set(materials.map(m => m.category))).filter(Boolean).sort()]
  const asinCount = materials.filter(m => m.amazonASIN).length

  // ── Save full edit ──────────────────────────────────────────────────────
  const openEdit = (m: Material) => {
    setEditingMat(m)
    setForm({
      name: m.name,
      description: m.description || '',
      goinsPrice: String(m.goinsPrice),
      unit: m.unit || 'piece',
      icon: m.icon || '',
      category: m.category || '',
      priceEstimate: m.priceEstimate != null ? String(m.priceEstimate) : '',
      amazonASIN: m.amazonASIN || '',
      imageUrl: m.imageUrl || '',
      showInShop: m.showInShop ?? true,
      showInPlanning: m.showInPlanning ?? true,
    })
    setShowForm(true)
  }

  const openAdd = () => {
    setEditingMat(null)
    setForm(EMPTY_MAT)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.goinsPrice || !form.category) {
      flash('Name, Goins cost, and category are required', true); return
    }
    setSaving(true)
    try {
      const token  = await authToken()
      const asin   = form.amazonASIN.trim()
      const body: any = {
        name:           form.name.trim(),
        description:    form.description || null,
        goinsPrice:     Number(form.goinsPrice),
        unit:           form.unit,
        icon:           form.icon || null,
        category:       form.category.trim(),
        imageUrl:       form.imageUrl || null,
        priceEstimate:  form.priceEstimate ? Number(form.priceEstimate) : null,
        amazonASIN:     asin || null,
        amazonUrl:      asin ? `https://www.amazon.in/dp/${asin}?tag=miniguru08-21` : null,
        showInShop:     form.showInShop,
        showInPlanning: form.showInPlanning,
      }

      const url    = editingMat
        ? `${API_BASE}/materials/admin/${editingMat.id}`
        : `${API_BASE}/materials/admin/create`
      const method = editingMat ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await res.text())
      flash(editingMat ? 'Material updated!' : 'Material added!')
      setShowForm(false)
      await load()
    } catch (e: any) { flash('Save failed: ' + e.message, true) }
    finally { setSaving(false) }
  }

  // ── Inline ASIN save ────────────────────────────────────────────────────
  const startAsinEdit = (m: Material) => {
    setEditingAsin(m.id)
    setAsinValue(m.amazonASIN || '')
    setPriceValue(m.priceEstimate != null ? String(m.priceEstimate) : '')
  }

  const saveAsin = async (id: string) => {
    setSavingAsin(true)
    try {
      const token = await authToken()
      const asin  = asinValue.trim()
      await fetch(`${API_BASE}/materials/admin/${id}`, {
        method:  'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amazonASIN:    asin || null,
          amazonUrl:     asin ? `https://www.amazon.in/dp/${asin}?tag=miniguru08-21` : null,
          priceEstimate: priceValue ? Number(priceValue) : null,
        }),
      })
      flash('ASIN saved!')
      setEditingAsin(null)
      await load()
    } catch (e: any) { flash('Save failed: ' + e.message, true) }
    finally { setSavingAsin(false) }
  }

  const handleToggle = async (m: Material, field: 'isActive'|'showInShop'|'showInPlanning') => {
    try {
      const token = await authToken()
      await fetch(`${API_BASE}/materials/admin/${m.id}`, {
        method:  'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: !m[field] }),
      })
      load()
    } catch { flash('Failed to update', true) }
  }

  // Amazon tab list
  const amazonList = materials.filter(m =>
    (!onlyUnlinked || !m.amazonASIN) && m.isActive
  )

  // Bulk upload
  const [bulkText, setBulkText]     = useState('')
  const [bulkResult, setBulkResult] = useState<any>(null)
  const [bulkLoading, setBulkLoading] = useState(false)

  const handleBulk = async () => {
    setBulkLoading(true); setBulkResult(null)
    try {
      const token  = await authToken()
      const parsed = JSON.parse(bulkText)
      const items  = Array.isArray(parsed) ? parsed : parsed.materials
      const res    = await fetch(`${API_BASE}/materials/admin/bulk`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ materials: items }),
      })
      const result = await res.json()
      setBulkResult(result)
      if (result.created > 0) load()
    } catch (e: any) { setBulkResult({ error: e.message }) }
    finally { setBulkLoading(false) }
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        {error   && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        {success && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Materials</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {materials.length} total · {asinCount} linked to Amazon ·{' '}
              <span className="text-orange-600 font-medium">{materials.length - asinCount} need ASINs</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
              <Plus className="h-4 w-4" /> Add material
            </button>
          </div>
        </div>

        {/* Amazon progress bar */}
        <Card className="p-4 border-0 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Amazon ASIN setup progress</p>
            <button onClick={() => setTab('amazon')} className="text-xs text-orange-600 hover:underline">
              Add ASINs →
            </button>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div className="bg-gradient-to-r from-orange-400 to-amber-500 h-2.5 rounded-full"
              style={{ width: materials.length > 0 ? `${Math.round((asinCount/materials.length)*100)}%` : '0%' }} />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {materials.length > 0 ? Math.round((asinCount/materials.length)*100) : 0}% complete
            {asinCount === 0 && ' — "Buy on Amazon" button won\'t appear in shop until ASINs are added'}
          </p>
        </Card>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {[
            { key: 'materials', label: '📦 All Materials' },
            { key: 'amazon',   label: '🟠 Amazon Setup' },
            { key: 'bulk',     label: '📋 Bulk Upload' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.key ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── ALL MATERIALS TAB ── */}
        {tab === 'materials' && (
          <>
            <div className="flex gap-3 flex-wrap items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="text" placeholder="Search..." value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-48 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div className="flex gap-1 flex-wrap">
                {allCats.map(cat => (
                  <button key={cat} onClick={() => setCatFilter(cat)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      catFilter === cat ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                    }`}>
                    {cat}
                  </button>
                ))}
              </div>
              <span className="text-xs text-gray-400 ml-auto">{filtered.length} items</span>
            </div>

            <Card className="border-0 shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 w-8"></th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Name</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden md:table-cell">Category</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden md:table-cell">Image</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3">Goins</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden md:table-cell">₹ Est.</th>
                      <th className="text-center text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden md:table-cell">ASIN</th>
                      <th className="text-center text-xs font-semibold text-gray-500 uppercase px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={8} className="text-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
                      </td></tr>
                    ) : filtered.map(m => (
                      <tr key={m.id} className={`hover:bg-gray-50 ${!m.isActive ? 'opacity-40' : ''}`}>
                        <td className="px-4 py-3 text-lg">{m.icon || '📦'}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 text-sm">{m.name}</p>
                          <p className="text-xs text-gray-400">{m.unit}</p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full">{m.category}</span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {m.imageUrl
                            ? <img src={m.imageUrl} alt={m.name} className="h-9 w-9 object-contain rounded border bg-white" />
                            : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-amber-600">{m.goinsPrice}G</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600 hidden md:table-cell">
                          {m.priceEstimate ? `₹${m.priceEstimate}` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          {m.amazonASIN
                            ? <span className="px-2 py-0.5 bg-orange-50 text-orange-700 text-xs rounded font-mono">{m.amazonASIN}</span>
                            : <span className="text-xs text-gray-300">not set</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openEdit(m)}
                              className="px-2 py-1 border border-gray-200 text-gray-600 rounded text-xs hover:bg-gray-50">
                              Edit
                            </button>
                            <button onClick={() => handleToggle(m, 'isActive')}
                              className={`px-2 py-1 rounded text-xs ${m.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {m.isActive ? 'On' : 'Off'}
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

        {/* ── AMAZON SETUP TAB ── */}
        {tab === 'amazon' && (
          <>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={onlyUnlinked}
                  onChange={e => setOnlyUnlinked(e.target.checked)}
                  className="rounded" />
                Show only materials without ASIN ({materials.filter(m => !m.amazonASIN && m.isActive).length} remaining)
              </label>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <strong>How to find an ASIN:</strong> Search the item on amazon.in → open the product page → copy the code from the URL: amazon.in/dp/<strong>B0XXXXXXXX</strong> — that is the ASIN.
              The affiliate tag <code>miniguru08-21</code> is added automatically.
            </div>

            <Card className="border-0 shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 w-8"></th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Material</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Amazon ASIN</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">₹ Price estimate</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Link</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {amazonList.map(m => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-lg">{m.icon || '📦'}</td>
                        <td className="px-4 py-2">
                          <p className="text-sm font-medium text-gray-900">{m.name}</p>
                          <p className="text-xs text-gray-400">{m.category}</p>
                        </td>
                        <td className="px-4 py-2">
                          {editingAsin === m.id ? (
                            <input
                              type="text"
                              value={asinValue}
                              onChange={e => setAsinValue(e.target.value)}
                              placeholder="B0XXXXXXXXX"
                              className="w-36 px-2 py-1 border border-indigo-400 rounded text-sm font-mono focus:outline-none"
                              autoFocus
                            />
                          ) : (
                            <span className={`text-sm font-mono ${m.amazonASIN ? 'text-orange-700' : 'text-gray-300'}`}>
                              {m.amazonASIN || 'not set'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {editingAsin === m.id ? (
                            <input
                              type="number"
                              value={priceValue}
                              onChange={e => setPriceValue(e.target.value)}
                              placeholder="₹ estimate"
                              className="w-24 px-2 py-1 border border-indigo-400 rounded text-sm focus:outline-none"
                            />
                          ) : (
                            <span className="text-sm text-gray-600">
                              {m.priceEstimate ? `₹${m.priceEstimate}` : <span className="text-gray-300">—</span>}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {m.amazonUrl ? (
                            <a href={m.amazonUrl} target="_blank" rel="noopener"
                              className="text-xs text-orange-600 hover:underline">View ↗</a>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2">
                          {editingAsin === m.id ? (
                            <div className="flex gap-2">
                              <button onClick={() => saveAsin(m.id)} disabled={savingAsin}
                                className="px-3 py-1 bg-orange-500 text-white rounded text-xs font-medium hover:bg-orange-600 disabled:opacity-50">
                                {savingAsin ? '…' : 'Save'}
                              </button>
                              <button onClick={() => setEditingAsin(null)}
                                className="px-3 py-1 border border-gray-200 rounded text-xs text-gray-500 hover:bg-gray-50">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => startAsinEdit(m)}
                              className="px-3 py-1 border border-orange-200 text-orange-600 rounded text-xs hover:bg-orange-50">
                              {m.amazonASIN ? 'Edit' : '+ Add ASIN'}
                            </button>
                          )}
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
            <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={12}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-indigo-400 resize-none"
              placeholder={'[\n  { "name": "LED", "category": "Electronics", "goinsPrice": 15, "unit": "piece", "icon": "💡" },\n  ...\n]'} />
            {bulkResult && (
              <div className={`mt-3 p-3 rounded-lg text-sm ${bulkResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}>
                {bulkResult.error ? `Error: ${bulkResult.error}` : `${bulkResult.created} created, ${bulkResult.skipped} skipped.`}
              </div>
            )}
            <button onClick={handleBulk} disabled={bulkLoading || !bulkText.trim()}
              className="mt-4 px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {bulkLoading ? 'Uploading…' : 'Upload'}
            </button>
          </Card>
        )}
      </div>

      {/* ── EDIT / ADD MODAL ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg p-6 border-0 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">{editingMat ? 'Edit material' : 'Add material'}</h2>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>

              {/* Category + Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <input type="text" value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}
                    placeholder="Electronics, Paper, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select value={form.unit} onChange={e => setForm(f => ({...f, unit: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none">
                    {['piece','gram','ml','cm','sheet','meter','pair','roll'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {/* Goins + Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Goins cost *</label>
                  <input type="number" min={1} value={form.goinsPrice} onChange={e => setForm(f => ({...f, goinsPrice: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">₹ Price estimate</label>
                  <input type="number" min={0} value={form.priceEstimate} onChange={e => setForm(f => ({...f, priceEstimate: e.target.value}))}
                    placeholder="shown in shop"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
              </div>

              {/* Amazon ASIN */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amazon ASIN
                  <span className="ml-1 text-xs text-gray-400 font-normal">
                    — from amazon.in/dp/<strong>B0XXXXXXXXX</strong>
                  </span>
                </label>
                <input type="text" value={form.amazonASIN} onChange={e => setForm(f => ({...f, amazonASIN: e.target.value}))}
                  placeholder="B0XXXXXXXXX"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400" />
                {form.amazonASIN && (
                  <p className="text-xs text-orange-600 mt-1">
                    → amazon.in/dp/{form.amazonASIN}?tag=miniguru08-21
                  </p>
                )}
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                <input type="text" value={form.imageUrl} onChange={e => setForm(f => ({...f, imageUrl: e.target.value}))}
                  placeholder="Firebase Storage URL"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                {form.imageUrl && (
                  <img src={form.imageUrl} alt="preview" className="mt-2 h-14 w-14 object-contain rounded border bg-white" />
                )}
              </div>

              {/* Icon + Description */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Emoji icon</label>
                  <input type="text" value={form.icon} onChange={e => setForm(f => ({...f, icon: e.target.value}))}
                    placeholder="💡"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input type="text" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none" />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={form.showInShop}
                    onChange={e => setForm(f => ({...f, showInShop: e.target.checked}))} className="rounded" />
                  Show in Shop
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={form.showInPlanning}
                    onChange={e => setForm(f => ({...f, showInPlanning: e.target.checked}))} className="rounded" />
                  Show in Planning
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Saving…' : (editingMat ? 'Save changes' : 'Add material')}
              </button>
              <button onClick={() => setShowForm(false)}
                className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </Card>
        </div>
      )}
    </AdminLayout>
  )
}