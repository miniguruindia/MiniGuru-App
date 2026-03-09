'use client'

// admin/app/content/page.tsx
import React, { useEffect, useState, useCallback } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import {
  Save, RefreshCw, CheckCircle, AlertCircle, Globe, Users,
  BookOpen, Shield, FileText, Baby, ChevronDown, ChevronUp,
  Plus, Trash2, Edit3
} from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

async function authHeader() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') || '' : ''
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function fetchContent(key: string) {
  const res = await fetch(`${API_BASE}/cms/${key}`, { headers: await authHeader() })
  if (!res.ok) throw new Error(`${res.status}`)
  return (await res.json()).value
}

async function saveContent(key: string, value: any) {
  const res = await fetch(`${API_BASE}/admin/cms/${key}`, {
    method: 'PUT',
    headers: await authHeader(),
    body: JSON.stringify({ value }),
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

type Tab = 'community' | 'about' | 'consultancy' | 'legal'

const TABS: { id: Tab; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'community',   label: 'Community',   icon: <Globe className="h-4 w-4" />,    color: 'blue'   },
  { id: 'about',       label: 'About',       icon: <Users className="h-4 w-4" />,    color: 'purple' },
  { id: 'consultancy', label: 'Consultancy', icon: <BookOpen className="h-4 w-4" />, color: 'green'  },
  { id: 'legal',       label: 'Legal',       icon: <Shield className="h-4 w-4" />,   color: 'red'    },
]

const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
const ta  = `${inp} resize-none`

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-100 text-left">
        <span className="font-semibold text-gray-800 text-sm">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="p-5 space-y-4">{children}</div>}
    </Card>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      {children}
    </div>
  )
}

