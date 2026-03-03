'use client'

import React, { useEffect, useState, useRef } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import { Search, RefreshCw, Plus, Pencil, Trash2, X, Grid, Package, ImagePlus } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

interface Material {
  id: string; name: string; description: string; price: number
  inventory: number; categoryId: string; category?: { id: string; name: string }; images?: string[]
}

interface Category {
  id: string; name: string; icon: string; imageUrl?: string
}

async function authToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('adminToken') || '' : ''
}

const EMPTY_MAT = { name: '', description: '', price: '', inventory: '100', categoryId: '', categoryName: '' }
const EMPTY_CAT = { name: '', icon: '📦', imageUrl: '' }
const EMOJI_OPTIONS = ['📦','🔌','⚙️','🔧','🧲','🪛','🔩','🧪','🎨','✂️','📐','📏','🔋','💡','🪚','🧵','🪡','🎭','🌿','♻️']

export default function MaterialsPage() {
  const [tab, setTab]                     = useState<'categories'|'materials'>('categories')
  const [materials, setMaterials]         = useState<Material[]>([])
  const [categories, setCategories]       = useState<Category[]>([])
  const [filtered, setFiltered]           = useState<Material[]>([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [error, setError]                 = useState('')
  const [success, setSuccess]             = useState('')

  // Material form
  const [showMatForm, setShowMatForm]     = useState(false)
  const [editingMat, setEditingMat]       = useState<Material | null>(null)
  const [matForm, setMatForm]             = useState(EMPTY_MAT)
  const [matImages, setMatImages]         = useState<File[]>([])
  const [matImagePreviews, setMatImagePreviews] = useState<string[]>([])
  const [savingMat, setSavingMat]         = useState(false)
  const [deletingMatId, setDeletingMatId] = useState<string|null>(null)
  const matFileRef                        = useRef<HTMLInputElement>(null)

  // Category form
  const [showCatForm, setShowCatForm]     = useState(false)
  const [editingCat, setEditingCat]       = useState<Category | null>(null)
  const [catForm, setCatForm]             = useState(EMPTY_CAT)
  const [savingCat, setSavingCat]         = useState(false)
  const [deletingCatId, setDeletingCatId] = useState<string|null>(null)

  const flash = (msg: string, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(''), 6000) }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  }

  const load = async () => {
    setLoading(true); setError('')
    try {
      const token = await authToken()
      const headers = { Authorization: `Bearer ${token}` }
      const [mRes, cRes] = await Promise.all([
        fetch(`${API_BASE}/products/`, { headers }),
        fetch(`${API_BASE}/products/categories/all`, { headers }),
      ])
      const mData = mRes.ok ? await mRes.json() : []
      const cData = cRes.ok ? await cRes.json() : []
      setMaterials(Array.isArray(mData) ? mData : [])
      setCategories(Array.isArray(cData) ? cData : [])
    } catch (e: any) {
      flash('Backend not connected: ' + e.message, true)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(materials.filter(m =>
      m.name.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q)
    ))
  }, [search, materials])

  // ── Image file picker ────────────────────────────────────────────
  const handleMatImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setMatImages(files)
    setMatImagePreviews(files.map(f => URL.createObjectURL(f)))
  }

  const clearImages = () => {
    setMatImages([])
    setMatImagePreviews([])
    if (matFileRef.current) matFileRef.current.value = ''
  }

  // ── Category CRUD ────────────────────────────────────────────────
  const openAddCat  = () => { setEditingCat(null); setCatForm(EMPTY_CAT); setShowCatForm(true) }
  const openEditCat = (c: Category) => {
    setEditingCat(c); setCatForm({ name: c.name, icon: c.icon || '📦', imageUrl: c.imageUrl || '' }); setShowCatForm(true)
  }

  const handleSaveCat = async () => {
    if (!catForm.name.trim()) { flash('Category name is required', true); return }
    setSavingCat(true)
    try {
      const token = await authToken()
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      const body = JSON.stringify({ name: catForm.name, icon: catForm.icon, imageUrl: catForm.imageUrl })
      const res = editingCat
        ? await fetch(`${API_BASE}/admin/product/category/${editingCat.id}`, { method: 'PUT', headers, body })
        : await fetch(`${API_BASE}/admin/product/category`, { method: 'POST', headers, body })
      if (!res.ok) throw new Error(await res.text())
      flash(editingCat ? 'Category updated!' : 'Category created!')
      setShowCatForm(false); await load()
    } catch (e: any) { flash('Save failed: ' + e.message, true) }
    finally { setSavingCat(false) }
  }

  const handleDeleteCat = async (id: string, name: string) => {
    const mCount = materials.filter(m => m.categoryId === id).length
    if (mCount > 0) { flash(`Cannot delete — ${mCount} material(s) use this category`, true); return }
    if (!confirm(`Delete category "${name}"?`)) return
    setDeletingCatId(id)
    try {
      const token = await authToken()
      const res = await fetch(`${API_BASE}/admin/product/category/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Delete failed')
      setCategories(prev => prev.filter(c => c.id !== id)); flash('Category deleted')
    } catch (e: any) { flash('Delete failed: ' + e.message, true) }
    finally { setDeletingCatId(null) }
  }

  // ── Material CRUD ────────────────────────────────────────────────
  const openAddMat = () => {
    setEditingMat(null); setMatForm(EMPTY_MAT); clearImages(); setShowMatForm(true)
  }
  const openEditMat = (m: Material) => {
    setEditingMat(m)
    const cat = categories.find(c => c.id === m.categoryId)
    setMatForm({
      name: m.name, description: m.description || '',
      price: String(m.price), inventory: String(m.inventory),
      categoryId: m.categoryId || '', categoryName: cat?.name || ''
    })
    clearImages(); setShowMatForm(true)
  }

  const handleSaveMat = async () => {
    if (!matForm.name || !matForm.price || !matForm.categoryId) {
      flash('Name, price and category are required', true); return
    }
    setSavingMat(true)
    try {
      const token = await authToken()
      const cat = categories.find(c => c.id === matForm.categoryId)
      if (!cat) throw new Error('Category not found')

      // Backend requires multipart/form-data with categoryName (not categoryId)
      const fd = new FormData()
      fd.append('name', matForm.name)
      fd.append('description', matForm.description)
      fd.append('price', matForm.price)
      fd.append('inventory', matForm.inventory)
      fd.append('categoryName', cat.name)
      matImages.forEach(f => fd.append('images', f))

      const res = editingMat
        ? await fetch(`${API_BASE}/admin/product/${editingMat.id}`, {
            method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: fd
          })
        : await fetch(`${API_BASE}/admin/product`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd
          })

      if (!res.ok) throw new Error(await res.text())
      flash(editingMat ? 'Material updated!' : 'Material added!')
      setShowMatForm(false); clearImages(); await load()
    } catch (e: any) { flash('Save failed: ' + e.message, true) }
    finally { setSavingMat(false) }
  }

  const handleDeleteMat = async (id: string) => {
    if (!confirm('Delete this material?')) return
    setDeletingMatId(id)
    try {
      const token = await authToken()
      const res = await fetch(`${API_BASE}/admin/product/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Delete failed')
      setMaterials(prev => prev.filter(m => m.id !== id)); flash('Material deleted')
    } catch (e: any) { flash('Delete failed: ' + e.message, true) }
    finally { setDeletingMatId(null) }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {error   && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        {success && <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Project Materials</h1>
            <p className="text-sm text-gray-500 mt-1">Manage categories and materials kids use when planning projects</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            {tab === 'categories'
              ? <button onClick={openAddCat} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
                  <Plus className="h-4 w-4" /> Add Category
                </button>
              : <button onClick={openAddMat} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                  <Plus className="h-4 w-4" /> Add Material
                </button>
            }
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-5 border-0 shadow-sm">
            <p className="text-sm text-gray-500">Categories</p>
            <p className="text-3xl font-bold text-purple-600 mt-1">{categories.length}</p>
          </Card>
          <Card className="p-5 border-0 shadow-sm">
            <p className="text-sm text-gray-500">Total Materials</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{materials.length}</p>
          </Card>
          <Card className="p-5 border-0 shadow-sm">
            <p className="text-sm text-gray-500">Avg Goins Cost</p>
            <p className="text-3xl font-bold text-amber-600 mt-1">
              {materials.length > 0 ? Math.round(materials.reduce((s,m) => s+m.price,0)/materials.length) : 0}
            </p>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          <button onClick={() => setTab('categories')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab==='categories' ? 'bg-white shadow-sm text-purple-700' : 'text-gray-500 hover:text-gray-700'}`}>
            <Grid className="h-4 w-4" /> Categories
          </button>
          <button onClick={() => setTab('materials')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab==='materials' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
            <Package className="h-4 w-4" /> Materials
          </button>
        </div>

        {/* ── CATEGORIES TAB ── */}
        {tab === 'categories' && (
          loading ? (
            <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /></div>
          ) : categories.length === 0 ? (
            <Card className="p-16 border-0 shadow-sm text-center border-2 border-dashed border-gray-200">
              <div className="text-6xl mb-3">🗂️</div>
              <p className="text-gray-500 font-medium">No categories yet</p>
              <p className="text-sm text-gray-400 mt-1">Create categories first, then add materials to them</p>
              <button onClick={openAddCat} className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
                Create First Category
              </button>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {categories.map(c => {
                const matCount = materials.filter(m => m.categoryId === c.id).length
                return (
                  <Card key={c.id} className="border-0 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    <div className="h-32 bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center overflow-hidden">
                      {c.imageUrl
                        ? <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" onError={(e:any) => { e.target.style.display='none' }} />
                        : <span className="text-6xl">{c.icon || '📦'}</span>
                      }
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-gray-900 text-sm">{c.icon} {c.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{matCount} material{matCount!==1?'s':''}</p>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => openEditCat(c)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button onClick={() => handleDeleteCat(c.id, c.name)} disabled={deletingCatId===c.id}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 border border-red-200 rounded-lg text-xs text-red-500 hover:bg-red-50 disabled:opacity-40">
                          <Trash2 className="h-3 w-3" /> {deletingCatId===c.id?'...':'Del'}
                        </button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )
        )}

        {/* ── MATERIALS TAB ── */}
        {tab === 'materials' && (
          <>
            <Card className="p-4 border-0 shadow-sm">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="text" placeholder="Search materials..." value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </Card>
            <Card className="border-0 shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">Material</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3 hidden md:table-cell">Category</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3 hidden md:table-cell">Image</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase px-5 py-3">Goins</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase px-5 py-3 hidden md:table-cell">Stock</th>
                      <th className="text-center text-xs font-semibold text-gray-500 uppercase px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={6} className="text-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                      </td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-16">
                        <div className="text-5xl mb-3">📦</div>
                        <p className="text-gray-500 font-medium">No materials yet</p>
                        {categories.length === 0 && <p className="text-xs text-orange-500 mt-1">⚠️ Create a category first</p>}
                        <button onClick={openAddMat} className="mt-3 text-blue-600 text-sm hover:underline">Add your first material</button>
                      </td></tr>
                    ) : filtered.map(m => {
                      const cat = categories.find(c => c.id === m.categoryId)
                      return (
                        <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-4">
                            <p className="font-medium text-gray-900 text-sm">{m.name}</p>
                            {m.description && <p className="text-xs text-gray-400 mt-0.5">{m.description}</p>}
                          </td>
                          <td className="px-5 py-4 hidden md:table-cell">
                            <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-full font-medium">
                              {cat?.icon} {m.category?.name || '—'}
                            </span>
                          </td>
                          <td className="px-5 py-4 hidden md:table-cell">
                            {m.images && m.images[0]
                              ? <img src={m.images[0]} alt={m.name} className="h-10 w-10 rounded-lg object-cover border border-gray-200" />
                              : <span className="text-xs text-gray-300">No image</span>
                            }
                          </td>
                          <td className="px-5 py-4 text-right">
                            <span className="text-lg font-bold text-amber-600">{m.price}</span>
                            <span className="text-xs text-gray-400 ml-1">G</span>
                          </td>
                          <td className="px-5 py-4 text-right text-sm text-gray-600 hidden md:table-cell">{m.inventory}</td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => openEditMat(m)}
                                className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50">
                                <Pencil className="h-3 w-3" /> Edit
                              </button>
                              <button onClick={() => handleDeleteMat(m.id)} disabled={deletingMatId===m.id}
                                className="flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs hover:bg-red-50 disabled:opacity-40">
                                <Trash2 className="h-3 w-3" /> {deletingMatId===m.id?'...':'Delete'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* ── CATEGORY MODAL ── */}
      {showCatForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6 border-0 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">{editingCat ? 'Edit Category' : 'Add Category'}</h2>
              <button onClick={() => setShowCatForm(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name *</label>
                <input type="text" placeholder="e.g. Basic Supplies" value={catForm.name}
                  onChange={e => setCatForm(f => ({...f, name: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Icon (pick one)</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map(e => (
                    <button key={e} onClick={() => setCatForm(f => ({...f, icon: e}))}
                      className={`text-2xl p-2 rounded-lg border-2 transition-all ${catForm.icon===e ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL (optional)</label>
                <input type="text" placeholder="https://... paste image link" value={catForm.imageUrl}
                  onChange={e => setCatForm(f => ({...f, imageUrl: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                {catForm.imageUrl && (
                  <div className="mt-2 h-24 rounded-lg overflow-hidden bg-gray-100">
                    <img src={catForm.imageUrl} alt="preview" className="w-full h-full object-cover"
                      onError={(e:any) => e.target.style.display='none'} />
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">Kids will see this image when picking material categories</p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-purple-50 rounded-xl flex items-center gap-3">
              <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center text-3xl shadow-sm">{catForm.icon}</div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{catForm.name || 'Category Name'}</p>
                <p className="text-xs text-gray-400">Preview for kids</p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleSaveCat} disabled={savingCat}
                className="flex-1 py-2.5 bg-purple-600 text-white rounded-lg font-medium text-sm hover:bg-purple-700 disabled:opacity-50">
                {savingCat ? 'Saving...' : editingCat ? 'Update' : 'Create Category'}
              </button>
              <button onClick={() => setShowCatForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </Card>
        </div>
      )}

      {/* ── MATERIAL MODAL ── */}
      {showMatForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6 border-0 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">{editingMat ? 'Edit Material' : 'Add Material'}</h2>
              <button onClick={() => setShowMatForm(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            {categories.length === 0 && (
              <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700">
                ⚠️ No categories yet.{' '}
                <button onClick={() => { setShowMatForm(false); setTab('categories'); openAddCat() }}
                  className="underline font-medium">Create one first</button>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" placeholder="e.g. Cardboard" value={matForm.name}
                  onChange={e => setMatForm(f => ({...f, name: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" placeholder="e.g. Thick A4 cardboard sheet" value={matForm.description}
                  onChange={e => setMatForm(f => ({...f, description: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Goins Cost *</label>
                  <input type="number" placeholder="10" value={matForm.price}
                    onChange={e => setMatForm(f => ({...f, price: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                  <input type="number" placeholder="100" value={matForm.inventory}
                    onChange={e => setMatForm(f => ({...f, inventory: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select value={matForm.categoryId}
                  onChange={e => {
                    const cat = categories.find(c => c.id === e.target.value)
                    setMatForm(f => ({...f, categoryId: e.target.value, categoryName: cat?.name || ''}))
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                  <option value="">Select category...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>

              {/* Image upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Images (optional)</label>
                <div onClick={() => matFileRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <ImagePlus className="h-8 w-8 text-gray-400 mx-auto mb-1" />
                  <p className="text-sm text-gray-500">Click to upload images from your computer</p>
                  <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, WEBP — kids will see these</p>
                </div>
                <input ref={matFileRef} type="file" multiple accept="image/*" onChange={handleMatImages} className="hidden" />

                {matImagePreviews.length > 0 && (
                  <div className="mt-3 flex gap-2 flex-wrap items-center">
                    {matImagePreviews.map((src, i) => (
                      <img key={i} src={src} alt="" className="h-16 w-16 object-cover rounded-lg border border-gray-200" />
                    ))}
                    <button onClick={clearImages}
                      className="h-16 px-3 flex items-center justify-center border border-red-200 rounded-lg text-red-400 hover:bg-red-50 text-xs">
                      Clear all
                    </button>
                  </div>
                )}

                {editingMat && editingMat.images && editingMat.images.length > 0 && matImagePreviews.length === 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-400 mb-1">Current images (upload above to replace):</p>
                    <div className="flex gap-2">
                      {editingMat.images.map((src, i) => (
                        <img key={i} src={src} alt="" className="h-16 w-16 object-cover rounded-lg border border-gray-200" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleSaveMat} disabled={savingMat || categories.length===0}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50">
                {savingMat ? 'Saving...' : editingMat ? 'Update Material' : 'Add Material'}
              </button>
              <button onClick={() => setShowMatForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </Card>
        </div>
      )}
    </AdminLayout>
  )
}