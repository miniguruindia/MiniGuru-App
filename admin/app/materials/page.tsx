'use client'

import React, { useEffect, useState, useRef } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import { Search, RefreshCw, Plus, Pencil, Trash2, X, Grid, Package, ExternalLink } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''
const AMAZON_TAG = 'miniguru08-21'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Material {
  id: string
  seqId: number | null
  name: string
  description: string | null
  goinsPrice: number
  unit: string
  icon: string | null
  category: string
  imageUrl: string | null
  isActive: boolean
  // ── Amazon / shop fields (May 2026 schema) ──
  priceEstimate: number | null
  amazonASIN: string | null
  amazonUrl: string | null
  showInShop: boolean
  showInPlanning: boolean
}

interface ExcelRow {
  name: string; description: string; category: string
  unit: string; goinsPrice: number; icon: string; imageUrl: string
}

type InlineField = 'goinsPrice' | 'amazonASIN' | 'priceEstimate'

interface InlineEdit {
  id: string
  field: InlineField
  value: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function authToken(): Promise<string> {
  const v = `; ${document.cookie}`
  const p = v.split('; auth_token=')
  return p.length === 2 ? p.pop()!.split(';').shift()! : ''
}

function buildAmazonUrl(asin: string | null | undefined): string | null {
  return asin ? `https://www.amazon.in/dp/${asin.trim()}?tag=${AMAZON_TAG}` : null
}

// ─── Constants ────────────────────────────────────────────────────────────────
const EMPTY_MAT = {
  name: '', description: '', goinsPrice: '', unit: 'piece',
  icon: '', category: '', priceEstimate: '', amazonASIN: '',
  showInShop: true, showInPlanning: true,
}
const CATEGORY_OPTIONS = [
  'Paper & Cardboard', 'Adhesives & Tapes', 'Tools', 'Craft Materials',
  'Electronics', 'Science', 'Structural', 'Art & Decoration', 'Advanced Kits',
  'Electronics', 'Paper', 'Scrap', 'Wood', 'Fabric', 'Plastic', 'Metal', 'Other',
]
const UNIT_OPTIONS = ['piece', 'gram', 'ml', 'cm', 'sheet', 'meter', 'pair']
const EMOJI_OPTIONS = ['📦','🔌','⚙️','🔧','🧲','🪛','🔩','🧪','🎨','✂️','📐','📏','🔋','💡','🪚','🧵','🪡','🎭','🌿','♻️']

// ─── Inline editable cell ─────────────────────────────────────────────────────
function InlineCell({
  materialId, field, displayValue, placeholder, inputType = 'text', prefix, suffix,
  inlineEdit, onStart, onSave, onCancel, onChange,
  className = '',
}: {
  materialId: string
  field: InlineField
  displayValue: string
  placeholder?: string
  inputType?: string
  prefix?: string
  suffix?: string
  inlineEdit: InlineEdit | null
  onStart: () => void
  onSave: () => void
  onCancel: () => void
  onChange: (v: string) => void
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isEditing = inlineEdit?.id === materialId && inlineEdit?.field === field

  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        {prefix && <span className="text-xs text-gray-400">{prefix}</span>}
        <input
          ref={inputRef}
          type={inputType}
          value={inlineEdit!.value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
          onBlur={onSave}
          className={`border border-indigo-400 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 ${className}`}
          placeholder={placeholder}
        />
        {suffix && <span className="text-xs text-gray-400">{suffix}</span>}
      </div>
    )
  }

  return (
    <button
      onClick={onStart}
      title="Click to edit"
      className={`text-left hover:bg-indigo-50 hover:text-indigo-700 rounded px-1 py-0.5 transition-colors group ${className}`}
    >
      {prefix && <span className="text-gray-400 text-xs">{prefix}</span>}
      <span className={displayValue ? '' : 'text-gray-300 italic text-xs'}>
        {displayValue || placeholder || '—'}
      </span>
      {suffix && <span className="text-gray-400 text-xs ml-0.5">{suffix}</span>}
      <span className="opacity-0 group-hover:opacity-100 ml-1 text-[10px] text-indigo-400">✎</span>
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MaterialsPage() {
  const [tab, setTab]                     = useState<'materials'|'amazon'|'bulk'|'excel'>('materials')
  const [materials, setMaterials]         = useState<Material[]>([])
  const [filtered, setFiltered]           = useState<Material[]>([])
  const [catFilter, setCatFilter]         = useState('All')
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [error, setError]                 = useState('')
  const [success, setSuccess]             = useState('')

  // ── Edit modal ──────────────────────────────────────────────────────────────
  const [showMatForm, setShowMatForm]     = useState(false)
  const [editingMat, setEditingMat]       = useState<Material | null>(null)
  const [matForm, setMatForm]             = useState({ ...EMPTY_MAT })
  const [savingMat, setSavingMat]         = useState(false)
  const [deletingMatId, setDeletingMatId] = useState<string|null>(null)

  // ── Inline editing ──────────────────────────────────────────────────────────
  const [inlineEdit, setInlineEdit]       = useState<InlineEdit | null>(null)
  const [savingInline, setSavingInline]   = useState(false)

  // ── Bulk upload ─────────────────────────────────────────────────────────────
  const [bulkText, setBulkText]           = useState('')
  const [bulkResult, setBulkResult]       = useState<any>(null)
  const [bulkLoading, setBulkLoading]     = useState(false)

  // ── Excel paste ─────────────────────────────────────────────────────────────
  const [excelText, setExcelText]         = useState('')
  const [excelRows, setExcelRows]         = useState<ExcelRow[]>([])
  const [defaultGoins, setDefaultGoins]   = useState(10)
  const [defaultCat, setDefaultCat]       = useState('Other')
  const [excelLoading, setExcelLoading]   = useState(false)
  const [excelResult, setExcelResult]     = useState<any>(null)

  // ── Flash messages ──────────────────────────────────────────────────────────
  const flash = (msg: string, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(''), 6000) }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  }

  // ── Load materials ──────────────────────────────────────────────────────────
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
      const matchSearch = m.name.toLowerCase().includes(q) ||
        (m.description || '').toLowerCase().includes(q) ||
        (m.amazonASIN || '').toLowerCase().includes(q)
      const matchCat = catFilter === 'All' || m.category === catFilter
      return matchSearch && matchCat
    }))
  }, [search, materials, catFilter])

  const allCats = ['All', ...Array.from(new Set([
    ...CATEGORY_OPTIONS,
    ...materials.map(m => m.category),
  ])).filter(Boolean).sort()]

  // ── Open modal ──────────────────────────────────────────────────────────────
  const openAddMat = () => {
    setEditingMat(null)
    setMatForm({ ...EMPTY_MAT })
    setShowMatForm(true)
  }
  const openEditMat = (m: Material) => {
    setEditingMat(m)
    setMatForm({
      name: m.name,
      description: m.description || '',
      goinsPrice: String(m.goinsPrice),
      unit: m.unit || 'piece',
      icon: m.icon || '',
      category: m.category || '',
      priceEstimate: m.priceEstimate != null ? String(m.priceEstimate) : '',
      amazonASIN: m.amazonASIN || '',
      showInShop: m.showInShop,
      showInPlanning: m.showInPlanning,
    })
    setShowMatForm(true)
  }

  // ── Save modal ──────────────────────────────────────────────────────────────
  const handleSaveMat = async () => {
    if (!matForm.name || !matForm.goinsPrice || !matForm.category) {
      flash('Name, Goins cost, and category are required', true); return
    }
    setSavingMat(true)
    try {
      const token = await authToken()
      const asin = matForm.amazonASIN.trim() || null
      const body = JSON.stringify({
        name: matForm.name,
        description: matForm.description || null,
        goinsPrice: Number(matForm.goinsPrice),
        unit: matForm.unit,
        icon: matForm.icon || null,
        category: matForm.category,
        priceEstimate: matForm.priceEstimate ? Number(matForm.priceEstimate) : null,
        amazonASIN: asin,
        amazonUrl: buildAmazonUrl(asin),
        showInShop: matForm.showInShop,
        showInPlanning: matForm.showInPlanning,
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

  // ── Toggle active ────────────────────────────────────────────────────────────
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

  // ── Toggle showInShop / showInPlanning ──────────────────────────────────────
  const handleToggleField = async (m: Material, field: 'showInShop' | 'showInPlanning') => {
    try {
      const token = await authToken()
      await fetch(`${API_BASE}/materials/admin/${m.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: !m[field] }),
      })
      setMaterials(prev => prev.map(x => x.id === m.id ? { ...x, [field]: !m[field] } : x))
    } catch { flash('Failed to update', true) }
  }

  // ── Deactivate ──────────────────────────────────────────────────────────────
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

  // ── Inline edit helpers ──────────────────────────────────────────────────────
  const startInline = (m: Material, field: InlineField) => {
    setInlineEdit({
      id: m.id,
      field,
      value: field === 'goinsPrice' ? String(m.goinsPrice)
           : field === 'amazonASIN' ? (m.amazonASIN || '')
           : field === 'priceEstimate' ? (m.priceEstimate != null ? String(m.priceEstimate) : '')
           : '',
    })
  }

  const saveInline = async () => {
    if (!inlineEdit || savingInline) return
    setSavingInline(true)
    try {
      const token = await authToken()
      const body: any = {}
      if (inlineEdit.field === 'goinsPrice') {
        const v = Number(inlineEdit.value)
        if (!v || v < 1) { setInlineEdit(null); return }
        body.goinsPrice = v
      } else if (inlineEdit.field === 'amazonASIN') {
        const asin = inlineEdit.value.trim() || null
        body.amazonASIN = asin
        body.amazonUrl = buildAmazonUrl(asin)
      } else if (inlineEdit.field === 'priceEstimate') {
        body.priceEstimate = inlineEdit.value ? Number(inlineEdit.value) : null
      }
      const res = await fetch(`${API_BASE}/materials/admin/${inlineEdit.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await res.text())
      // Optimistic update — no full reload needed
      setMaterials(prev => prev.map(m => {
        if (m.id !== inlineEdit.id) return m
        const updated = { ...m, ...body }
        return updated
      }))
      setInlineEdit(null)
    } catch (e: any) {
      flash('Save failed: ' + e.message, true)
      setInlineEdit(null)
    } finally { setSavingInline(false) }
  }

  // ── Bulk upload ──────────────────────────────────────────────────────────────
  const BULK_EXAMPLE = JSON.stringify([
    { name: 'LED Bulb', category: 'Electronics', goinsPrice: 15, unit: 'piece', description: 'Small LED, any colour', icon: '💡', amazonASIN: 'B08XYZ123', priceEstimate: 15 },
    { name: 'Cardboard Sheet', category: 'Paper & Cardboard', goinsPrice: 5, unit: 'sheet', icon: '📦' },
  ], null, 2)

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

  // ── Excel parse ──────────────────────────────────────────────────────────────
  const parseExcel = () => {
    const lines = excelText.trim().split('\n').filter(l => l.trim())
    const rows: ExcelRow[] = []
    for (const line of lines) {
      const cols = line.split('\t').map(c => c.trim())
      const firstIsNum = /^\d+$/.test(cols[0])
      const isHeader = ['s.no','item name','name','description'].includes((cols[0]||'').toLowerCase())
      if (isHeader) continue
      let name = '', desc = '', unit = 'piece', imageUrl = ''
      if (firstIsNum) {
        name     = cols[1] || ''
        desc     = [cols[2], cols[3]].filter(Boolean).join(' | ')
        unit     = cols[5] || 'piece'
        imageUrl = cols[11] || ''
      } else {
        name     = cols[0] || ''
        desc     = [cols[1], cols[2]].filter(Boolean).join(' | ')
        unit     = cols[4] || 'piece'
        imageUrl = cols[10] || ''
      }
      if (!name) continue
      rows.push({ name, description: desc, category: defaultCat, unit, goinsPrice: defaultGoins, icon: '📦', imageUrl })
    }
    setExcelRows(rows)
  }

  const updateRow = (i: number, field: keyof ExcelRow, value: any) =>
    setExcelRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))

  const submitExcel = async () => {
    setExcelLoading(true); setExcelResult(null)
    try {
      const token = await authToken()
      const res = await fetch(`${API_BASE}/materials/admin/bulk`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ materials: excelRows.map(r => ({ ...r, goinsPrice: Number(r.goinsPrice) })) }),
      })
      const result = await res.json()
      setExcelResult(result)
      if (result.created > 0) { load(); setExcelRows([]); setExcelText('') }
    } catch (e: any) { setExcelResult({ error: e.message }) }
    finally { setExcelLoading(false) }
  }

  // ── Derived stats ────────────────────────────────────────────────────────────
  const withAsin    = materials.filter(m => m.amazonASIN).length
  const withoutAsin = materials.filter(m => m.isActive && !m.amazonASIN).length

  // ── Render ────────────────────────────────────────────────────────────────────
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
              <span className="font-semibold text-amber-600">Goins</span> to pick these.
              Real shop products are in <a href="/products" className="underline text-blue-600">Products →</a>
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
              <RefreshCw className="h-4 w-4" /> Refresh
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
          <div className="flex-1 border border-orange-200 bg-orange-50 rounded-lg p-3">
            <div className="font-semibold text-orange-800 mb-0.5">🛒 Amazon Affiliate</div>
            <div className="text-orange-700">Same materials list, different view. Set ASIN → auto-builds buy link. Tag: <code className="text-xs">{AMAZON_TAG}</code></div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-5 border-0 shadow-sm">
            <p className="text-sm text-gray-500">Total materials</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{materials.length}</p>
          </Card>
          <Card className="p-5 border-0 shadow-sm">
            <p className="text-sm text-gray-500">Active</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{materials.filter(m => m.isActive).length}</p>
          </Card>
          <Card className="p-5 border-0 shadow-sm">
            <p className="text-sm text-gray-500">Amazon linked</p>
            <p className="text-3xl font-bold text-orange-500 mt-1">{withAsin}
              <span className="text-sm text-gray-400 font-normal ml-1">/ {materials.length}</span>
            </p>
          </Card>
          <Card className="p-5 border-0 shadow-sm">
            <p className="text-sm text-gray-500">Avg Goins</p>
            <p className="text-3xl font-bold text-amber-600 mt-1">
              {materials.length > 0 ? Math.round(materials.reduce((s, m) => s + m.goinsPrice, 0) / materials.length) : 0}
            </p>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
          {[
            { key: 'materials', label: '📦 Materials', icon: null },
            { key: 'amazon',    label: '🛒 Amazon Setup', icon: null },
            { key: 'bulk',      label: '⬆️ Bulk JSON',   icon: null },
            { key: 'excel',     label: '📋 Paste Excel', icon: null },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.key ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════════
            TAB: MATERIALS  (full table with inline editing)
        ════════════════════════════════════════════════════════════════ */}
        {tab === 'materials' && (
          <>
            <div className="flex gap-3 flex-wrap items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="text" placeholder="Search name, ASIN…" value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-52 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
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

            <p className="text-xs text-gray-400 -mt-2">
              💡 Click any <span className="text-amber-600 font-medium">Goins</span>, <span className="text-orange-500 font-medium">ASIN</span>, or <span className="text-green-600 font-medium">₹est</span> value to edit it inline — no modal needed.
            </p>

            <Card className="border-0 shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-3 py-3 w-8">  </th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-3 py-3">Material</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-3 py-3 hidden md:table-cell">Category</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-3 py-3 hidden lg:table-cell">Img</th>
                      <th className="text-center text-xs font-semibold text-amber-600 uppercase px-3 py-3">Goins</th>
                      <th className="text-center text-xs font-semibold text-green-600 uppercase px-3 py-3 hidden xl:table-cell">₹ Est</th>
                      <th className="text-center text-xs font-semibold text-orange-500 uppercase px-3 py-3">Amazon ASIN</th>
                      <th className="text-center text-xs font-semibold text-gray-500 uppercase px-3 py-3 hidden lg:table-cell">Visibility</th>
                      <th className="text-center text-xs font-semibold text-gray-500 uppercase px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={9} className="text-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
                      </td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-16">
                        <div className="text-5xl mb-3">📦</div>
                        <p className="text-gray-500 font-medium">No materials yet</p>
                      </td></tr>
                    ) : filtered.map(m => (
                      <tr key={m.id} className={`hover:bg-gray-50 transition-colors ${!m.isActive ? 'opacity-40' : ''}`}>
                        <td className="px-3 py-2 text-lg">{m.icon || '📦'}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-gray-900 text-sm">{m.name}</p>
                          {m.description && <p className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{m.description}</p>}
                        </td>
                        <td className="px-3 py-2 hidden md:table-cell">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full">{m.category}</span>
                        </td>
                        <td className="px-3 py-2 hidden lg:table-cell">
                          {m.imageUrl
                            ? <img src={m.imageUrl} alt={m.name} className="h-9 w-9 rounded object-contain border border-gray-100 bg-white" />
                            : <span className="text-xs text-gray-300">—</span>}
                        </td>

                        {/* ── Inline: Goins ── */}
                        <td className="px-3 py-2 text-center">
                          <InlineCell
                            materialId={m.id} field="goinsPrice"
                            displayValue={String(m.goinsPrice)}
                            suffix="G" inputType="number" placeholder="Goins"
                            inlineEdit={inlineEdit}
                            onStart={() => startInline(m, 'goinsPrice')}
                            onSave={saveInline}
                            onCancel={() => setInlineEdit(null)}
                            onChange={v => setInlineEdit(prev => prev ? {...prev, value: v} : null)}
                            className="w-16 text-center font-bold text-amber-600"
                          />
                        </td>

                        {/* ── Inline: ₹ estimate ── */}
                        <td className="px-3 py-2 text-center hidden xl:table-cell">
                          <InlineCell
                            materialId={m.id} field="priceEstimate"
                            displayValue={m.priceEstimate != null ? `₹${m.priceEstimate}` : ''}
                            prefix="₹" inputType="number" placeholder="add ₹"
                            inlineEdit={inlineEdit}
                            onStart={() => startInline(m, 'priceEstimate')}
                            onSave={saveInline}
                            onCancel={() => setInlineEdit(null)}
                            onChange={v => setInlineEdit(prev => prev ? {...prev, value: v} : null)}
                            className="w-16 text-center text-green-700"
                          />
                        </td>

                        {/* ── Inline: ASIN ── */}
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <InlineCell
                              materialId={m.id} field="amazonASIN"
                              displayValue={m.amazonASIN || ''}
                              placeholder="add ASIN"
                              inlineEdit={inlineEdit}
                              onStart={() => startInline(m, 'amazonASIN')}
                              onSave={saveInline}
                              onCancel={() => setInlineEdit(null)}
                              onChange={v => setInlineEdit(prev => prev ? {...prev, value: v} : null)}
                              className="w-28 text-center font-mono text-xs text-orange-600"
                            />
                            {m.amazonUrl && (
                              <a href={m.amazonUrl} target="_blank" rel="noopener noreferrer"
                                title="Open on Amazon" className="text-gray-300 hover:text-orange-500 transition-colors">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </td>

                        {/* ── Visibility toggles ── */}
                        <td className="px-3 py-2 hidden lg:table-cell">
                          <div className="flex flex-col gap-0.5 items-center">
                            <button
                              onClick={() => handleToggleField(m, 'showInShop')}
                              title="Toggle Show in Shop"
                              className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                                m.showInShop ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-400'
                              }`}>
                              🛒 {m.showInShop ? 'In shop' : 'Hidden'}
                            </button>
                            <button
                              onClick={() => handleToggleField(m, 'showInPlanning')}
                              title="Toggle Show in Planning"
                              className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                                m.showInPlanning ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'
                              }`}>
                              📋 {m.showInPlanning ? 'Planning' : 'Hidden'}
                            </button>
                          </div>
                        </td>

                        {/* ── Actions ── */}
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => handleToggleActive(m)}
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                m.isActive ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700' : 'bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700'
                              }`}>
                              {m.isActive ? '✓' : '✗'}
                            </button>
                            <button onClick={() => openEditMat(m)}
                              className="p-1.5 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50">
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button onClick={() => handleDeleteMat(m.id)} disabled={deletingMatId === m.id}
                              className="p-1.5 border border-red-200 text-red-400 rounded-lg hover:bg-red-50 disabled:opacity-40">
                              <Trash2 className="h-3 w-3" />
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

        {/* ════════════════════════════════════════════════════════════════
            TAB: AMAZON SETUP  (dense table — optimised for setting 201 ASINs fast)
        ════════════════════════════════════════════════════════════════ */}
        {tab === 'amazon' && (
          <>
            <div className="flex items-center gap-3">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex-1 text-sm">
                <p className="font-semibold text-orange-800 mb-1">🎯 How to use this tab</p>
                <ol className="text-orange-700 space-y-0.5 list-decimal list-inside text-xs">
                  <li>Open <a href="https://www.amazon.in" target="_blank" rel="noopener noreferrer" className="underline">Amazon.in</a> in another tab with the SiteStripe bar active (must be logged into Associates)</li>
                  <li>Search for the material → open the product page</li>
                  <li>The ASIN is in the URL: amazon.in/dp/<strong>B08XYZ123</strong>/... — copy just that part</li>
                  <li>Click the ASIN cell here → paste → Enter. URL is auto-built with tag <code>{AMAZON_TAG}</code></li>
                  <li>Also set the ₹ estimate — children see this as the approximate real-world cost</li>
                </ol>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-orange-500">{withAsin}</div>
                <div className="text-xs text-gray-500">linked</div>
                <div className="text-2xl font-bold text-gray-300 mt-1">{withoutAsin}</div>
                <div className="text-xs text-gray-400">remaining</div>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Search materials…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              <label className="ml-3 text-xs text-gray-500">
                <input type="checkbox" className="mr-1"
                  onChange={e => {
                    if (e.target.checked) setFiltered(materials.filter(m => m.isActive && !m.amazonASIN))
                    else setFiltered(materials.filter(m => {
                      const q = search.toLowerCase()
                      return m.name.toLowerCase().includes(q) || (m.amazonASIN||'').toLowerCase().includes(q)
                    }))
                  }} />
                Show only unlinked
              </label>
            </div>

            <Card className="border-0 shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-orange-50 border-b border-orange-100">
                    <tr>
                      <th className="text-left text-xs font-semibold text-gray-500 px-3 py-2.5 w-8">#</th>
                      <th className="text-left text-xs font-semibold text-gray-500 px-3 py-2.5 w-10"></th>
                      <th className="text-left text-xs font-semibold text-gray-500 px-3 py-2.5">Name</th>
                      <th className="text-left text-xs font-semibold text-gray-500 px-3 py-2.5 hidden md:table-cell">Category</th>
                      <th className="text-center text-xs font-semibold text-amber-600 px-3 py-2.5">Goins</th>
                      <th className="text-center text-xs font-semibold text-green-600 px-3 py-2.5">₹ Est</th>
                      <th className="text-center text-xs font-semibold text-orange-500 px-3 py-2.5">Amazon ASIN</th>
                      <th className="text-center text-xs font-semibold text-gray-400 px-3 py-2.5">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.filter(m => m.isActive).map((m, i) => (
                      <tr key={m.id} className={`hover:bg-orange-50/40 transition-colors ${m.amazonASIN ? '' : 'bg-yellow-50/30'}`}>
                        <td className="px-3 py-2 text-xs text-gray-400">{m.seqId ?? i + 1}</td>
                        <td className="px-3 py-2 text-base">{m.icon || '📦'}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">{m.name}</td>
                        <td className="px-3 py-2 hidden md:table-cell text-xs text-gray-500">{m.category}</td>

                        {/* Inline: Goins */}
                        <td className="px-3 py-2 text-center">
                          <InlineCell
                            materialId={m.id} field="goinsPrice"
                            displayValue={String(m.goinsPrice)} suffix="G"
                            inputType="number"
                            inlineEdit={inlineEdit}
                            onStart={() => startInline(m, 'goinsPrice')}
                            onSave={saveInline}
                            onCancel={() => setInlineEdit(null)}
                            onChange={v => setInlineEdit(prev => prev ? {...prev, value: v} : null)}
                            className="w-14 text-center font-bold text-amber-600"
                          />
                        </td>

                        {/* Inline: ₹ estimate */}
                        <td className="px-3 py-2 text-center">
                          <InlineCell
                            materialId={m.id} field="priceEstimate"
                            displayValue={m.priceEstimate != null ? String(m.priceEstimate) : ''}
                            prefix="₹" placeholder="—" inputType="number"
                            inlineEdit={inlineEdit}
                            onStart={() => startInline(m, 'priceEstimate')}
                            onSave={saveInline}
                            onCancel={() => setInlineEdit(null)}
                            onChange={v => setInlineEdit(prev => prev ? {...prev, value: v} : null)}
                            className="w-16 text-center text-green-700"
                          />
                        </td>

                        {/* Inline: ASIN */}
                        <td className="px-3 py-2 text-center">
                          <InlineCell
                            materialId={m.id} field="amazonASIN"
                            displayValue={m.amazonASIN || ''}
                            placeholder="paste ASIN"
                            inlineEdit={inlineEdit}
                            onStart={() => startInline(m, 'amazonASIN')}
                            onSave={saveInline}
                            onCancel={() => setInlineEdit(null)}
                            onChange={v => setInlineEdit(prev => prev ? {...prev, value: v} : null)}
                            className="w-28 font-mono text-xs text-orange-600"
                          />
                        </td>

                        <td className="px-3 py-2 text-center">
                          {m.amazonUrl ? (
                            <a href={m.amazonUrl} target="_blank" rel="noopener noreferrer"
                              className="text-orange-400 hover:text-orange-600 transition-colors">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <span className="text-gray-200">—</span>
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

        {/* ════════════════════════════════════════════════════════════════
            TAB: BULK JSON UPLOAD
        ════════════════════════════════════════════════════════════════ */}
        {tab === 'bulk' && (
          <Card className="p-6 border-0 shadow-sm">
            <h2 className="text-lg font-semibold mb-1">Bulk upload materials</h2>
            <p className="text-sm text-gray-500 mb-4">
              Paste a JSON array. Duplicates (same name + category) are skipped.
              Supports <code className="text-xs bg-gray-100 px-1 rounded">amazonASIN</code> and <code className="text-xs bg-gray-100 px-1 rounded">priceEstimate</code> fields.
            </p>
            <button onClick={() => setBulkText(BULK_EXAMPLE)} className="text-xs text-indigo-600 hover:underline mb-3 block">
              Load example JSON
            </button>
            <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={14}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-indigo-400 resize-none"
              placeholder={'[\n  { "name": "LED Bulb", "category": "Electronics", "goinsPrice": 15, "amazonASIN": "B08XYZ123", "priceEstimate": 15 },\n  ...\n]'} />

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

        {/* ════════════════════════════════════════════════════════════════
            TAB: PASTE FROM EXCEL
        ════════════════════════════════════════════════════════════════ */}
        {tab === 'excel' && (
          <Card className="p-6 border-0 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">Paste from Excel / Google Sheets</h2>
              <p className="text-sm text-gray-500">Copy rows from your spreadsheet and paste below. First row as header is skipped automatically.</p>
            </div>
            <div className="flex gap-4 items-end flex-wrap">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Default Goins cost</label>
                <input type="number" value={defaultGoins} onChange={e => setDefaultGoins(Number(e.target.value))}
                  className="w-24 border border-gray-200 rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Default category</label>
                <select value={defaultCat} onChange={e => setDefaultCat(e.target.value)}
                  className="border border-gray-200 rounded px-2 py-1 text-sm bg-white">
                  {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={parseExcel} className="px-4 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-800">
                Parse rows
              </button>
            </div>
            <textarea value={excelText} onChange={e => setExcelText(e.target.value)} rows={8}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-indigo-400 resize-none"
              placeholder="Paste rows from Excel here (tab-separated)…" />

            {excelRows.length > 0 && (
              <>
                <p className="text-sm text-gray-600">{excelRows.length} rows parsed — review and edit before uploading:</p>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Name','Description','Category','Unit','Goins',''].map(h => (
                          <th key={h} className="text-left px-3 py-2 font-medium text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {excelRows.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-1.5">
                            <input value={r.name} onChange={e => updateRow(i,'name',e.target.value)}
                              className="w-32 border-b border-gray-200 focus:outline-none focus:border-indigo-400 text-xs" />
                          </td>
                          <td className="px-3 py-1.5">
                            <input value={r.description} onChange={e => updateRow(i,'description',e.target.value)}
                              className="w-40 border-b border-gray-200 focus:outline-none focus:border-indigo-400 text-xs" />
                          </td>
                          <td className="px-3 py-1.5">
                            <input list="cat-opts-excel" value={r.category} onChange={e => updateRow(i,'category',e.target.value)}
                              className="w-28 border-b border-gray-200 focus:outline-none text-xs" />
                            <datalist id="cat-opts-excel">{CATEGORY_OPTIONS.map(c => <option key={c} value={c} />)}</datalist>
                          </td>
                          <td className="px-3 py-1.5">
                            <select value={r.unit} onChange={e => updateRow(i,'unit',e.target.value)}
                              className="border-b border-gray-200 focus:outline-none text-xs bg-transparent">
                              {UNIT_OPTIONS.map(u => <option key={u}>{u}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-1.5">
                            <input type="number" value={r.goinsPrice} onChange={e => updateRow(i,'goinsPrice',Number(e.target.value))}
                              className="w-16 border-b border-gray-200 focus:outline-none text-xs" />
                          </td>
                          <td className="px-3 py-1.5">
                            <button onClick={() => setExcelRows(prev => prev.filter((_,j)=>j!==i))}
                              className="text-red-400 hover:text-red-600"><X className="h-3 w-3" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {excelResult && (
                  <div className={`p-3 rounded-lg text-sm ${excelResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}>
                    {excelResult.error ? `Error: ${excelResult.error}` : `${excelResult.created} created, ${excelResult.skipped} skipped.`}
                  </div>
                )}
                <button onClick={submitExcel} disabled={excelLoading}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {excelLoading ? 'Uploading…' : `Upload ${excelRows.length} materials`}
                </button>
              </>
            )}
          </Card>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          MODAL: Add / Edit material
      ════════════════════════════════════════════════════════════════ */}
      {showMatForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg p-6 border-0 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">{editingMat ? 'Edit material' : 'Add material'}</h2>
              <button onClick={() => setShowMatForm(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-4">
              {/* ── Core fields ── */}
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Core info</div>
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
                  <label className="block text-sm font-medium text-amber-700 mb-1">🪙 Goins cost *</label>
                  <input type="number" min={1} placeholder="10" value={matForm.goinsPrice}
                    onChange={e => setMatForm(f => ({...f, goinsPrice: e.target.value}))}
                    className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
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
                  <input list="cat-opts-modal" value={matForm.category}
                    onChange={e => setMatForm(f => ({...f, category: e.target.value}))}
                    placeholder="Electronics, Paper…"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  <datalist id="cat-opts-modal">
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
              <div className="flex flex-wrap gap-1">
                {EMOJI_OPTIONS.map(e => (
                  <button key={e} type="button" onClick={() => setMatForm(f => ({...f, icon: e}))}
                    className={`text-xl p-1.5 rounded-lg border-2 transition-all ${matForm.icon === e ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    {e}
                  </button>
                ))}
              </div>

              {/* ── Amazon / Shop fields ── */}
              <div className="border-t border-gray-100 pt-4">
                <div className="text-xs font-semibold text-orange-500 uppercase tracking-wider mb-3">🛒 Amazon Affiliate &amp; Shop</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-orange-700 mb-1">Amazon ASIN</label>
                    <input type="text" placeholder="e.g. B08XYZ1234" value={matForm.amazonASIN}
                      onChange={e => setMatForm(f => ({...f, amazonASIN: e.target.value}))}
                      className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-300" />
                    {matForm.amazonASIN && (
                      <p className="mt-1 text-xs text-gray-400 truncate">
                        → <a href={buildAmazonUrl(matForm.amazonASIN) || '#'} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">
                          amazon.in/dp/{matForm.amazonASIN.trim()}?tag={AMAZON_TAG}
                        </a>
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-1">₹ Price estimate</label>
                    <input type="number" min={0} placeholder="e.g. 45" value={matForm.priceEstimate}
                      onChange={e => setMatForm(f => ({...f, priceEstimate: e.target.value}))}
                      className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
                    <p className="mt-1 text-xs text-gray-400">Approx real-world cost shown to child</p>
                  </div>
                </div>
                <div className="flex gap-4 mt-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={matForm.showInShop}
                      onChange={e => setMatForm(f => ({...f, showInShop: e.target.checked}))}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-300" />
                    <span className="text-sm text-gray-700">🛒 Show in Shop</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={matForm.showInPlanning}
                      onChange={e => setMatForm(f => ({...f, showInPlanning: e.target.checked}))}
                      className="rounded border-gray-300 text-amber-500 focus:ring-amber-300" />
                    <span className="text-sm text-gray-700">📋 Show in Planning</span>
                  </label>
                </div>
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