// ── COMMUNITY ─────────────────────────────────────────────────────────────────
function CommunityEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const updateItem = (arrKey: string, id: string, field: string, val: string) =>
    onChange({ ...data, [arrKey]: data[arrKey].map((x: any) => x.id === id ? { ...x, [field]: val } : x) })
  const removeItem = (arrKey: string, id: string) =>
    onChange({ ...data, [arrKey]: data[arrKey].filter((x: any) => x.id !== id) })
  const addItem = (arrKey: string, template: any) =>
    onChange({ ...data, [arrKey]: [...(data[arrKey] || []), { ...template, id: Date.now().toString() }] })

  return (
    <div className="space-y-4">
      <SectionCard title="📣 T-LAB Happenings">
        {(data.happenings || []).map((h: any, i: number) => (
          <div key={h.id} className="border border-gray-100 rounded-lg p-4 space-y-3 bg-gray-50">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-500 uppercase">Happening {i + 1}</span>
              <button onClick={() => removeItem('happenings', h.id)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Title"><input className={inp} value={h.title || ''} onChange={e => updateItem('happenings', h.id, 'title', e.target.value)} /></Field>
              <Field label="Date (YYYY-MM-DD)"><input className={inp} value={h.date || ''} onChange={e => updateItem('happenings', h.id, 'date', e.target.value)} /></Field>
            </div>
            <Field label="Description"><textarea className={ta} rows={2} value={h.description || ''} onChange={e => updateItem('happenings', h.id, 'description', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tag (NEW / UPCOMING / PAST)"><input className={inp} value={h.tag || ''} onChange={e => updateItem('happenings', h.id, 'tag', e.target.value)} /></Field>
              <Field label="Image URL (optional)"><input className={inp} value={h.imageUrl || ''} onChange={e => updateItem('happenings', h.id, 'imageUrl', e.target.value)} /></Field>
            </div>
          </div>
        ))}
        <button onClick={() => addItem('happenings', { title: '', date: '', description: '', tag: 'NEW', imageUrl: '' })}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
          <Plus className="h-4 w-4" /> Add Happening
        </button>
      </SectionCard>

      <SectionCard title="🏆 Challenges">
        {(data.challenges || []).map((c: any, i: number) => (
          <div key={c.id} className="border border-gray-100 rounded-lg p-4 space-y-3 bg-gray-50">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-500 uppercase">Challenge {i + 1}</span>
              <button onClick={() => removeItem('challenges', c.id)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Title"><input className={inp} value={c.title || ''} onChange={e => updateItem('challenges', c.id, 'title', e.target.value)} /></Field>
              <Field label="Category"><input className={inp} value={c.category || ''} onChange={e => updateItem('challenges', c.id, 'category', e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Difficulty">
                <select className={inp} value={c.difficulty || 'Medium'} onChange={e => updateItem('challenges', c.id, 'difficulty', e.target.value)}>
                  <option>Easy</option><option>Medium</option><option>Hard</option>
                </select>
              </Field>
              <Field label="Goins Reward"><input type="number" className={inp} value={c.goinsReward || 0} onChange={e => updateItem('challenges', c.id, 'goinsReward', e.target.value)} /></Field>
              <Field label="Status">
                <select className={inp} value={c.status || 'upcoming'} onChange={e => updateItem('challenges', c.id, 'status', e.target.value)}>
                  <option value="ongoing">Ongoing</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="past">Past</option>
                </select>
              </Field>
            </div>
            <Field label="End Date"><input className={inp} value={c.endDate || ''} onChange={e => updateItem('challenges', c.id, 'endDate', e.target.value)} /></Field>
            <Field label="Description"><textarea className={ta} rows={2} value={c.description || ''} onChange={e => updateItem('challenges', c.id, 'description', e.target.value)} /></Field>
          </div>
        ))}
        <button onClick={() => addItem('challenges', { title: '', category: '', difficulty: 'Medium', goinsReward: 100, endDate: '', status: 'upcoming', description: '' })}
          className="flex items-center gap-2 text-sm text-blue-600 font-medium"><Plus className="h-4 w-4" /> Add Challenge</button>
      </SectionCard>

      <SectionCard title="📚 Resources">
        {(data.resources || []).map((r: any, i: number) => (
          <div key={r.id} className="border border-gray-100 rounded-lg p-4 space-y-3 bg-gray-50">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-500 uppercase">Resource {i + 1}</span>
              <button onClick={() => removeItem('resources', r.id)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Title"><input className={inp} value={r.title || ''} onChange={e => updateItem('resources', r.id, 'title', e.target.value)} /></Field>
              <Field label="Type (PDF/DOC/VIDEO)"><input className={inp} value={r.type || ''} onChange={e => updateItem('resources', r.id, 'type', e.target.value)} /></Field>
              <Field label="Tag"><input className={inp} value={r.tag || ''} onChange={e => updateItem('resources', r.id, 'tag', e.target.value)} /></Field>
            </div>
            <Field label="Download URL"><input className={inp} value={r.url || ''} onChange={e => updateItem('resources', r.id, 'url', e.target.value)} /></Field>
            <Field label="Description"><textarea className={ta} rows={2} value={r.description || ''} onChange={e => updateItem('resources', r.id, 'description', e.target.value)} /></Field>
          </div>
        ))}
        <button onClick={() => addItem('resources', { title: '', type: 'PDF', tag: '', url: '', description: '' })}
          className="flex items-center gap-2 text-sm text-blue-600 font-medium"><Plus className="h-4 w-4" /> Add Resource</button>
      </SectionCard>

      <SectionCard title="🪜 Progression Ladder">
        {(data.ladder?.levels || []).map((l: any, i: number) => (
          <div key={i} className="grid grid-cols-4 gap-3 border border-gray-100 rounded-lg p-3 bg-gray-50">
            {['name','emoji','perks'].map(field => (
              <Field key={field} label={field.charAt(0).toUpperCase()+field.slice(1)}>
                <input className={inp} value={l[field] || ''} onChange={e => {
                  const levels = [...data.ladder.levels]; levels[i] = { ...l, [field]: e.target.value }
                  onChange({ ...data, ladder: { ...data.ladder, levels } })
                }} />
              </Field>
            ))}
            <Field label="Min Score">
              <input type="number" className={inp} value={l.minScore || 0} onChange={e => {
                const levels = [...data.ladder.levels]; levels[i] = { ...l, minScore: parseInt(e.target.value) }
                onChange({ ...data, ladder: { ...data.ladder, levels } })
              }} />
            </Field>
          </div>
        ))}
      </SectionCard>
    </div>
  )
}

// ── ABOUT ─────────────────────────────────────────────────────────────────────
function AboutEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const set = (k: string, v: string) => onChange({ ...data, [k]: v })
  return (
    <div className="space-y-4">
      <SectionCard title="🎯 Mission & Vision">
        <Field label="Mission"><textarea className={ta} rows={3} value={data.mission || ''} onChange={e => set('mission', e.target.value)} /></Field>
        <Field label="Vision"><textarea className={ta} rows={3} value={data.vision || ''} onChange={e => set('vision', e.target.value)} /></Field>
        <Field label="Our Story"><textarea className={ta} rows={5} value={data.story || ''} onChange={e => set('story', e.target.value)} /></Field>
      </SectionCard>
      <SectionCard title="💎 Values">
        {(data.values || []).map((v: any, i: number) => (
          <div key={i} className="grid grid-cols-2 gap-3 border border-gray-100 rounded-lg p-3 bg-gray-50">
            <Field label="Title"><input className={inp} value={v.title || ''} onChange={e => {
              const vals = [...data.values]; vals[i] = { ...v, title: e.target.value }; onChange({ ...data, values: vals })
            }} /></Field>
            <Field label="Description"><input className={inp} value={v.description || ''} onChange={e => {
              const vals = [...data.values]; vals[i] = { ...v, description: e.target.value }; onChange({ ...data, values: vals })
            }} /></Field>
          </div>
        ))}
        <button onClick={() => onChange({ ...data, values: [...(data.values || []), { title: '', description: '' }] })}
          className="flex items-center gap-2 text-sm text-blue-600 font-medium"><Plus className="h-4 w-4" /> Add Value</button>
      </SectionCard>
      <SectionCard title="📞 Contact">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Email"><input className={inp} value={data.contactEmail || ''} onChange={e => set('contactEmail', e.target.value)} /></Field>
          <Field label="Phone"><input className={inp} value={data.contactPhone || ''} onChange={e => set('contactPhone', e.target.value)} /></Field>
          <Field label="Address"><input className={inp} value={data.address || ''} onChange={e => set('address', e.target.value)} /></Field>
        </div>
      </SectionCard>
    </div>
  )
}

// ── CONSULTANCY ───────────────────────────────────────────────────────────────
function ConsultancyEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const set = (k: string, v: string) => onChange({ ...data, [k]: v })
  return (
    <div className="space-y-4">
      <SectionCard title="🏫 Hero">
        <Field label="Tagline"><input className={inp} value={data.tagline || ''} onChange={e => set('tagline', e.target.value)} /></Field>
        <Field label="Description"><textarea className={ta} rows={3} value={data.description || ''} onChange={e => set('description', e.target.value)} /></Field>
        <Field label="Form Note"><input className={inp} value={data.formNote || ''} onChange={e => set('formNote', e.target.value)} /></Field>
      </SectionCard>
      <SectionCard title="🛠️ Services">
        {(data.services || []).map((s: any, i: number) => (
          <div key={i} className="border border-gray-100 rounded-lg p-4 space-y-3 bg-gray-50">
            <div className="flex justify-between">
              <span className="text-xs font-semibold text-gray-500">Service {i + 1}</span>
              <button onClick={() => onChange({ ...data, services: data.services.filter((_: any, j: number) => j !== i) })}
                className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Icon (emoji)"><input className={inp} value={s.icon || ''} onChange={e => {
                const svcs = [...data.services]; svcs[i] = { ...s, icon: e.target.value }; onChange({ ...data, services: svcs })
              }} /></Field>
              <Field label="Title"><input className={inp} value={s.title || ''} onChange={e => {
                const svcs = [...data.services]; svcs[i] = { ...s, title: e.target.value }; onChange({ ...data, services: svcs })
              }} /></Field>
            </div>
            <Field label="Description"><textarea className={ta} rows={2} value={s.description || ''} onChange={e => {
              const svcs = [...data.services]; svcs[i] = { ...s, description: e.target.value }; onChange({ ...data, services: svcs })
            }} /></Field>
          </div>
        ))}
        <button onClick={() => onChange({ ...data, services: [...(data.services || []), { icon: '🔧', title: '', description: '' }] })}
          className="flex items-center gap-2 text-sm text-blue-600 font-medium"><Plus className="h-4 w-4" /> Add Service</button>
      </SectionCard>
      <SectionCard title="❓ FAQs">
        {(data.faqs || []).map((f: any, i: number) => (
          <div key={i} className="border border-gray-100 rounded-lg p-4 space-y-2 bg-gray-50">
            <div className="flex justify-between">
              <span className="text-xs font-semibold text-gray-500">FAQ {i + 1}</span>
              <button onClick={() => onChange({ ...data, faqs: data.faqs.filter((_: any, j: number) => j !== i) })}
                className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
            <Field label="Question"><input className={inp} value={f.question || ''} onChange={e => {
              const faqs = [...data.faqs]; faqs[i] = { ...f, question: e.target.value }; onChange({ ...data, faqs })
            }} /></Field>
            <Field label="Answer"><textarea className={ta} rows={2} value={f.answer || ''} onChange={e => {
              const faqs = [...data.faqs]; faqs[i] = { ...f, answer: e.target.value }; onChange({ ...data, faqs })
            }} /></Field>
          </div>
        ))}
        <button onClick={() => onChange({ ...data, faqs: [...(data.faqs || []), { question: '', answer: '' }] })}
          className="flex items-center gap-2 text-sm text-blue-600 font-medium"><Plus className="h-4 w-4" /> Add FAQ</button>
      </SectionCard>
      <SectionCard title="📞 Contact">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email"><input className={inp} value={data.contactEmail || ''} onChange={e => set('contactEmail', e.target.value)} /></Field>
          <Field label="Phone"><input className={inp} value={data.contactPhone || ''} onChange={e => set('contactPhone', e.target.value)} /></Field>
        </div>
      </SectionCard>
    </div>
  )
}

// ── LEGAL ─────────────────────────────────────────────────────────────────────
function LegalEditor({ privacy, terms, childSafety, onChangePrivacy, onChangeTerms, onChangeChildSafety }: {
  privacy: string; terms: string; childSafety: string
  onChangePrivacy: (v: string) => void; onChangeTerms: (v: string) => void; onChangeChildSafety: (v: string) => void
}) {
  const [legalTab, setLegalTab] = useState<'privacy' | 'terms' | 'child'>('privacy')
  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'privacy' as const, label: '🔒 Privacy Policy' },
          { id: 'terms'   as const, label: '📄 Terms & Conditions' },
          { id: 'child'   as const, label: '👶 Child Safety' },
        ].map(t => (
          <button key={t.id} onClick={() => setLegalTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              legalTab === t.id ? 'bg-red-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>{t.label}</button>
        ))}
      </div>
      <Card className="border-0 shadow-sm p-5">
        <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
          <Edit3 className="h-3 w-3" /> Markdown supported — # headings, **bold**, | tables
        </p>
        {legalTab === 'privacy'  && <textarea className={`${ta} font-mono text-xs`} rows={32} value={privacy}     onChange={e => onChangePrivacy(e.target.value)} />}
        {legalTab === 'terms'    && <textarea className={`${ta} font-mono text-xs`} rows={32} value={terms}       onChange={e => onChangeTerms(e.target.value)} />}
        {legalTab === 'child'    && <textarea className={`${ta} font-mono text-xs`} rows={32} value={childSafety} onChange={e => onChangeChildSafety(e.target.value)} />}
      </Card>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function ContentPage() {
  const [activeTab,   setActiveTab]   = useState<Tab>('community')
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState('')
  const [lastSaved,   setLastSaved]   = useState<Record<string, string>>({})
  const [community,   setCommunity]   = useState<any>({})
  const [about,       setAbout]       = useState<any>({})
  const [consultancy, setConsultancy] = useState<any>({})
  const [privacy,     setPrivacy]     = useState('')
  const [terms,       setTerms]       = useState('')
  const [childSafety, setChildSafety] = useState('')

  const flash = (msg: string, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(''), 5000) }
    else         { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  }

  const loadAll = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [c, a, co, p, t, cs] = await Promise.all([
        fetchContent('community'), fetchContent('about'), fetchContent('consultancy'),
        fetchContent('legal_privacy'), fetchContent('legal_terms'), fetchContent('legal_child_safety'),
      ])
      setCommunity(c); setAbout(a); setConsultancy(co)
      setPrivacy(typeof p === 'string' ? p : JSON.stringify(p, null, 2))
      setTerms(typeof t === 'string' ? t : JSON.stringify(t, null, 2))
      setChildSafety(typeof cs === 'string' ? cs : JSON.stringify(cs, null, 2))
    } catch { flash('Could not load from backend — showing defaults', true) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const save = async () => {
    setSaving(true); setError('')
    try {
      if (activeTab === 'community')   await saveContent('community',   community)
      if (activeTab === 'about')       await saveContent('about',       about)
      if (activeTab === 'consultancy') await saveContent('consultancy', consultancy)
      if (activeTab === 'legal') {
        await Promise.all([
          saveContent('legal_privacy',      privacy),
          saveContent('legal_terms',        terms),
          saveContent('legal_child_safety', childSafety),
        ])
      }
      setLastSaved(prev => ({ ...prev, [activeTab]: new Date().toLocaleTimeString('en-IN') }))
      flash(`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} saved ✅`)
    } catch { flash('Save failed — check backend connection', true) }
    finally { setSaving(false) }
  }

  const btnColor: Record<Tab, string> = {
    community: 'bg-blue-600', about: 'bg-purple-600', consultancy: 'bg-green-600', legal: 'bg-red-600'
  }
  const tabActive: Record<Tab, string> = {
    community: 'bg-blue-600 text-white border-transparent',
    about:     'bg-purple-600 text-white border-transparent',
    consultancy:'bg-green-600 text-white border-transparent',
    legal:     'bg-red-600 text-white border-transparent',
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Content Manager</h1>
            <p className="text-sm text-gray-500 mt-1">Edit app content — changes go live immediately</p>
          </div>
          <div className="flex gap-3">
            <button onClick={loadAll} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Reload
            </button>
            <button onClick={save} disabled={saving || loading}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 ${btnColor[activeTab]}`}>
              <Save className="h-4 w-4" />{saving ? 'Saving...' : `Save ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
            </button>
          </div>
        </div>

        {error   && <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><AlertCircle className="h-4 w-4" />{error}</div>}
        {success && <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700"><CheckCircle className="h-4 w-4" />{success}</div>}

        <div className="flex gap-2 flex-wrap">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                activeTab === tab.id ? tabActive[tab.id] : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {tab.icon}{tab.label}
              {lastSaved[tab.id] && <span className={`text-xs ${activeTab === tab.id ? 'text-white/70' : 'text-gray-400'}`}>· {lastSaved[tab.id]}</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : (
          <>
            {activeTab === 'community'   && <CommunityEditor   data={community}   onChange={setCommunity} />}
            {activeTab === 'about'       && <AboutEditor       data={about}       onChange={setAbout} />}
            {activeTab === 'consultancy' && <ConsultancyEditor data={consultancy} onChange={setConsultancy} />}
            {activeTab === 'legal' && <LegalEditor privacy={privacy} terms={terms} childSafety={childSafety}
              onChangePrivacy={setPrivacy} onChangeTerms={setTerms} onChangeChildSafety={setChildSafety} />}
          </>
        )}

        <div className="sticky bottom-4 flex justify-end">
          <button onClick={save} disabled={saving || loading}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white shadow-lg disabled:opacity-50 ${btnColor[activeTab]}`}>
            <Save className="h-4 w-4" />{saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </AdminLayout>
  )
}