'use client'

import React, { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import { Search, RefreshCw, Plus, Minus, History, ChevronDown, ChevronUp } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

interface UserGoinsSummary {
  id: string
  name: string
  email: string
  goinsBalance: number
  totalEarned: number
  totalSpent: number
}

interface GoinsTxn {
  id: string
  type: string
  amount: number
  description: string
  timestamp: string
  balanceAfter: number
}

async function authHeader() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') || '' : ''
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function fetchAllUsersGoins(): Promise<UserGoinsSummary[]> {
  const res = await fetch(`${API_BASE}/admin/goins/users`, { headers: await authHeader() })
  if (!res.ok) throw new Error(`${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : data.users ?? []
}

async function fetchUserHistory(userId: string): Promise<GoinsTxn[]> {
  const res = await fetch(`${API_BASE}/admin/goins/history/${userId}`, { headers: await authHeader() })
  if (!res.ok) throw new Error(`${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : data.transactions ?? []
}

async function adjustGoins(userId: string, amount: number, reason: string): Promise<number> {
  const res = await fetch(`${API_BASE}/admin/goins/adjust`, {
    method: 'POST',
    headers: await authHeader(),
    body: JSON.stringify({ userId, amount, reason }),
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return (await res.json()).newBalance
}

const MOCK_USERS: UserGoinsSummary[] = [
  { id: '1', name: 'Arjun Kumar',  email: 'arjun@test.com',  goinsBalance: 450, totalEarned: 1200, totalSpent: 750  },
  { id: '2', name: 'Priya Sharma', email: 'priya@test.com',  goinsBalance: 820, totalEarned: 2100, totalSpent: 1280 },
  { id: '3', name: 'Ravi Patel',   email: 'ravi@test.com',   goinsBalance: 120, totalEarned: 500,  totalSpent: 380  },
  { id: '4', name: 'Sana Mirza',   email: 'sana@test.com',   goinsBalance: 995, totalEarned: 1500, totalSpent: 505  },
]

export default function GoinsPage() {
  const [users, setUsers]                   = useState<UserGoinsSummary[]>([])
  const [filtered, setFiltered]             = useState<UserGoinsSummary[]>([])
  const [loading, setLoading]               = useState(true)
  const [search, setSearch]                 = useState('')
  const [error, setError]                   = useState('')
  const [success, setSuccess]               = useState('')
  const [expandedId, setExpandedId]         = useState<string | null>(null)
  const [history, setHistory]               = useState<GoinsTxn[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [adjustUserId, setAdjustUserId]     = useState<string | null>(null)
  const [adjustName, setAdjustName]         = useState('')
  const [adjustAmount, setAdjustAmount]     = useState('')
  const [adjustReason, setAdjustReason]     = useState('')
  const [adjusting, setAdjusting]           = useState(false)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const data = await fetchAllUsersGoins()
      setUsers(data); setFiltered(data)
    } catch {
      setError('Backend not connected — showing sample data. Needs: GET /admin/goins/users')
      setUsers(MOCK_USERS); setFiltered(MOCK_USERS)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(users.filter(u =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    ))
  }, [search, users])

  const flash = (msg: string, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(''), 5000) }
    else         { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  }

  const toggleHistory = async (userId: string) => {
    if (expandedId === userId) { setExpandedId(null); return }
    setExpandedId(userId); setHistoryLoading(true)
    try   { setHistory(await fetchUserHistory(userId)) }
    catch { setHistory([]) }
    finally { setHistoryLoading(false) }
  }

  const openAdjust = (u: UserGoinsSummary) => {
    setAdjustUserId(u.id); setAdjustName(u.name); setAdjustAmount(''); setAdjustReason('')
  }

  const handleAdjust = async () => {
    if (!adjustUserId || !adjustAmount || !adjustReason.trim()) return
    const delta = parseInt(adjustAmount)
    if (isNaN(delta) || delta === 0) { flash('Enter a non-zero number', true); return }
    setAdjusting(true)
    try {
      const newBalance = await adjustGoins(adjustUserId, delta, adjustReason.trim())
      setUsers(prev => prev.map(u => u.id === adjustUserId ? { ...u, goinsBalance: newBalance } : u))
      flash(`Goines adjusted for ${adjustName}. New balance: ${newBalance}`)
      setAdjustUserId(null)
    } catch { flash('Failed to adjust — check backend connection', true) }
    finally { setAdjusting(false) }
  }

  const totalInCirculation = users.reduce((s, u) => s + u.goinsBalance, 0)

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Goines Manager</h1>
            <p className="text-sm text-gray-500 mt-1">View and edit every student's Goine balance</p>
          </div>
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {error   && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        {success && <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5 border-0 shadow-sm">
            <p className="text-sm text-gray-500">Total Students</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{users.length}</p>
          </Card>
          <Card className="p-5 border-0 shadow-sm">
            <p className="text-sm text-gray-500">Goines in Circulation</p>
            <p className="text-3xl font-bold text-amber-600 mt-1">{totalInCirculation.toLocaleString()}</p>
          </Card>
          <Card className="p-5 border-0 shadow-sm">
            <p className="text-sm text-gray-500">Avg Balance</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {users.length > 0 ? Math.round(totalInCirculation / users.length) : 0}
            </p>
          </Card>
        </div>

        <Card className="p-4 border-0 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search by name or email..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </Card>

        <Card className="border-0 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">Student</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase px-5 py-3">Balance</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase px-5 py-3 hidden md:table-cell">Earned</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase px-5 py-3 hidden md:table-cell">Spent</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-gray-500 text-sm">No users found</td></tr>
                ) : (
                  filtered.map(u => (
                    <React.Fragment key={u.id}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-medium text-gray-900 text-sm">{u.name}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className={`text-lg font-bold ${u.goinsBalance < 50 ? 'text-red-600' : 'text-amber-600'}`}>
                            {u.goinsBalance}
                          </span>
                          <span className="text-xs text-gray-400 ml-1">G</span>
                        </td>
                        <td className="px-5 py-4 text-right text-sm text-green-600 font-medium hidden md:table-cell">+{u.totalEarned}</td>
                        <td className="px-5 py-4 text-right text-sm text-red-500 hidden md:table-cell">-{u.totalSpent}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => openAdjust(u)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600">
                              <Plus className="h-3 w-3" /><Minus className="h-3 w-3" /> Adjust
                            </button>
                            <button onClick={() => toggleHistory(u.id)}
                              className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-gray-50">
                              <History className="h-3 w-3" />
                              {expandedId === u.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === u.id && (
                        <tr className="bg-gray-50">
                          <td colSpan={5} className="px-5 py-4">
                            {historyLoading ? (
                              <div className="flex justify-center py-4">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-500" />
                              </div>
                            ) : history.length === 0 ? (
                              <p className="text-sm text-gray-400 text-center py-3">No transactions yet</p>
                            ) : (
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {history.map(t => (
                                  <div key={t.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-sm">
                                    <div>
                                      <span className="font-medium text-gray-700">{t.type}</span>
                                      {t.description && <span className="text-gray-400 ml-2 text-xs">{t.description}</span>}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className={t.amount > 0 ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>
                                        {t.amount > 0 ? `+${t.amount}` : t.amount}G
                                      </span>
                                      <span className="text-xs text-gray-400">→ {t.balanceAfter}G</span>
                                      <span className="text-xs text-gray-300">{new Date(t.timestamp).toLocaleDateString('en-IN')}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {adjustUserId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6 border-0 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Adjust Goines</h2>
            <p className="text-sm text-gray-500 mb-5">For <strong>{adjustName}</strong></p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount <span className="text-gray-400 font-normal">(negative to deduct, e.g. -50)</span>
              </label>
              <input type="number" autoFocus placeholder="e.g. 100 or -50"
                value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
              <input type="text" placeholder="e.g. Bonus for project completion"
                value={adjustReason} onChange={e => setAdjustReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            {adjustAmount && !isNaN(parseInt(adjustAmount)) && (
              <div className={`p-3 rounded-lg mb-4 text-sm font-medium text-center ${parseInt(adjustAmount) > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {parseInt(adjustAmount) > 0
                  ? `Adding ${adjustAmount} Goines to ${adjustName}`
                  : `Deducting ${Math.abs(parseInt(adjustAmount))} Goines from ${adjustName}`}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={handleAdjust} disabled={adjusting || !adjustAmount || !adjustReason.trim()}
                className="flex-1 py-2.5 bg-amber-500 text-white rounded-lg font-medium text-sm hover:bg-amber-600 disabled:opacity-50">
                {adjusting ? 'Saving...' : 'Confirm'}
              </button>
              <button onClick={() => setAdjustUserId(null)}
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
