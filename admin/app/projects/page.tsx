'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AdminLayout } from '@/components/AdminLayout'
import { ProjectList } from '@/components/project/ProjectList'
import { SkeletonCard } from '@/components/SkeletonCard'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import { Project } from '@/types/project'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Plus, Trash2, Pencil, Save, X, Tag, RefreshCw } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

async function authHeader() {
  const v = `; ${document.cookie}`
  const p = v.split('; auth_token=')
  const token = p.length === 2 ? p.pop()!.split(';').shift()! : ''
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

// ═══════════════════════════════════════════════════════════════════════
// PROJECTS TAB — unchanged logic from the old standalone projects/page.tsx
// ═══════════════════════════════════════════════════════════════════════

function ProjectsTab() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState<number>(1)
  const [totalPages, setTotalPages] = useState<number>(1)

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`${API_BASE}/project/all?page=${page}`, { headers: await authHeader() })
        if (!res.ok) throw new Error(`Failed to load projects (${res.status})`)
        const data = await res.json()
        setProjects(data.projects)
        setTotalPages(data.pagination?.totalPages || 1)
      } catch (error: any) {
        setError(error.message || 'An error occurred while fetching projects.')
      } finally {
        setLoading(false)
      }
    }
    fetchProjects()
  }, [page])

  const handleDeleteProject = async (projectId: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/project/${projectId}`, { method: 'DELETE', headers: await authHeader() })
      if (!res.ok) throw new Error(`Delete failed (${res.status})`)
    } catch (error: any) {
      setError('An error occurred while deleting the project.' + error.message)
      return
    }
    setProjects(projects.filter(project => project.id !== projectId))
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (error) return <ErrorDisplay message={error} />

  return (
    <>
      <ProjectList projects={projects} onDeleteProject={handleDeleteProject} />
      <div className="flex justify-between mt-6">
        <Button onClick={() => setPage(page - 1)} disabled={page === 1}>
          Previous
        </Button>
        <span className="text-lg font-medium">Page {page} of {totalPages}</span>
        <Button onClick={() => setPage(page + 1)} disabled={page === totalPages}>
          Next
        </Button>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// CATEGORIES TAB — unchanged logic from the old standalone categories/page.tsx
// ═══════════════════════════════════════════════════════════════════════

interface Category {
  id: string
  name: string
  icon?: string
  projectCount?: number
}

async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_BASE}/project/categories`, { headers: await authHeader() })
  if (!res.ok) throw new Error('Failed to fetch categories')
  const data = await res.json()
  return Array.isArray(data) ? data : data.categories ?? []
}

async function createCategory(name: string, icon: string): Promise<Category> {
  const res = await fetch(`${API_BASE}/project/categories`, {
    method: 'POST',
    headers: await authHeader(),
    body: JSON.stringify({ name, icon }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || body.message || `Failed to create category (${res.status})`)
  }
  return res.json()
}

async function updateCategory(id: string, name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/project/categories/${id}`, {
    method: 'PUT',
    headers: await authHeader(),
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error('Failed to update category')
}

async function deleteCategory(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/project/categories/${id}`, {
    method: 'DELETE',
    headers: await authHeader(),
  })
  if (!res.ok) throw new Error('Failed to delete category')
}

function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('📦')
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchCategories()
      setCategories(data)
    } catch (e) {
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
      const created = await createCategory(newName.trim(), newIcon.trim() || '📦')
      setCategories(prev => [...prev, created])
      setNewName('')
      setNewIcon('📦')
      setAdding(false)
      flash(`✅ "${newName.trim()}" added`)
    } catch (e: any) {
      flash(`❌ ${e.message || 'Failed to add category'}`, true)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return
    setSaving(true)
    try {
      await updateCategory(id, editName.trim())
      setCategories(prev => prev.map(c => c.id === id ? { ...c, name: editName.trim() } : c))
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          These categories appear in the Flutter app when kids register a project
        </p>
        <div className="flex gap-3">
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button onClick={() => setAdding(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            <Plus className="h-4 w-4" /> Add Category
          </button>
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      {success && <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>}

      {adding && (
        <Card className="p-5 border-0 shadow-md">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">New Category</h3>
          <div className="flex gap-3">
            <input type="text" placeholder="📦" value={newIcon} onChange={e => setNewIcon(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()} maxLength={4} title="An emoji to represent this category"
              className="w-16 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input autoFocus type="text" placeholder="e.g. Robotics" value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={handleAdd} disabled={saving || !newName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50">
              <Save className="h-4 w-4" />{saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => { setAdding(false); setNewName('') }} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
              <X className="h-4 w-4" /> Cancel
            </button>
          </div>
        </Card>
      )}

      <Card className="border-0 shadow-md overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{categories.length} Categories</h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Tag className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>No categories yet</p>
            <button onClick={() => setAdding(true)} className="mt-3 text-blue-600 text-sm hover:underline">Add your first category</button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {categories.map((cat, i) => (
              <li key={cat.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50">
                <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                {editId === cat.id ? (
                  <input autoFocus type="text" value={editName} onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleUpdate(cat.id)}
                    className="flex-1 px-3 py-1.5 border border-blue-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                ) : (
                  <span className="flex-1 font-medium text-gray-800">{cat.name}</span>
                )}
                {cat.projectCount !== undefined && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{cat.projectCount} projects</span>
                )}
                {editId === cat.id ? (
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdate(cat.id)} disabled={saving}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                      <Save className="h-3 w-3" /> Save
                    </button>
                    <button onClick={() => setEditId(null)} className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-gray-50">
                      <X className="h-3 w-3" /> Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => { setEditId(cat.id); setEditName(cat.name) }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(cat.id, cat.name)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
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
  )
}

// ═══════════════════════════════════════════════════════════════════════
// COMBINED PAGE
// ═══════════════════════════════════════════════════════════════════════

function ProjectsPageInner() {
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') === 'categories' ? 'categories' : 'projects') as 'projects' | 'categories'
  const [tab, setTab] = useState<'projects' | 'categories'>(initialTab)

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {[
            { key: 'projects', label: '🎬 All Projects' },
            { key: 'categories', label: '🏷️ Categories' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.key ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'projects' && <ProjectsTab />}
        {tab === 'categories' && <CategoriesTab />}
      </div>
    </AdminLayout>
  )
}

// Next.js 15 requires any component that calls useSearchParams() to be
// wrapped in a Suspense boundary, or `next build` fails outright.
export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsPageInner />
    </Suspense>
  )
}
