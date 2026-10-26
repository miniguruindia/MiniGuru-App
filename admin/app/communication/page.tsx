'use client'

import { useEffect, useState, useCallback } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import {
  Inbox, Send, Radio, Bell, RefreshCw, AlertCircle,
  CheckCircle, Trash2, Mail, MailOpen, Reply, Users,
  Plus, X, ChevronDown, Info, AlertTriangle, Gift, Megaphone, Star, Copy, Clock
} from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

async function authHeader() {
  const token = (() => { const v = `; ${document.cookie}`; const p = v.split('; auth_token='); return p.length === 2 ? p.pop()!.split(';').shift()! : '' })()
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

type Tab = 'inbox' | 'broadcast' | 'direct' | 'announcements' | 'emails'

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
  const [alsoEmail, setAlsoEmail] = useState(false)
  const [sending, setSending] = useState(false)
  const [flash,   setFlash]   = useState('')
  const [flashErr,setFlashErr]= useState('')
  const [result,  setResult]  = useState<{ notified: number; emailed: number; emailFailed: number; total: number } | null>(null)

  const send = async () => {
    if (!subject.trim() || !message.trim()) { setFlashErr('Subject and message are required'); return }
    const confirmMsg = alsoEmail
      ? 'Send an in-app notification AND an email to ALL users? This cannot be undone.'
      : 'Send an in-app notification to ALL users? (No email will be sent — check "Also email everyone" below if you need that too.)'
    if (!confirm(confirmMsg)) return
    setSending(true); setFlashErr(''); setResult(null)
    try {
      const res = await fetch(`${API_BASE}/admin/communication/broadcast`, {
        method: 'POST', headers: await authHeader(), body: JSON.stringify({ subject, message, previewText: preview, alsoEmail })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setResult(data)
      setFlash(
        alsoEmail
          ? `Broadcast complete — ${data.notified} notified in-app, ${data.emailed} emailed (${data.emailFailed} failed)`
          : `Broadcast complete — ${data.notified} users notified in-app (no email sent)`
      )
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
            {[['Notified',result.notified,'text-blue-700'],['Emailed',result.emailed,'text-green-700'],['Email failed',result.emailFailed,'text-red-600'],['Total',result.total,'text-gray-700']].map(([l,v,c]) => (
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
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Footer note <span className="text-gray-400 font-normal">(optional — shown at the bottom of the email only)</span></label>
          <input className={inp} placeholder="e.g. Questions? Reply to this email." value={preview} onChange={e => setPreview(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={alsoEmail} onChange={e => setAlsoEmail(e.target.checked)} />
          Also email everyone (uses the daily email limit — leave off for routine announcements; children's emails go to their parent/guardian)
        </label>
        <button onClick={send} disabled={sending}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
          <Send className="h-4 w-4" />{sending ? 'Sending...' : 'Send to All Users'}
        </button>
        <p className="text-xs text-gray-400">
          {alsoEmail
            ? '⚠️ This will send an in-app notification AND an email to every registered user. Double-check before sending.'
            : 'This sends an in-app notification only (shows in everyone\'s notification bell) — no email, no quota used.'}
        </p>
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
  const [alsoEmail,setAlsoEmail]= useState(false)
  const [sending,  setSending]  = useState(false)
  const [flash,    setFlash]    = useState('')
  const [flashErr, setFlashErr] = useState('')
  const [showList, setShowList] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/admin/communication/users`, { headers: authHeader() as any })
      .then(r => r.json())
      .then((data: any) => {
        const list = Array.isArray(data) ? data : (Array.isArray(data?.users) ? data.users : [])
        setUsers(list)
      })
      .catch(() => setUsers([]))
  }, [])

  const filtered = (Array.isArray(users) ? users : []).filter(u =>
    (u.name || '').toLowerCase().includes(query.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8)

  const send = async () => {
    if (!selected) { setFlashErr('Please select a user'); return }
    if (!subject.trim() || !message.trim()) { setFlashErr('Subject and message are required'); return }
    setSending(true); setFlashErr('')
    try {
      const res = await fetch(`${API_BASE}/admin/communication/send`, {
        method: 'POST', headers: await authHeader(), body: JSON.stringify({ userId: selected.id, subject, message, alsoEmail })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setFlash(
        data.emailed
          ? `Notified ${selected.name} in-app and emailed ${data.sentTo}`
          : `Notified ${selected.name} in-app (no email sent)`
      )
      setTimeout(() => setFlash(''), 5000)
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
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={alsoEmail} onChange={e => setAlsoEmail(e.target.checked)} />
          Also email this person (uses the daily email limit)
        </label>
        <button onClick={send} disabled={sending || !selected}
          className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50">
          <Send className="h-4 w-4" />{sending ? 'Sending...' : 'Send'}
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


// ── Sent emails: every email MiniGuru sends, with Save / Forward / Delete ────
interface SentEmail {
  id: string; toEmail: string; subject: string; status: string; error?: string | null
  createdAt: string; fromEmail?: string | null; kind?: string | null; reference?: string | null
  saved?: boolean | null; state: 'fresh' | 'expiring' | 'saved'; hasBody: boolean; deleteOn: string | null
}
interface ContactRow { id: string; email: string; lastKind?: string | null; lastReference?: string | null; sentCount: number; firstSentAt: string; lastSentAt: string }

const KIND_LABEL: Record<string, string> = {
  'kit-to-parent': 'Kit to parent', 'materials-list': 'Materials list', announcement: 'Announcement',
  direct: 'Direct message', security: 'Code / password', forward: 'Forward', other: 'Other',
}
const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const daysLeft = (iso: string | null) => iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)) : null

function EmailsTab({ onCounts }: { onCounts: (expiring: number) => void }) {
  const [view, setView] = useState<'all' | 'fresh' | 'expiring' | 'saved' | 'contacts'>('all')
  const [rows, setRows] = useState<SentEmail[]>([])
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [counts, setCounts] = useState({ all: 0, fresh: 0, expiring: 0, saved: 0 })
  const [nextDelete, setNextDelete] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [openBody, setOpenBody] = useState<string | null>(null)
  const [flash, setFlash] = useState('')
  const [flashErr, setFlashErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const h = await authHeader()
      if (view === 'contacts') {
        const r = await fetch(`${API_BASE}/admin/communication/contacts?q=${encodeURIComponent(q)}`, { headers: h })
        if (!r.ok) throw new Error()
        const d = await r.json()
        setContacts(d.rows || [])
      } else {
        const r = await fetch(`${API_BASE}/admin/communication/emails?view=${view}&q=${encodeURIComponent(q)}`, { headers: h })
        if (!r.ok) throw new Error()
        const d = await r.json()
        setRows(d.rows || []); setCounts(d.counts); setNextDelete(d.nextDelete)
        onCounts(d.counts.expiring)
      }
    } catch { setFlashErr('Could not load. Please try again.') }
    finally { setLoading(false) }
  }, [view, q, onCounts])

  useEffect(() => { const t = setTimeout(load, q ? 350 : 0); return () => clearTimeout(t) }, [load, q])

  const act = async (id: string, what: 'save' | 'unsave' | 'forward' | 'delete') => {
    if (what === 'delete' && !confirm('Delete this email from the list? This cannot be undone.')) return
    setBusyId(id); setFlash(''); setFlashErr('')
    try {
      const h = await authHeader()
      let res: Response
      if (what === 'delete') res = await fetch(`${API_BASE}/admin/communication/emails/${id}`, { method: 'DELETE', headers: h })
      else if (what === 'forward') res = await fetch(`${API_BASE}/admin/communication/emails/${id}/forward`, { method: 'POST', headers: h })
      else res = await fetch(`${API_BASE}/admin/communication/emails/${id}/save`, { method: 'POST', headers: h, body: JSON.stringify({ saved: what === 'save' }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.message || 'Failed')
      setFlash(what === 'forward' ? `Forwarded to ${d.forwardedTo}` : what === 'delete' ? 'Deleted' : what === 'save' ? 'Saved — it will not be auto-deleted' : 'Un-saved — it will be deleted on schedule')
      await load()
    } catch (e: any) { setFlashErr(e.message || 'Failed') }
    finally { setBusyId(null) }
  }

  const toggleOpen = async (r: SentEmail) => {
    if (openId === r.id) { setOpenId(null); setOpenBody(null); return }
    setOpenId(r.id); setOpenBody(null)
    if (!r.hasBody) return
    try {
      const res = await fetch(`${API_BASE}/admin/communication/emails/${r.id}`, { headers: await authHeader() })
      const d = await res.json()
      setOpenBody(d.bodyHtml || '')
    } catch { setOpenBody('') }
  }

  const pills: { id: typeof view; label: string }[] = [
    { id: 'all', label: `All (${counts.all})` },
    { id: 'fresh', label: `Fresh (${counts.fresh})` },
    { id: 'expiring', label: `Going to be deleted (${counts.expiring})` },
    { id: 'saved', label: `Saved (${counts.saved})` },
    { id: 'contacts', label: 'Contacts' },
  ]

  return (
    <div className="space-y-4">
      {flash && <Flash msg={flash} onClose={() => setFlash('')} />}
      {flashErr && <Flash msg={flashErr} isError onClose={() => setFlashErr('')} />}

      <Card className="p-4 text-sm text-gray-600">
        Every email MiniGuru sends from <b>connect@miniguru.in</b> is listed here. An email stays <b>fresh for 8 days</b>, then moves to
        <b> Going to be deleted</b> and is removed automatically 7 days later. Press <b>Save</b> to keep one for good, or <b>Forward</b> to
        send a copy to the MiniGuru Gmail. Codes and password emails are listed but their content is never stored.
        The address and reason of everyone written to stays in <b>Contacts</b> permanently.
      </Card>

      {counts.expiring > 0 && view !== 'contacts' && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <Clock className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div><b>{counts.expiring} email{counts.expiring === 1 ? '' : 's'} will be deleted soon.</b>
            {nextDelete ? ` The first goes on ${new Date(nextDelete).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.` : ''} Open
            <button className="underline mx-1" onClick={() => setView('expiring')}>Going to be deleted</button>to Save or Forward the ones you want.</div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        {pills.map(p => (
          <button key={p.id} onClick={() => setView(p.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${view === p.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>{p.label}</button>
        ))}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search email, subject or reason" className={`${inp} max-w-xs ml-auto`} />
        <button onClick={load} className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50" title="Refresh"><RefreshCw className="h-4 w-4 text-gray-500" /></button>
      </div>

      {loading ? (
        <div className="text-center text-sm text-gray-400 py-12">Loading…</div>
      ) : view === 'contacts' ? (
        contacts.length === 0 ? <Card className="p-10 text-center text-gray-400">No contacts yet.</Card> : (
          <Card className="divide-y divide-gray-100">
            {contacts.map(c => (
              <div key={c.id} className="p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 break-all">{c.email}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{KIND_LABEL[c.lastKind || 'other'] || c.lastKind} · {c.lastReference}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{c.sentCount} email{c.sentCount === 1 ? '' : 's'} · first {fmtDate(c.firstSentAt)} · last {fmtDate(c.lastSentAt)}</div>
                </div>
                <button onClick={() => { navigator.clipboard?.writeText(c.email); setFlash('Copied ' + c.email) }}
                  className="text-xs px-2 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50 flex items-center gap-1"><Copy className="h-3 w-3" />Copy</button>
              </div>
            ))}
          </Card>
        )
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-gray-400">Nothing here.</Card>
      ) : (
        <div className="space-y-3">
          {rows.map(r => {
            const left = daysLeft(r.deleteOn)
            return (
              <Card key={r.id} className={`p-4 ${r.state === 'expiring' ? 'border-red-200' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900 break-all">{r.toEmail}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{KIND_LABEL[r.kind || 'other'] || r.kind}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'sent' ? 'bg-green-100 text-green-700' : r.status === 'blocked' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{r.status}</span>
                      {r.state === 'saved' && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">★ Saved</span>}
                      {r.state === 'expiring' && left !== null && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Deleted in {left} day{left === 1 ? '' : 's'}</span>}
                    </div>
                    <div className="text-sm text-gray-700 mt-1">{r.subject}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{r.reference}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{fmtDate(r.createdAt)}{r.fromEmail ? ` · from ${r.fromEmail}` : ''}</div>
                    {r.error && <div className="text-xs text-red-600 mt-1">{r.error}</div>}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button disabled={busyId === r.id || !r.hasBody} onClick={() => toggleOpen(r)}
                      className="text-xs px-2 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40">{openId === r.id ? 'Hide' : 'View'}</button>
                    <button disabled={busyId === r.id} onClick={() => act(r.id, r.state === 'saved' ? 'unsave' : 'save')}
                      className="text-xs px-2 py-1 rounded border border-yellow-200 bg-yellow-50 text-yellow-800 hover:bg-yellow-100 flex items-center gap-1"><Star className="h-3 w-3" />{r.state === 'saved' ? 'Un-save' : 'Save'}</button>
                    <button disabled={busyId === r.id || !r.hasBody} onClick={() => act(r.id, 'forward')}
                      className="text-xs px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 flex items-center gap-1"><Send className="h-3 w-3" />Forward</button>
                    <button disabled={busyId === r.id} onClick={() => act(r.id, 'delete')}
                      className="text-xs px-2 py-1 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-1"><Trash2 className="h-3 w-3" />Delete</button>
                  </div>
                </div>
                {openId === r.id && (
                  <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                    {openBody === null ? <div className="p-4 text-sm text-gray-400">Loading…</div>
                      : openBody === '' ? <div className="p-4 text-sm text-gray-400">No stored content for this email.</div>
                      : <iframe title="email" sandbox="" srcDoc={openBody} className="w-full h-96 bg-white" />}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function CommunicationPage() {
  const [tab, setTab] = useState<Tab>('inbox')
  const [expiring, setExpiring] = useState(0)
  const refreshExpiring = useCallback((n: number) => setExpiring(n), [])
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/admin/communication/emails?view=expiring`, { headers: await authHeader() })
        if (r.ok) { const d = await r.json(); setExpiring(d.counts?.expiring || 0) }
      } catch {}
    })()
  }, [])

  const tabs = [
    { id: 'inbox'         as Tab, label: 'Inbox',          icon: <Inbox className="h-4 w-4" />,     activeColor: 'bg-blue-600 text-white border-transparent'   },
    { id: 'broadcast'     as Tab, label: 'Broadcast',      icon: <Radio className="h-4 w-4" />,      activeColor: 'bg-blue-600 text-white border-transparent'   },
    { id: 'direct'        as Tab, label: 'Direct Message', icon: <Mail className="h-4 w-4" />,       activeColor: 'bg-purple-600 text-white border-transparent' },
    { id: 'announcements' as Tab, label: 'Announcements',  icon: <Megaphone className="h-4 w-4" />, activeColor: 'bg-amber-500 text-white border-transparent'  },
    { id: 'emails'        as Tab, label: expiring > 0 ? `Sent Emails (${expiring} to delete soon)` : 'Sent Emails', icon: <Clock className="h-4 w-4" />, activeColor: 'bg-green-600 text-white border-transparent' },
  ]

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Communication</h1>
          <p className="text-sm text-gray-500 mt-1">Inbox · Broadcast emails · Direct messages · In-app announcements · Sent emails</p>
        </div>
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <Bell className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div><strong>Push Notifications</strong> — requires Firebase FCM setup (not yet configured).
          Use <strong>Announcements</strong> tab for in-app notices until FCM is integrated.</div>
        </div>
        {expiring > 0 && tab !== 'emails' && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            <Clock className="h-4 w-4 flex-shrink-0" />
            <div className="flex-1"><b>{expiring} sent email{expiring === 1 ? '' : 's'} will be deleted soon.</b> Save or forward the ones you want to keep.</div>
            <button onClick={() => setTab('emails')} className="underline">Open Sent Emails</button>
          </div>
        )}
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
        {tab === 'emails'        && <EmailsTab onCounts={refreshExpiring} />}
      </div>
    </AdminLayout>
  )
}