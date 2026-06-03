'use client'

import { AdminLayout } from '@/components/AdminLayout'
import { Card } from "@/components/ui/card"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Video, Package, TrendingUp, ArrowUpRight,
  CheckCircle, Clock, RefreshCw, Coins
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area
} from 'recharts'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

function getCookie(name: string): string | null {
  if (typeof window === 'undefined') return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null
  return null
}

function authHeader() {
  const token = getCookie('auth_token') || ''
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
}

const DEFAULT_STATS = {
  total: { users: 0, projects: 0, orders: 0, products: 0 },
  new:   { users: 0, projects: 0, orders: 0 },
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats,         setStats]         = useState(DEFAULT_STATS)
  const [materialCount, setMaterialCount] = useState(0)
  const [asinCount,     setAsinCount]     = useState(0)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState('')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = authHeader()
      const [statsRes, matsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/stats`,   { headers, credentials: 'include' }),
        fetch(`${API_BASE}/materials`,      { headers, credentials: 'include' }),
      ])

      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats({
          total: { ...DEFAULT_STATS.total, ...(data?.total ?? {}) },
          new:   { ...DEFAULT_STATS.new,   ...(data?.new   ?? {}) },
        })
      } else {
        setError(`Stats error: ${statsRes.status}`)
      }

      if (matsRes.ok) {
        const mdata = await matsRes.json()
        const list  = Array.isArray(mdata) ? mdata : (mdata.materials ?? [])
        setMaterialCount(list.length)
        setAsinCount(list.filter((m: any) => m.amazonASIN).length)
      }
    } catch (e: any) {
      setError(`Connection failed: ${e?.message}`)
    } finally {
      setLoading(false)
      setLastRefreshed(new Date().toLocaleTimeString('en-IN'))
    }
  }

  useEffect(() => { load() }, [])

  const mainStats = [
    {
      title: 'Total Users',
      value: stats.total.users,
      sub: `+${stats.new.users} this week`,
      icon: Users,
      gradient: 'from-blue-500 to-cyan-500',
      href: '/users'
    },
    {
      title: 'Projects / Videos',
      value: stats.total.projects,
      sub: `+${stats.new.projects} this week`,
      icon: Video,
      gradient: 'from-purple-500 to-pink-500',
      href: '/videos'
    },
    {
      title: 'Materials',
      value: materialCount,
      sub: `${asinCount} linked to Amazon`,
      icon: Package,
      gradient: 'from-orange-500 to-amber-500',
      href: '/materials'
    },
    {
      title: 'Goins Awarded',
      value: '—',
      sub: 'View in Goins page',
      icon: Coins,
      gradient: 'from-emerald-500 to-teal-500',
      href: '/goins'
    },
  ]

  const userChartData = [
    { label: 'Existing', value: Math.max(0, stats.total.users - stats.new.users) },
    { label: 'New (7d)',  value: stats.new.users },
  ]

  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            {error && <p className="text-sm text-red-600 mt-0.5">⚠️ {error}</p>}
            {lastRefreshed && <p className="text-xs text-gray-400 mt-0.5">Last refreshed {lastRefreshed}</p>}
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {mainStats.map(stat => {
            const Icon = stat.icon
            return (
              <Card key={stat.title}
                onClick={() => router.push(stat.href)}
                className="relative overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-0">
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-5`} />
                <div className="relative p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} bg-opacity-10`}>
                      <Icon className="h-6 w-6 text-gray-700" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-gray-300" />
                  </div>
                  <h3 className="text-sm font-medium text-gray-600 mb-1">{stat.title}</h3>
                  <p className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</p>
                  <p className="text-xs text-gray-400">{stat.sub}</p>
                </div>
              </Card>
            )
          })}
        </div>

        {/* Amazon affiliate progress */}
        <Card className="p-6 border-0 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Amazon Affiliate Setup</h3>
              <p className="text-sm text-gray-500">
                {asinCount} of {materialCount} materials have Amazon ASINs linked
              </p>
            </div>
            <button onClick={() => router.push('/materials')}
              className="text-sm text-orange-600 hover:text-orange-700 font-medium">
              Add ASINs →
            </button>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-orange-400 to-amber-500 h-3 rounded-full transition-all duration-500"
              style={{ width: materialCount > 0 ? `${Math.round((asinCount / materialCount) * 100)}%` : '0%' }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <p className="text-xs text-gray-400">
              {materialCount > 0 ? Math.round((asinCount / materialCount) * 100) : 0}% complete
            </p>
            <p className="text-xs text-orange-600 font-medium">
              {materialCount - asinCount} materials still need ASINs
            </p>
          </div>
          {asinCount === 0 && (
            <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-xs text-amber-700 font-medium">
                ⚠️ No ASINs set yet — "Buy All on Amazon" button won't appear in the shop until at least one ASIN is added.
                Go to Materials → Amazon Setup tab to add them.
              </p>
            </div>
          )}
        </Card>

        {/* Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="p-6 border-0 shadow-md">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">User Breakdown</h3>
                <p className="text-sm text-gray-500">Total vs new this week</p>
              </div>
              <button onClick={() => router.push('/analytics')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                View Analytics →
              </button>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={userChartData} barSize={48}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" stroke="#9ca3af" style={{ fontSize: '13px' }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px' }}
                  formatter={(v: number) => [v, 'Users']}
                />
                <Bar dataKey="value" radius={[6,6,0,0]} fill="#3b82f6"
                  label={{ position: 'top', fontSize: 13, fontWeight: 700, fill: '#374151' }} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{stats.total.users}</p>
                <p className="text-xs text-blue-500 mt-0.5">Total Users</p>
              </div>
              <div className="bg-cyan-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-cyan-700">+{stats.new.users}</p>
                <p className="text-xs text-cyan-500 mt-0.5">New This Week</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 border-0 shadow-md">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
                <p className="text-sm text-gray-500">Common admin tasks</p>
              </div>
            </div>
            <div className="space-y-3">
              <button onClick={() => router.push('/videos')}
                className="w-full flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-100 hover:bg-purple-100 transition-colors">
                <div className="flex items-center gap-3">
                  <Video className="h-5 w-5 text-purple-600" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-purple-900">Approve Videos</p>
                    <p className="text-xs text-purple-600">Review pending project uploads</p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-purple-400" />
              </button>

              <button onClick={() => router.push('/materials')}
                className="w-full flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-100 hover:bg-orange-100 transition-colors">
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-orange-600" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-orange-900">Add Amazon ASINs</p>
                    <p className="text-xs text-orange-600">{materialCount - asinCount} materials need ASINs</p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-orange-400" />
              </button>

              <button onClick={() => router.push('/content')}
                className="w-full flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-100 hover:bg-green-100 transition-colors">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-green-900">Update CMS Content</p>
                    <p className="text-xs text-green-600">Challenges, Resources, Announcements</p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-green-400" />
              </button>

              <button onClick={() => router.push('/communication')}
                className="w-full flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-blue-900">Send Announcement</p>
                    <p className="text-xs text-blue-600">Broadcast to all users</p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-blue-400" />
              </button>
            </div>
          </Card>
        </div>

      </div>
    </AdminLayout>
  )
}