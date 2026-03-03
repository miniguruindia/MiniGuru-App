'use client'

import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Pencil, Save, X, Tag, RefreshCw } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

interface Category {
  id: string
  name: string
  icon?: string
  projectCount?: number
}

// ── API helpers ───────────────────────────────────────────────
async function fetchCategories(): Promise<Category[]> {
  const token = localStorage.getItem('adminToken') || ''
  const res = await fetch(`${API_BASE}/project/categories`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch categories')
  const data = await res.json()
  // Handle both array and {categories: [...]} response shapes
  return Array.isArray(data) ? data : data.categories ?? []
}

async function createCategory(name: string): Promise<Category> {
  const token = localStorage.getItem('adminToken') || ''
  const res = await fetch(`${API_BASE}/project/categories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error('Failed to create category')
  return res.json()
}

async function updateCategory(id: string, name: string): Promise<void> {
  const token = localStorage.getItem('adminToken') || ''
  const res = await fetch(`${API_BASE}/project/categories/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error('Failed to update category')
}

async function deleteCategory(id: string): Promise<void> {
  const token = localStorage.getItem('adminToken') || ''
  const res = await fetch(`${API_BASE}/project/categories/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to delete category')
}

// ─────────────────────────────────────────────────────────────
export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  // New category form
  const [newName, setNewName]   = useState('')
  const [adding, setAdding]     = useState(false)

  // Inline edit
  const [editId, setEditId]     = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchCategories()
      setCategories(data)
    } catch (e) {
      // Show defaults if backend not ready yet
      setCategories([
        { id: 'local-1', name: 'Robotics' },
        { id: 'local-2', name: 'Mechanics' },
        { id: 'local-3', name: 'ArtCraft' },
        { id: 'local-4', name: 'Science' },
      ])
      setError('Could not connect to backend — showing local defaults. Backend endpoint: POST /project/categories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const flash = (msg: string, isError = false) => {
    if (isError) setError(msg)
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  }

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const created = await createCategory(newName.trim())
      setCategories(prev => [...prev, created])
      setNewName('')
      setAdding(false)
      flash(`✅ "${newName.trim()}" added`)
    } catch {
      flash('❌ Failed to add category — check backend connection', true)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return
    setSaving(true)
    try {
      await updateCategory(id, editName.trim())
      setCategories(prev =>
        prev.map(c => c.id === id ? { ...c, name: editName.trim() } : c)
      )
      setEditId(null)
      flash(`✅ Category updated`)
    } catch {
      flash('❌ Failed to update — check backend connection', true)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"? Projects in this category will need reassignment.`)) return
    try {
      await deleteCategory(id)
      setCategories(prev => prev.filter(c => c.id !== id))
      flash(`✅ "${name}" deleted`)
    } catch {
      flash('❌ Failed to delete — check backend connection', true)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Project Categories</h1>
            <p className="text-sm text-gray-500 mt-1">
              These categories appear in the Flutter app when kids register a project
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={load}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Plus className="h-4 w-4" /> Add Category
            </button>
          </div>
        </div>

        {/* Status messages */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            {success}
          </div>
        )}

        {/* Backend status hint */}
        <Card className="p-4 border-0 shadow-sm bg-amber-50 border-amber-200">
          <p className="text-sm text-amber-800">
            <strong>Backend endpoints needed:</strong>{' '}
            <code className="bg-amber-100 px-1 rounded">GET /project/categories</code>{' '}
            <code className="bg-amber-100 px-1 rounded">POST /project/categories</code>{' '}
            <code className="bg-amber-100 px-1 rounded">PUT /project/categories/:id</code>{' '}
            <code className="bg-amber-100 px-1 rounded">DELETE /project/categories/:id</code>
          </p>
        </Card>

        {/* Add form */}
        {adding && (
          <Card className="p-5 border-0 shadow-md">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">New Category</h3>
            <div className="flex gap-3">
              <input
                autoFocus
                type="text"
                placeholder="e.g. Robotics"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAdd}
                disabled={saving || !newName.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => { setAdding(false); setNewName('') }}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
            </div>
          </Card>
        )}

        {/* Categories list */}
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">
              {categories.length} Categories
            </h3>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Tag className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p>No categories yet</p>
              <button
                onClick={() => setAdding(true)}
                className="mt-3 text-blue-600 text-sm hover:underline"
              >
                Add your first category
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {categories.map((cat, i) => (
                <li key={cat.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50">
                  {/* Index badge */}
                  <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>

                  {/* Name / edit input */}
                  {editId === cat.id ? (
                    <input
                      autoFocus
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleUpdate(cat.id)}
                      className="flex-1 px-3 py-1.5 border border-blue-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <span className="flex-1 font-medium text-gray-800">{cat.name}</span>
                  )}

                  {/* Project count */}
                  {cat.projectCount !== undefined && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                      {cat.projectCount} projects
                    </span>
                  )}

                  {/* Actions */}
                  {editId === cat.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(cat.id)}
                        disabled={saving}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                      >
                        <Save className="h-3 w-3" /> Save
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-gray-50"
                      >
                        <X className="h-3 w-3" /> Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditId(cat.id); setEditName(cat.name) }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id, cat.name)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AdminLayout>
  )
}