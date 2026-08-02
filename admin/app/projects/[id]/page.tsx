'use client'

// Was a 100% read-only view. Admin had no way to fix a wrong title, swap a
// bad video, or manage collaborators on a project (e.g. a group upload that
// silently skipped a student without an independent login — see the
// "Create Login" fix on the school roster page, which is the real root-cause
// fix; this edit page is the escape hatch for fixing whatever already
// happened before that was in place).
// Also switched off @/utils/api/projectApi (tainted with "use server", which
// routes every call through an extra Vercel server hop) to a direct fetch,
// matching the fix already applied to the People page.

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import {
  ArrowLeft, Save, Loader2, X, Plus, UploadCloud, Trash2, Video as VideoIcon,
} from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

interface Collaborator { userId: string; name: string }
interface MaterialLine { productId: string; name: string | null; quantity: number }
interface ProjectData {
  id: string
  title: string
  description: string
  status: string
  thumbnail: string
  video: { url: string; uploadedAt?: string }
  materials: MaterialLine[]
  collaborators: Collaborator[]
  category: { name: string } | null
  user: { name: string; email?: string }
  userId: string
}
interface CategoryOption { id: string; name: string }
interface MaterialOption { id: string; name: string }

async function authToken() {
  const v = `; ${document.cookie}`
  const p = v.split('; auth_token=')
  return p.length === 2 ? p.pop()!.split(';').shift()! : ''
}

async function authedFetch(path: string, opts: RequestInit = {}) {
  const token = await authToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || data.error || 'Request failed')
  return data
}

