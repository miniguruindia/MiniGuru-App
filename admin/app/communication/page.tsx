'use client'

import { useEffect, useState, useCallback } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import {
  Inbox, Send, Radio, Bell, RefreshCw, AlertCircle,
  CheckCircle, Trash2, Mail, MailOpen, Reply, Users,
  Plus, X, ChevronDown, Info, AlertTriangle, Gift, Megaphone
} from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

async function authHeader() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') || '' : ''
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

type Tab = 'inbox' | 'broadcast' | 'direct' | 'announcements'

function Flash({ msg, isError, onClose }: { msg: string; isError?: boolean; onClose: () => void }) {
  return (
    <div className={`flex items-center gap-2 p-4 rounded-lg text-sm border ${isError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
      {isError ? <AlertCircle className="h-4 w-4 flex-shrink-0" /> : <CheckCircle className="h-4 w-4 flex-shrink-0" />}
      <span className="flex-1">{msg}</span>
      <button onClick={onClose}><X className="h-4 w-4 opacity-50 hover:opacity-100" /></button>
    </div>
  )
}

const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
const ta  = `${inp} resize-none`

interface Message {
  id: string; name: string; email: string; subject: string
  message: string; source: string; status: string; createdAt: string
}

function InboxTab() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading,  setLoading]  = useState(true)
  const [flash,    setFlash]    = useState('')
  const [flashErr, setFlashErr] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter,   setFilter]   = useState<'all' | 'unread' | 'read' | 'replied'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/admin/communication/inbox`, { headers: await authHeader() })
      if (!res.ok) throw new Error()
      setMessages(await res.json())
    } catch { setFlashErr('Failed to load inbox') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`${API_BASE}/admin/communication/inbox/${id}`, {
        method: 'PUT', headers: await authHeader(), body: JSON.stringify({ status })
      })
      setMessages(m => m.map(x => x.id === id ? { ...x, status } : x))
      setFlash(`Marked as ${status}`); setTimeout(() => setFlash(''), 3000)
    } catch { setFlashErr('Failed to update') }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this message?')) return
    try {
      await fetch(`${API_BASE}/admin/communication/inbox/${id}`, { method: 'DELETE', headers: await authHeader() })
      setMessages(m => m.filter(x => x.id !== id))
      setFlash('Message deleted'); setTimeout(() => setFlash(''), 3000)
    } catch { setFlashErr('Failed to delete') }
  }

  const filtered = messages.filter(m => filter === 'all' || m.status === filter)
  const unreadCount = messages.filter(m => m.status === 'unread').length
  const statusBadge: Record<string, string> = { unread: 'bg-blue-100 text-blue-700', read: 'bg-gray-100 text-gray-600', replied: 'bg-green-100 text-green-700' }
  const sourceBadge: Record<string, string> = { app: 'bg-purple-100 text-purple-700', website: 'bg-amber-100 text-amber-700', admin: 'bg-gray-100 text-gray-600' }

  return (
    <div className="space-y-4">
      {flash    && <Flash msg={flash}    onClose={() => setFlash('')} />}
      {flashErr && <Flash msg={flashErr} isError onClose={() => setFlashErr('')} />}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2">
          {(['all','unread','read','replied'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filter === f ? 'bg-blue-600 text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {f.charAt(0).toUpperCase()+f.slice(1)}
              {f === 'unread' && unreadCount > 0 && <span className="ml-1 bg-red-500 text-white rounded-full px-1.5">{unreadCount}</span>}
            </button>
          ))}
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>
      <Card className="border-0 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-50">{Array(4).fill(0).map((_, i) => (
            <div key={i} className="flex gap-4 px-6 py-4 animate-pulse">
              <div className="h-10 w-10 bg-gray-100 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2"><div className="h-4 bg-gray-100 rounded w-40" /><div className="h-3 bg-gray-100 rounded w-64" /></div>
            </div>
          ))}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Inbox className="h-10 w-10 mb-3 opacity-30" /><p className="text-sm">No messages</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(msg => (
              <div key={msg.id} className={msg.status === 'unread' ? 'bg-blue-50/30' : ''}>
                <div className="flex items-start gap-4 px-6 py-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => { setExpanded(expanded === msg.id ? null : msg.id); if (msg.status === 'unread') updateStatus(msg.id, 'read') }}>
                  <div className={`p-2 rounded-full flex-shrink-0 ${msg.status === 'unread' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    {msg.status === 'unread' ? <Mail className="h-4 w-4 text-blue-600" /> : <MailOpen className="h-4 w-4 text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800 text-sm">{msg.name}</span>
                      <span className="text-xs text-gray-400">{msg.email}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sourceBadge[msg.source] ?? 'bg-gray-100 text-gray-600'}`}>{msg.source}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[msg.status] ?? 'bg-gray-100 text-gray-600'}`}>{msg.status}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5 font-medium">{msg.subject}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{msg.message}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-400">{new Date(msg.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })}</span>
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expanded === msg.id ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {expanded === msg.id && (
                  <div className="px-6 pb-4 ml-14 space-y-3">
                    <div className="bg-white border border-gray-100 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">{msg.message}</div>
                    <div className="flex gap-2 flex-wrap">
                      <a href={`mailto:${msg.email}?subject=Re: ${msg.subject}`} onClick={() => updateStatus(msg.id, 'replied')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                        <Reply className="h-3.5 w-3.5" /> Reply via Email
                      </a>
                      {msg.status !== 'replied' && (
                        <button onClick={() => updateStatus(msg.id, 'replied')}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-gray-50">
                          <CheckCircle className="h-3.5 w-3.5 text-green-500" /> Mark Replied
                        </button>
                      )}
                      <button onClick={() => remove(msg.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-red-100 text-red-500 rounded-lg text-xs hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function BroadcastTab() {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState('')
  const [sending, setSending] = useState(false)
  const [flash,   setFlash]   = useState('')
  const [flashErr,setFlashErr]= useState('')
  const [result,  setResult]  = useState<{ sent: number; failed: number; total: number } | null>(null)

  const send = async () => {
    if (!subject.trim() || !message.trim()) { setFlashErr('Subject and message are required'); return }
    if (!confirm('Send this email to ALL users? This cannot be undone.')) return
    setSending(true); setFlashErr(''); setResult(null)
    try {
      const res = await fetch(`${API_BASE}/admin/communication/broadcast`, {
        method: 'POST', headers: await authHeader(), body: JSON.stringify({ subject, message, previewText: preview })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setResult(data); setFlash(`Broadcast complete — ${data.sent} sent, ${data.failed} failed`)
      setTimeout(() => setFlash(''), 6000)
      setSubject(''); setMessage(''); setPreview('')
    } catch (e: any) { setFlashErr(e.message || 'Broadcast failed') }
    finally { setSending(false) }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {flash    && <Flash msg={flash}    onClose={() => setFlash('')} />}
      {flashErr && <Flash msg={flashErr} isError onClose={() => setFlashErr('')} />}
      {result && (
        <Card className="border-0 shadow-sm p-5 bg-green-50">
          <div className="flex gap-6 text-center">
            {[['Sent',result.sent,'text-green-700'],['Failed',result.failed,'text-red-600'],['Total',result.total,'text-gray-700']].map(([l,v,c]) => (
              <div key={l as string}><p className={`text-2xl font-bold ${c}`}>{v}</p><p className="text-xs text-gray-500">{l}</p></div>
            ))}
          </div>
        </Card>
      )}
      <Card className="border-0 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <Radio className="h-4 w-4 text-blue-600" />
          <h3 className="font-semibold text-gray-800">Broadcast to All Users</h3>
        </div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
          <input className={inp} placeholder="e.g. Exciting news from MiniGuru! 🚀" value={subject} onChange={e => setSubject(e.target.value)} /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <p className="text-xs text-gray-400 mb-1">Plain text — line breaks are preserved</p>
          <textarea className={ta} rows={10} placeholder="Write your message here..." value={message} onChange={e => setMessage(e.target.value)} /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Footer note <span className="text-gray-400 font-normal">(optional)</span></label>
          <input className={inp} placeholder="e.g. Questions? Reply to this email." value={preview} onChange={e => setPreview(e.target.value)} /></div>
        <button onClick={send} disabled={sending}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
          <Send className="h-4 w-4" />{sending ? 'Sending...' : 'Send to All Users'}
        </button>
        <p className="text-xs text-gray-400">⚠️ This will send an email to every registered user. Double-check before sending.</p>
      </Card>
    </div>
  )
}

interface User { id: string; name: string; email: string }

function DirectTab() {
  const [users,    setUsers]    = useState<User[]>([])
  const [query,    setQuery]    = useState('')
  const [selected, setSelected] = useState<User | null>(null)
  const [subject,  setSubject]  = useState('')
  const [message,  setMessage]  = useState('')
  const [sending,  setSending]  = useState(false)
  const [flash,    setFlash]    = useState('')
  const [flashErr, setFlashErr] = useState('')
  const [showList, setShowList] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/admin/communication/users`, { headers: authHeader() as any })
      .then(r => r.json()).then(setUsers).catch(() => {})
  }, [])

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(query.toLowerCase()) ||
    u.email.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8)

  const send = async () => {
    if (!selected) { setFlashErr('Please select a user'); return }
    if (!subject.trim() || !message.trim()) { setFlashErr('Subject and message are required'); return }
    setSending(true); setFlashErr('')
    try {
      const res = await fetch(`${API_BASE}/admin/communication/send`, {
        method: 'POST', headers: await authHeader(), body: JSON.stringify({ userId: selected.id, subject, message })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setFlash(`Email sent to ${selected.name} (${data.sentTo})`); setTimeout(() => setFlash(''), 5000)
      setSubject(''); setMessage(''); setSelected(null); setQuery('')
    } catch (e: any) { setFlashErr(e.message || 'Failed to send') }
    finally { setSending(false) }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {flash    && <Flash msg={flash}    onClose={() => setFlash('')} />}
      {flashErr && <Flash msg={flashErr} isError onClose={() => setFlashErr('')} />}
      <Card className="border-0 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <Mail className="h-4 w-4 text-purple-600" />
          <h3 className="font-semibold text-gray-800">Direct Message</h3>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
          {selected ? (
            <div className="flex items-center gap-3 px-3 py-2 border border-blue-200 bg-blue-50 rounded-lg">
              <div className="flex-1"><p className="text-sm font-medium text-gray-800">{selected.name}</p><p className="text-xs text-gray-500">{selected.email}</p></div>
              <button onClick={() => { setSelected(null); setQuery('') }}><X className="h-4 w-4 text-gray-400 hover:text-gray-600" /></button>
            </div>
          ) : (
            <div className="relative">
              <input className={inp} placeholder="Search by name or email..." value={query}
                onChange={e => { setQuery(e.target.value); setShowList(true) }} onFocus={() => setShowList(true)} />
              {showList && query && filtered.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {filtered.map(u => (
                    <button key={u.id} onClick={() => { setSelected(u); setQuery(''); setShowList(false) }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-50 last:border-0">
                      <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-semibold text-sm flex-shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div><p className="text-sm font-medium text-gray-800">{u.name}</p><p className="text-xs text-gray-400">{u.email}</p></div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
          <input className={inp} placeholder="Subject line" value={subject} onChange={e => setSubject(e.target.value)} /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea className={ta} rows={8} placeholder="Write your message..." value={message} onChange={e => setMessage(e.target.value)} /></div>
        <button onClick={send} disabled={sending || !selected}
          className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50">
          <Send className="h-4 w-4" />{sending ? 'Sending...' : 'Send Email'}
        </button>
      </Card>
    </div>
  )
}

interface Announcement { id: string; title: string; body: string; type: string; expiresAt: string | null; createdAt: string }

function AnnouncementsTab() {
  const [list,    setList]    = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [title,   setTitle]   = useState('')
  const [body,    setBody]    = useState('')
  const [type,    setType]    = useState('info')
  const [expires, setExpires] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [flash,   setFlash]   = useState('')
  const [flashErr,setFlashErr]= useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/cms/announcements`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setList(Array.isArray(data.value) ? data.value : [])
    } catch { setList([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const add = async () => {
    if (!title.trim() || !body.trim()) { setFlashErr('Title and body are required'); return }
    setSaving(true); setFlashErr('')
    try {
      const res = await fetch(`${API_BASE}/admin/communication/announcement`, {
        method: 'POST', headers: await authHeader(), body: JSON.stringify({ title, body, type, expiresAt: expires || null })
      })
      if (!res.ok) throw new Error()
      setFlash('Announcement posted — visible in app immediately'); setTimeout(() => setFlash(''), 4000)
      setTitle(''); setBody(''); setType('info'); setExpires('')
      await load()
    } catch { setFlashErr('Failed to save announcement') }
    finally { setSaving(false) }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this announcement?')) return
    try {
      await fetch(`${API_BASE}/admin/communication/announcement/${id}`, { method: 'DELETE', headers: await authHeader() })
      setList(l => l.filter(a => a.id !== id))
      setFlash('Deleted'); setTimeout(() => setFlash(''), 3000)
    } catch { setFlashErr('Failed to delete') }
  }

  const typeConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    info:    { label: 'Info',    color: 'bg-blue-100 text-blue-700',     icon: <Info className="h-4 w-4" /> },
    warning: { label: 'Warning', color: 'bg-amber-100 text-amber-700',   icon: <AlertTriangle className="h-4 w-4" /> },
    success: { label: 'Success', color: 'bg-green-100 text-green-700',   icon: <CheckCircle className="h-4 w-4" /> },
    promo:   { label: 'Promo',   color: 'bg-purple-100 text-purple-700', icon: <Gift className="h-4 w-4" /> },
  }

  return (
    <div className="space-y-4">
      {flash    && <Flash msg={flash}    onClose={() => setFlash('')} />}
      {flashErr && <Flash msg={flashErr} isError onClose={() => setFlashErr('')} />}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <Megaphone className="h-4 w-4 text-amber-600" />
            <h3 className="font-semibold text-gray-800">New Announcement</h3>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input className={inp} placeholder="Short headline" value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
            <textarea className={ta} rows={4} placeholder="Announcement details..." value={body} onChange={e => setBody(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select className={inp} value={type} onChange={e => setType(e.target.value)}>
                <option value="info">ℹ️ Info</option>
                <option value="warning">⚠️ Warning</option>
                <option value="success">✅ Success</option>
                <option value="promo">🎁 Promo</option>
              </select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Expires <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="date" className={inp} value={expires} onChange={e => setExpires(e.target.value)} /></div>
          </div>
          <button onClick={add} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-50">
            <Plus className="h-4 w-4" />{saving ? 'Posting...' : 'Post Announcement'}
          </button>
          <p className="text-xs text-gray-400">Stored in CMS — Flutter reads from <code className="bg-gray-100 px-1 rounded">/cms/announcements</code></p>
        </Card>

        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 text-sm">Live Announcements</h3>
            <span className="text-xs text-gray-400">{list.length} / 20</span>
          </div>
          {loading ? (
            <div className="p-6 space-y-3">{Array(3).fill(0).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}</div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Bell className="h-8 w-8 mb-2 opacity-30" /><p className="text-sm">No announcements yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {list.map((a: Announcement) => {
                const cfg = typeConfig[a.type] ?? typeConfig.info
                const expired = a.expiresAt && new Date(a.expiresAt) < new Date()
                return (
                  <div key={a.id} className={`px-5 py-4 ${expired ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap flex-1">
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.icon}{cfg.label}</span>
                        {expired && <span className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full text-xs">Expired</span>}
                      </div>
                      <button onClick={() => remove(a.id)} className="text-gray-300 hover:text-red-400 flex-shrink-0"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <p className="font-semibold text-gray-800 text-sm mt-1">{a.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.body}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(a.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
                      {a.expiresAt && ` · Expires ${new Date(a.expiresAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })}`}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

export default function CommunicationPage() {
  const [tab, setTab] = useState<Tab>('inbox')

  const tabs = [
    { id: 'inbox'         as Tab, label: 'Inbox',          icon: <Inbox className="h-4 w-4" />,     activeColor: 'bg-blue-600 text-white border-transparent'   },
    { id: 'broadcast'     as Tab, label: 'Broadcast',      icon: <Radio className="h-4 w-4" />,      activeColor: 'bg-blue-600 text-white border-transparent'   },
    { id: 'direct'        as Tab, label: 'Direct Message', icon: <Mail className="h-4 w-4" />,       activeColor: 'bg-purple-600 text-white border-transparent' },
    { id: 'announcements' as Tab, label: 'Announcements',  icon: <Megaphone className="h-4 w-4" />, activeColor: 'bg-amber-500 text-white border-transparent'  },
  ]

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Communication</h1>
          <p className="text-sm text-gray-500 mt-1">Inbox · Broadcast emails · Direct messages · In-app announcements</p>
        </div>
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <Bell className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div><strong>Push Notifications</strong> — requires Firebase FCM setup (not yet configured).
          Use <strong>Announcements</strong> tab for in-app notices until FCM is integrated.</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${tab === t.id ? t.activeColor : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
        {tab === 'inbox'         && <InboxTab />}
        {tab === 'broadcast'     && <BroadcastTab />}
        {tab === 'direct'        && <DirectTab />}
        {tab === 'announcements' && <AnnouncementsTab />}
      </div>
    </AdminLayout>
  )
}
