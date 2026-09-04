'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import { Search, RefreshCw, Plus, Pencil, Trash2, X, Grid, Package, ShoppingBag, Lightbulb, Check, Loader2 } from 'lucide-react'

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
  amazonNeedsAttention?: boolean
  amazonAttentionReason?: string | null
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


// ── "Find on Amazon" modal — search PA API (Gemini-refined), tap to link ────
interface AmazonCandidate {
  asin: string
  title: string
  imageUrl: string | null
  priceRupees: number | null
  detailPageUrl: string
}

function FindOnAmazonModal({ material: m, apiBase, onClose, onPicked }: {
  material: { id: string; name: string }
  apiBase: string
  onClose: () => void
  onPicked: (asin: string, priceRupees: number | null) => void
}) {
  const [loading, setLoading]   = React.useState(true)
  const [configured, setConfigured] = React.useState(true)
  const [error, setError]       = React.useState<string | null>(null)
  const [results, setResults]   = React.useState<AmazonCandidate[]>([])
  const [searchedFor, setSearchedFor] = React.useState('')

  React.useEffect(() => {
    (async () => {
      try {
        const token = await authToken()
        const res = await fetch(`${apiBase}/materials/admin/${m.id}/find-on-amazon`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        const data = await res.json()
        setConfigured(!!data.configured)
        setResults(data.results || [])
        setSearchedFor(data.searchedFor || m.name)
        if (data.error) setError(data.error)
      } catch (e: any) {
        setError(e.message || 'Search failed')
      } finally {
        setLoading(false)
      }
    })()
  }, [m.id])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-semibold text-gray-900">🔍 Find on Amazon</h3>
            <p className="text-xs text-gray-400">for &ldquo;{m.name}&rdquo;</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 className="animate-spin mr-2" size={18} /> Searching Amazon…
            </div>
          )}
          {!loading && !configured && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Amazon Product Advertising API isn&apos;t connected yet — add
              <code className="mx-1 px-1 bg-amber-100 rounded">AMAZON_PAAPI_ACCESS_KEY</code>,
              <code className="mx-1 px-1 bg-amber-100 rounded">AMAZON_PAAPI_SECRET_KEY</code> and
              <code className="mx-1 px-1 bg-amber-100 rounded">AMAZON_PAAPI_PARTNER_TAG</code> on
              Cloud Run. Until then, ASINs can be entered by hand below.
            </div>
          )}
          {!loading && configured && error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}
          {!loading && configured && !error && results.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No matches found for &ldquo;{searchedFor}&rdquo;.</p>
          )}
          {!loading && results.length > 0 && (
            <div className="space-y-2">
              {searchedFor && searchedFor.toLowerCase() !== m.name.toLowerCase() && (
                <p className="text-xs text-gray-400 mb-2">Searched as: &ldquo;{searchedFor}&rdquo;</p>
              )}
              {results.map(r => (
                <button
                  key={r.asin}
                  onClick={() => onPicked(r.asin, r.priceRupees)}
                  className="w-full flex items-center gap-3 p-2 border border-gray-200 rounded-lg hover:border-orange-400 hover:bg-orange-50 text-left transition-colors"
                >
                  <div className="w-14 h-14 flex-shrink-0 bg-white border rounded flex items-center justify-center overflow-hidden">
                    {r.imageUrl
                      ? <img src={r.imageUrl} alt="" className="max-w-full max-h-full object-contain" />
                      : <Package size={20} className="text-gray-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 line-clamp-2">{r.title}</p>
                    <p className="text-xs text-gray-500 font-mono">{r.asin}</p>
                  </div>
                  <div className="text-sm font-semibold text-orange-600 whitespace-nowrap">
                    {r.priceRupees != null ? `₹${r.priceRupees}` : '—'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Inline always-editable ASIN row ──────────────────────────────────────────
function AsinRow({ material: m, apiBase, onSaved, onFlash }: {
  material: any
  apiBase: string
  onSaved: () => void
  onFlash: (msg: string, isError?: boolean) => void
}) {
  const [asin,  setAsin]  = React.useState(m.amazonASIN  || '')
  const [price, setPrice] = React.useState(m.priceEstimate != null ? String(m.priceEstimate) : '')
  const [saving, setSaving] = React.useState(false)
  const [dirty,  setDirty]  = React.useState(false)
  const [finding, setFinding] = React.useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const v = `; ${document.cookie}`
      const p = v.split('; auth_token=')
      const token = p.length === 2 ? p.pop()!.split(';').shift()! : ''
      const cleanAsin = asin.trim()
      const res = await fetch(`${apiBase}/materials/admin/${m.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amazonASIN:    cleanAsin || null,
          priceEstimate: price ? Number(price) : null,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setDirty(false)
      onFlash('Saved: ' + m.name)
      onSaved()
    } catch (e: any) {
      onFlash('Save failed: ' + e.message, true)
    } finally { setSaving(false) }
  }

  return (
    <tr className="hover:bg-orange-50/30">
      <td className="px-4 py-2 text-lg">{m.icon || '📦'}</td>
      <td className="px-4 py-2">
        <p className="text-sm font-medium text-gray-900">{m.name}</p>
        <p className="text-xs text-gray-400">{m.category}</p>
        {m.amazonNeedsAttention && (
          <p className="text-xs text-red-600 mt-0.5">⚠️ {m.amazonAttentionReason || 'Needs review'}</p>
        )}
      </td>
      <td className="px-4 py-2">
        <input
          type="text"
          value={asin}
          onChange={e => { setAsin(e.target.value); setDirty(true) }}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="B0XXXXXXXXX"
          className={`w-36 px-2 py-1 border rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-orange-400 ${
            asin ? 'border-orange-300 text-orange-700' : 'border-gray-200 text-gray-400'
          }`}
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="number"
          value={price}
          onChange={e => { setPrice(e.target.value); setDirty(true) }}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="₹"
          className="w-20 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
        />
      </td>
      <td className="px-4 py-2">
        {m.amazonUrl ? (
          <a href={m.amazonUrl} target="_blank" rel="noopener"
            className="text-xs text-orange-600 hover:underline">View ↗</a>
        ) : <span className="text-xs text-gray-300">—</span>}
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFinding(true)}
            title="Find on Amazon"
            className="px-2 py-1 bg-white border border-orange-300 text-orange-600 rounded text-xs font-medium hover:bg-orange-50"
          >
            🔍 Find
          </button>
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="px-3 py-1 bg-orange-500 text-white rounded text-xs font-medium hover:bg-orange-600 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {saving ? '…' : 'Save'}
          </button>
        </div>
      </td>
      {finding && (
        <FindOnAmazonModal
          material={{ id: m.id, name: m.name }}
          apiBase={apiBase}
          onClose={() => setFinding(false)}
          onPicked={(pickedAsin, pickedPrice) => {
            setAsin(pickedAsin)
            if (pickedPrice != null) setPrice(String(pickedPrice))
            setDirty(true)
            setFinding(false)
            onFlash('Picked — tap Save to confirm')
          }}
        />
      )}
    </tr>
  )
}

// ── AI Suggestions tab — bulk scan, review queue, needs-attention list ──────
interface AmazonSuggestionRow {
  id: string
  materialId: string
  materialName: string
  suggestedAsin: string | null
  suggestedTitle: string | null
  suggestedImageUrl: string | null
  suggestedPriceRupees: number | null
  imageConfidence: number | null
  imageConfidenceNote: string | null
  reason: string | null
  status: string
}

function AiSuggestionsTab({ apiBase, onMaterialsChanged, flash }: {
  apiBase: string
  onMaterialsChanged: () => void
  flash: (msg: string, isError?: boolean) => void
}) {
  const [scanning, setScanning] = React.useState(false)
  const [pending, setPending] = React.useState<AmazonSuggestionRow[]>([])
  const [noMatch, setNoMatch] = React.useState<AmazonSuggestionRow[]>([])
  const [needsAttention, setNeedsAttention] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [lastScan, setLastScan] = React.useState<string | null>(null)

  const loadAll = React.useCallback(async () => {
    setLoading(true)
    try {
      const token = await authToken()
      const headers = { Authorization: `Bearer ${token}` }
      const [p, n, a] = await Promise.all([
        fetch(`${apiBase}/materials/admin/amazon-suggestions?status=PENDING`, { headers }).then(r => r.json()),
        fetch(`${apiBase}/materials/admin/amazon-suggestions?status=NO_MATCH`, { headers }).then(r => r.json()),
        fetch(`${apiBase}/materials/admin/amazon-needs-attention`, { headers }).then(r => r.json()),
      ])
      setPending(Array.isArray(p) ? p : [])
      setNoMatch(Array.isArray(n) ? n : [])
      setNeedsAttention(Array.isArray(a) ? a : [])
    } catch (e: any) {
      flash('Failed to load AI suggestions: ' + e.message, true)
    } finally {
      setLoading(false)
    }
  }, [apiBase])

  React.useEffect(() => { loadAll() }, [loadAll])

  const runScan = async () => {
    setScanning(true)
    try {
      const token = await authToken()
      const res = await fetch(`${apiBase}/materials/admin/amazon-suggestions/scan`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 25 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scan failed')
      setLastScan(`Scanned ${data.scanned} materials — ${data.suggested} suggestions, ${data.noMatch} no match${data.suggestionsEnriched ? `, enriched ${data.suggestionsEnriched} child suggestions` : ''}${data.stoppedEarly ? ' (stopped early — run again to continue)' : ''}.`)
      flash('Scan complete')
      await loadAll()
    } catch (e: any) {
      flash('Scan failed: ' + e.message, true)
    } finally {
      setScanning(false)
    }
  }

  const runRefresh = async () => {
    setScanning(true)
    try {
      const token = await authToken()
      const res = await fetch(`${apiBase}/materials/admin/amazon-refresh/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 50 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Refresh failed')
      setLastScan(`Checked ${data.checked} linked materials — ${data.flagged} now need attention, ${data.cleared} still fine.`)
      flash('Refresh complete')
      await loadAll()
      onMaterialsChanged()
    } catch (e: any) {
      flash('Refresh failed: ' + e.message, true)
    } finally {
      setScanning(false)
    }
  }

  const resolveSuggestion = async (id: string, action: 'approve' | 'reject') => {
    try {
      const token = await authToken()
      const res = await fetch(`${apiBase}/materials/admin/amazon-suggestions/${id}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      flash(action === 'approve' ? 'Linked!' : 'Dismissed')
      await loadAll()
      onMaterialsChanged()
    } catch (e: any) {
      flash(`Could not ${action}: ` + e.message, true)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 border-0 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={runScan} disabled={scanning}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
            {scanning ? '🤖 Working…' : '🤖 Scan for Missing ASINs'}
          </button>
          <button onClick={runRefresh} disabled={scanning}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
            {scanning ? '…' : '🔄 Refresh Linked ASINs'}
          </button>
          <p className="text-xs text-gray-400 flex-1">
            Scan finds candidates for materials with no ASIN (and enriches child material suggestions too). Refresh re-checks already-linked ASINs for price/availability drift. Nothing is ever applied without your approval below.
          </p>
        </div>
        {lastScan && <p className="text-xs text-gray-500 mt-2">{lastScan}</p>}
      </Card>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
      ) : (
        <>
          {needsAttention.length > 0 && (
            <Card className="p-4 border-0 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">⚠️ Needs Attention ({needsAttention.length})</h3>
              <div className="space-y-2">
                {needsAttention.map((m: any) => (
                  <div key={m.id} className="flex items-center gap-3 p-2 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{m.name}</p>
                      <p className="text-xs text-red-600">{m.amazonAttentionReason}</p>
                    </div>
                    {m.amazonUrl && (
                      <a href={m.amazonUrl} target="_blank" rel="noopener"
                        className="text-xs text-orange-600 hover:underline whitespace-nowrap">View ↗</a>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-4 border-0 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">🟢 Pending Suggestions ({pending.length})</h3>
            {pending.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Nothing pending — run a scan above.</p>
            ) : (
              <div className="space-y-2">
                {pending.map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-2 border border-gray-200 rounded-lg">
                    <div className="w-12 h-12 flex-shrink-0 bg-white border rounded flex items-center justify-center overflow-hidden">
                      {s.suggestedImageUrl
                        ? <img src={s.suggestedImageUrl} alt="" className="max-w-full max-h-full object-contain" />
                        : <Package size={18} className="text-gray-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">{s.materialName}</span> → {s.suggestedTitle}
                      </p>
                      <p className="text-xs text-gray-500 font-mono">
                        {s.suggestedAsin}{s.suggestedPriceRupees != null ? ` · ₹${s.suggestedPriceRupees}` : ''}
                        {s.imageConfidence != null && (
                          <span className={s.imageConfidence >= 0.7 ? 'text-green-600' : 'text-amber-600'}>
                            {' · photo match '}{Math.round(s.imageConfidence * 100)}%
                          </span>
                        )}
                      </p>
                      {s.imageConfidenceNote && <p className="text-xs text-gray-400">{s.imageConfidenceNote}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => resolveSuggestion(s.id, 'approve')}
                        className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">✓ Link</button>
                      <button onClick={() => resolveSuggestion(s.id, 'reject')}
                        className="px-2 py-1 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4 border-0 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">🔍 No Match Found ({noMatch.length})</h3>
            {noMatch.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Nothing here.</p>
            ) : (
              <div className="space-y-2">
                {noMatch.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-900">{s.materialName}</p>
                      <p className="text-xs text-amber-700">{s.reason}</p>
                    </div>
                    <a href={`https://www.amazon.in/s?k=${encodeURIComponent(s.materialName)}&tag=miniguru04-21`}
                      target="_blank" rel="noopener"
                      className="text-xs text-orange-600 hover:underline whitespace-nowrap">
                      Search manually ↗
                    </a>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

function MaterialsPageInner() {
  const searchParams = useSearchParams()
  const initialTab = (['materials', 'amazon', 'ai', 'bulk', 'suggestions'].includes(searchParams.get('tab') || '')
    ? searchParams.get('tab') : 'materials') as 'materials'|'amazon'|'ai'|'bulk'|'suggestions'
  const [tab, setTab]             = useState<'materials'|'amazon'|'ai'|'bulk'|'suggestions'>(initialTab)
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
  const [findingMat, setFindingMat] = useState<Material | null>(null)
  const [form, setForm]           = useState(EMPTY_MAT)
  const [saving, setSaving]       = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  // Inline ASIN editing
  const [editingAsin, setEditingAsin]   = useState<string | null>(null)
  const [asinValue, setAsinValue]       = useState('')
  const [priceValue, setPriceValue]     = useState('')
  const [savingAsin, setSavingAsin]     = useState(false)
  const [showAllInAmazonTab, setShowAllInAmazonTab] = useState(false)

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

  // Pre-fills the Add Material form from a child's suggestion + whatever
  // Amazon candidate the AI scan already found for it — admin still
  // reviews and taps Save, nothing is created automatically.
  const openAddFromSuggestion = (s: Suggestion) => {
    setEditingMat(null)
    setForm({
      ...EMPTY_MAT,
      name: s.suggestion,
      goinsPrice: s.requestedGoinsPrice != null ? String(s.requestedGoinsPrice) : '',
      amazonASIN: s.amazonAsinFound || '',
      priceEstimate: s.amazonPriceFound != null ? String(s.amazonPriceFound) : '',
      imageUrl: s.amazonImageUrlFound || '',
    })
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
        amazonUrl:      asin ? `https://www.amazon.in/dp/${asin}?tag=miniguru04-21` : null,
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

  // ── Direct image upload/remove — only available once the material exists ──
  const uploadImageFile = async (file: File) => {
    if (!editingMat) {
      flash('Save the material first, then reopen it to upload a photo.', true)
      return
    }
    setUploadingImage(true)
    try {
      const token = await authToken()
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch(`${API_BASE}/materials/admin/${editingMat.id}/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }, // no Content-Type — browser sets multipart boundary
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setForm(f => ({ ...f, imageUrl: data.imageUrl }))
      flash('Image uploaded!')
      await load()
    } catch (e: any) {
      flash('Image upload failed: ' + e.message, true)
    } finally {
      setUploadingImage(false)
    }
  }

  const removeImage = async () => {
    if (!editingMat) return
    if (!confirm('Remove this image? This deletes it from storage.')) return
    setUploadingImage(true)
    try {
      const token = await authToken()
      const res = await fetch(`${API_BASE}/materials/admin/${editingMat.id}/image`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(await res.text())
      setForm(f => ({ ...f, imageUrl: '' }))
      flash('Image removed.')
      await load()
    } catch (e: any) {
      flash('Remove failed: ' + e.message, true)
    } finally {
      setUploadingImage(false)
    }
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
          amazonUrl:     asin ? `https://www.amazon.in/dp/${asin}?tag=miniguru04-21` : null,
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

  // Amazon tab list — by default, only materials with an "ASIN concern"
  // (no ASIN yet, OR flagged needsAttention by the nightly refresh check).
  // Checkbox lets an admin browse the full catalog here if they want to.
  const amazonList = materials.filter(m =>
    (showAllInAmazonTab || !m.amazonASIN || m.amazonNeedsAttention) && m.isActive
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
            { key: 'ai',       label: '🤖 AI Suggestions' },
            { key: 'bulk',     label: '📋 Bulk Upload' },
            { key: 'suggestions', label: '💡 Suggestions' },
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
                          <p className="font-medium text-gray-900 text-sm">
                            {m.name}{m.amazonNeedsAttention && <span title={m.amazonAttentionReason || 'Needs review'} className="ml-1">⚠️</span>}
                          </p>
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
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            <button onClick={() => openEdit(m)}
                              className="px-2 py-1 border border-gray-200 text-gray-600 rounded text-xs hover:bg-gray-50">
                              Edit
                            </button>
                            <button onClick={() => setFindingMat(m)}
                              title="Find on Amazon"
                              className="px-2 py-1 bg-white border border-orange-300 text-orange-600 rounded text-xs hover:bg-orange-50">
                              🔍 Find
                            </button>
                            {m.amazonUrl && (
                              <a href={m.amazonUrl} target="_blank" rel="noopener"
                                className="px-2 py-1 border border-gray-200 text-orange-600 rounded text-xs hover:bg-orange-50">
                                View ↗
                              </a>
                            )}
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
            {findingMat && (
              <FindOnAmazonModal
                material={{ id: findingMat.id, name: findingMat.name }}
                apiBase={API_BASE}
                onClose={() => setFindingMat(null)}
                onPicked={async (asin, priceRupees) => {
                  setFindingMat(null)
                  const token = await authToken()
                  await fetch(`${API_BASE}/materials/admin/${findingMat.id}`, {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amazonASIN: asin, ...(priceRupees != null ? { priceEstimate: priceRupees } : {}) }),
                  })
                  flash(`Linked ASIN for "${findingMat.name}"`)
                  load()
                }}
              />
            )}
          </>
        )}

        {/* ── AMAZON SETUP TAB ── */}
        {tab === 'amazon' && (
          <>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={showAllInAmazonTab}
                  onChange={e => setShowAllInAmazonTab(e.target.checked)}
                  className="rounded" />
                Show all materials, not just ones needing attention
              </label>
              <span className="text-xs text-gray-400">
                {materials.filter(m => (!m.amazonASIN || m.amazonNeedsAttention) && m.isActive).length} need attention
                {' · '}{materials.filter(m => !m.amazonASIN && m.isActive).length} without ASIN
              </span>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <strong>How to find an ASIN:</strong> Search the item on amazon.in → open the product page → copy the code from the URL: amazon.in/dp/<strong>B0XXXXXXXX</strong> — that is the ASIN.
              The affiliate tag <code>miniguru04-21</code> is added automatically.
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
                      <AsinRow
                        key={m.id}
                        material={m}
                        apiBase={API_BASE}
                        onSaved={load}
                        onFlash={flash}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {/* ── AI SUGGESTIONS TAB ── */}
        {tab === 'ai' && <AiSuggestionsTab apiBase={API_BASE} onMaterialsChanged={load} flash={flash} />}

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

        {/* ── SUGGESTIONS FROM USERS TAB ── */}
        {tab === 'suggestions' && <SuggestionsTab onCreateMaterial={openAddFromSuggestion} />}
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
                    → amazon.in/dp/{form.amazonASIN}?tag=miniguru04-21
                  </p>
                )}
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
                <input type="text" value={form.imageUrl} onChange={e => setForm(f => ({...f, imageUrl: e.target.value}))}
                  placeholder="Firebase Storage URL (or upload directly below)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                {form.imageUrl && (
                  <img src={form.imageUrl} alt="preview" className="mt-2 h-14 w-14 object-contain rounded border bg-white" />
                )}
                <div className="flex items-center gap-2 mt-2">
                  <label className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                    editingMat ? 'border-indigo-300 text-indigo-700 hover:bg-indigo-50' : 'border-gray-200 text-gray-400 cursor-not-allowed'
                  }`}>
                    {uploadingImage ? 'Uploading…' : '📤 Upload photo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={!editingMat || uploadingImage}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadImageFile(f); e.target.value = '' }}
                    />
                  </label>
                  {form.imageUrl && (
                    <button
                      type="button"
                      disabled={uploadingImage}
                      onClick={removeImage}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                    >
                      🗑️ Remove image
                    </button>
                  )}
                </div>
                {!editingMat && (
                  <p className="text-xs text-gray-400 mt-1">Save this material first, then reopen it to upload a photo directly.</p>
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

// Next.js 15 requires any component that calls useSearchParams() to be
// wrapped in a Suspense boundary, or `next build` fails outright — this
// bit us on the Goins and People pages earlier, so it's handled correctly
// here from the start.
export default function MaterialsPage() {
  return (
    <Suspense fallback={null}>
      <MaterialsPageInner />
    </Suspense>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SUGGESTIONS FROM USERS  (moved from the old standalone /product-suggestions
// page — same logic, unchanged, reuses this file's existing authToken())
// ═══════════════════════════════════════════════════════════════════════════
interface Suggestion {
  id: string
  childName: string | null
  suggestion: string
  category: string | null
  requestedGoinsPrice: number | null
  projectContext: string | null
  status: 'pending' | 'approved' | 'added' | 'rejected'
  adminNotes: string | null
  resolvedMaterialId: string | null
  createdAt: string
  amazonAsinFound?: string | null
  amazonTitleFound?: string | null
  amazonImageUrlFound?: string | null
  amazonPriceFound?: number | null
  amazonSearchedAt?: string | null
}

const SUGGESTION_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  added: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
}

function SuggestionsTab({ onCreateMaterial }: { onCreateMaterial: (s: Suggestion) => void }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'added' | 'rejected'>('pending')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({})

  const load = async () => {
    setLoading(true)
    try {
      const token = await authToken()
      const qs = filter === 'all' ? '' : `?status=${filter}`
      const res = await fetch(`${API_BASE}/admin/product-suggestions${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filter])

  const resolve = async (id: string, status: Suggestion['status']) => {
    setBusyId(id)
    try {
      const token = await authToken()
      await fetch(`${API_BASE}/admin/product-suggestions/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNotes: notesDraft[id] ?? undefined }),
      })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 mb-1">
        <Lightbulb className="w-5 h-5 text-amber-500" />
        <h2 className="text-lg font-semibold text-gray-900">Suggestions From Users</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Materials children asked for that don't exist yet — from the shop's suggestion box and the
        material picker's "Add your own item" custom material flow. Resolving here doesn't create the
        Material for you — add it normally in the All Materials tab first, then mark it added here.
      </p>

      <div className="flex gap-2 mb-5">
        {(['pending', 'approved', 'added', 'rejected', 'all'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border capitalize ${
              filter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
      ) : suggestions.length === 0 ? (
        <Card className="p-10 text-center text-gray-400">Nothing here.</Card>
      ) : (
        <div className="space-y-3">
          {suggestions.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-gray-900">{s.suggestion}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${SUGGESTION_STATUS_STYLES[s.status]}`}>
                      {s.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {s.childName ? `Suggested by ${s.childName}` : 'Anonymous'}
                    {s.category && s.category !== 'custom_material_request' ? ` · ${s.category}` : ''} · {new Date(s.createdAt).toLocaleDateString()}
                  </p>
                  {s.projectContext && (
                    <p className="text-xs text-indigo-600 mt-0.5">🎯 {s.projectContext}</p>
                  )}
                  {s.requestedGoinsPrice != null && (
                    <p className="text-xs text-amber-600 mt-0.5">Suggested Goins rate: {s.requestedGoinsPrice}G</p>
                  )}
                  <a
                    href={`https://www.amazon.in/s?k=${encodeURIComponent(s.suggestion)}&tag=miniguru04-21`}
                    target="_blank" rel="noopener"
                    className="text-xs text-orange-600 hover:underline mt-1 inline-block"
                  >
                    🔍 Search &ldquo;{s.suggestion}&rdquo; on Amazon ↗
                  </a>
                  {s.amazonAsinFound ? (
                    <div className="mt-2 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-2">
                      {s.amazonImageUrlFound && (
                        <img src={s.amazonImageUrlFound} alt="" className="w-10 h-10 object-contain bg-white rounded border" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-green-800 line-clamp-1">{s.amazonTitleFound}</p>
                        <p className="text-xs text-green-600 font-mono">
                          {s.amazonAsinFound}{s.amazonPriceFound != null ? ` · ₹${s.amazonPriceFound}` : ''}
                        </p>
                      </div>
                      {s.status === 'pending' && (
                        <button onClick={() => onCreateMaterial(s)}
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 whitespace-nowrap">
                          + Create Material
                        </button>
                      )}
                    </div>
                  ) : s.amazonSearchedAt ? (
                    <p className="text-xs text-amber-600 mt-1">🤖 AI searched but found no confident match — try the manual search link above.</p>
                  ) : (
                    <p className="text-xs text-gray-400 mt-1">🤖 Not yet scanned by AI — runs automatically with the next Amazon scan.</p>
                  )}
                  {s.adminNotes && <p className="text-xs text-gray-400 mt-1">Note: {s.adminNotes}</p>}
                  {s.status === 'pending' || s.status === 'approved' ? (
                    <input
                      type="text"
                      placeholder="Admin note (optional)"
                      defaultValue={s.adminNotes || ''}
                      onChange={(e) => setNotesDraft((d) => ({ ...d, [s.id]: e.target.value }))}
                      className="mt-2 w-full px-2 py-1 text-xs border border-gray-200 rounded"
                    />
                  ) : null}
                </div>
                {(s.status === 'pending' || s.status === 'approved') && (
                  <div className="flex flex-col gap-1 shrink-0">
                    {s.status === 'pending' && (
                      <button
                        disabled={busyId === s.id}
                        onClick={() => resolve(s.id, 'approved')}
                        className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                      >
                        Mark approved
                      </button>
                    )}
                    <button
                      disabled={busyId === s.id}
                      onClick={() => resolve(s.id, 'added')}
                      className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Mark added
                    </button>
                    <button
                      disabled={busyId === s.id}
                      onClick={() => resolve(s.id, 'rejected')}
                      className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Reject
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}