function extractYoutubeId(url: string | undefined): string | null {
  if (!url) return null
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/)
  return match ? match[1] : null
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id?.toString() || ''

  const [project, setProject] = useState<ProjectData | null>(null)
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [materialCatalog, setMaterialCatalog] = useState<MaterialOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // Edit form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [materials, setMaterials] = useState<MaterialLine[]>([])
  const [collaborators, setCollaborators] = useState<{ userId?: string; name: string }[]>([])
  const [newCollaboratorInput, setNewCollaboratorInput] = useState('')
  const [addMaterialId, setAddMaterialId] = useState('')

  // Video replace state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [pendingVideoStoragePath, setPendingVideoStoragePath] = useState<string | null>(null)
  const [pendingVideoName, setPendingVideoName] = useState<string | null>(null)

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [proj, cats, mats] = await Promise.all([
        authedFetch(`/project/${projectId}`),
        authedFetch(`/project/categories`),
        authedFetch(`/materials`),
      ])
      setProject(proj)
      setTitle(proj.title || '')
      setDescription(proj.description || '')
      setCategoryName(proj.category?.name || '')
      setMaterials(proj.materials || [])
      setCollaborators((proj.collaborators || []).map((c: Collaborator) => ({ userId: c.userId, name: c.name })))
      setCategories(Array.isArray(cats) ? cats : (cats.categories || []))
      const matList = Array.isArray(mats) ? mats : (mats.materials || [])
      setMaterialCatalog(matList.map((m: any) => ({ id: m.id, name: m.name })))
    } catch (e: any) {
      setError(e.message || 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (projectId) load() }, [projectId])

  const addCollaborator = () => {
    const v = newCollaboratorInput.trim()
    if (!v) return
    setCollaborators((prev) => [...prev, { name: v }]) // userId unresolved until save
    setNewCollaboratorInput('')
  }
  const removeCollaborator = (idx: number) => {
    setCollaborators((prev) => prev.filter((_, i) => i !== idx))
  }

  const addMaterial = () => {
    if (!addMaterialId) return
    const found = materialCatalog.find((m) => m.id === addMaterialId)
    if (!found) return
    if (materials.some((m) => m.productId === found.id)) return // already added
    setMaterials((prev) => [...prev, { productId: found.id, name: found.name, quantity: 1 }])
    setAddMaterialId('')
  }
  const removeMaterial = (productId: string) => {
    setMaterials((prev) => prev.filter((m) => m.productId !== productId))
  }
  const setMaterialQty = (productId: string, qty: number) => {
    setMaterials((prev) => prev.map((m) => m.productId === productId ? { ...m, quantity: Math.max(1, qty) } : m))
  }

  const handleVideoFileSelected = async (file: File) => {
    setUploadingVideo(true)
    try {
      const { uploadUrl, storagePath } = await authedFetch(`/project/request-upload-url`, {
        method: 'POST',
        body: JSON.stringify({ filename: file.name, contentType: file.type || 'video/mp4', kind: 'video' }),
      })
      // Signed URL carries its own auth — plain fetch, not authedFetch, and
      // no Authorization header (would conflict with the signed URL's own).
      const putRes = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'video/mp4' } })
      if (!putRes.ok) throw new Error('Upload to storage failed')
      setPendingVideoStoragePath(storagePath)
      setPendingVideoName(file.name)
      showToast('New video uploaded — click Save to apply it', true)
    } catch (e: any) {
      showToast(e.message || 'Video upload failed', false)
    } finally {
      setUploadingVideo(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body: any = {
        title,
        description,
        categoryName: categoryName || undefined,
        materials: materials.map((m) => ({ productId: m.productId, quantity: m.quantity })),
        collaboratorIds: collaborators.map((c) => c.userId || c.name),
      }
      if (pendingVideoStoragePath) body.videoStoragePath = pendingVideoStoragePath
      await authedFetch(`/admin/project/${projectId}`, { method: 'PUT', body: JSON.stringify(body) })
      showToast('Saved', true)
      setPendingVideoStoragePath(null)
      setPendingVideoName(null)
      load()
    } catch (e: any) {
      showToast(e.message || 'Save failed', false)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      </AdminLayout>
    )
  }

  if (error || !project) {
    return (
      <AdminLayout>
        <Card className="p-8 text-center text-red-500">{error || 'Project not found'}</Card>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-3xl">
        {toast && (
          <div className={`px-4 py-2 rounded-lg text-sm ${toast.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {toast.msg}
          </div>
        )}

        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Project</h1>
            <p className="text-sm text-gray-500 mt-1">
              By {project.user?.name || 'Unknown'} · status: {project.status}
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
          </button>
        </div>

        <Card className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Category</label>
            <select value={categoryName} onChange={(e) => setCategoryName(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">— Unchanged —</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Materials</h3>
          <div className="space-y-1.5">
            {materials.length === 0 && <p className="text-xs text-gray-400">No materials.</p>}
            {materials.map((m) => (
              <div key={m.productId} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{m.name || m.productId}</span>
                <input type="number" min={1} value={m.quantity}
                  onChange={(e) => setMaterialQty(m.productId, parseInt(e.target.value) || 1)}
                  className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs" />
                <button onClick={() => removeMaterial(m.productId)} className="p-1 text-red-400 hover:text-red-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <select value={addMaterialId} onChange={(e) => setAddMaterialId(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Add a material…</option>
              {materialCatalog
                .filter((m) => !materials.some((existing) => existing.productId === m.id))
                .map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <button onClick={addMaterial} className="px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Collaborators</h3>
          <p className="text-xs text-gray-400">
            Goins from approval are split equally across the owner and everyone listed here.
            New entries are matched by MiniGuru login email or account id when you save.
          </p>
          <div className="space-y-1.5">
            {collaborators.length === 0 && <p className="text-xs text-gray-400">No collaborators.</p>}
            {collaborators.map((c, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{c.name}{!c.userId ? ' (unresolved — will match on save)' : ''}</span>
                <button onClick={() => removeCollaborator(idx)} className="p-1 text-red-400 hover:text-red-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <input
              value={newCollaboratorInput}
              onChange={(e) => setNewCollaboratorInput(e.target.value)}
              placeholder="MiniGuru login email or account id"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <button onClick={addCollaborator} className="px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <VideoIcon className="h-4 w-4" /> Video
          </h3>
          {/* BUGFIX: a plain <video> tag can never play a youtube.com URL —
              it needs a real video FILE, not a webpage. Embed via iframe
              instead, same as everywhere else in the app that plays YouTube
              content. */}
          {(() => {
            const ytId = pendingVideoStoragePath ? null : extractYoutubeId(project.video?.url)
            return ytId ? (
              <iframe
                className="w-full max-w-md aspect-video rounded-lg"
                src={`https://www.youtube.com/embed/${ytId}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <p className="text-xs text-gray-400">No video, or a new one is staged (save to apply).</p>
            )
          })()}
          <p className="text-xs text-gray-500">
            Replacing the video uploads a new one to YouTube, matches the project's current public/
            unlisted state, and deletes the old YouTube video. This does not re-trigger AI review or
            change the approval status — it's a direct correction, not a new submission.
          </p>
          <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVideoFileSelected(f) }} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingVideo}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {uploadingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {pendingVideoName ? `Replace with: ${pendingVideoName}` : 'Replace video…'}
          </button>
          {pendingVideoStoragePath && (
            <p className="text-xs text-amber-600">
              New video staged — click <b>Save Changes</b> above to actually replace it on YouTube.
            </p>
          )}
        </Card>

        {/* Status — a project that's been rejected (or is stuck in any
            status other than pending/published) previously had NO admin
            view anywhere that surfaced it — it just vanished from both the
            pending queue and the public feed. This card makes the current
            status visible and lets admin move it directly, without going
            through the separate Content Moderation approve/reject flow. */}
        <Card className="p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Status</h3>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              project.status === 'published' ? 'bg-green-100 text-green-700'
              : project.status === 'pending' ? 'bg-amber-100 text-amber-700'
              : project.status === 'rejected' ? 'bg-red-100 text-red-700'
              : 'bg-gray-100 text-gray-600'
            }`}>{project.status}</span>
            {project.status === 'rejected' && (
              <span className="text-xs text-gray-400">
                Rejected projects don't appear in the pending queue or the home feed — this is the only place to find and fix one.
              </span>
            )}
          </div>
          {project.status !== 'published' && (
            <button
              onClick={async () => {
                try {
                  await authedFetch(`/admin/projects/${projectId}/approve`, { method: 'POST' })
                  showToast('Approved and published to YouTube', true)
                  load()
                } catch (e: any) {
                  showToast(e.message || 'Approve failed', false)
                }
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700"
            >
              {project.status === 'rejected' ? 'Re-approve & Publish' : 'Approve & Publish'}
            </button>
          )}
        </Card>
      </div>
    </AdminLayout>
  )
}
