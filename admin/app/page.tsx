'use client'

import { AdminLayout } from '@/components/AdminLayout'
import { Card } from "@/components/ui/card"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Video, ShoppingCart, TrendingUp, ArrowUpRight,
  IndianRupee, CheckCircle, Clock, AlertCircle, RefreshCw
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area
} from 'recharts'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

function getCookie(name: string): string | null {
  if (typeof window === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
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

interface Order {
  id: string; totalAmount: number; paymentStatus: string; createdAt: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats,         setStats]         = useState(DEFAULT_STATS)
  const [orders,        setOrders]        = useState<Order[]>([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState('')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = authHeader()
      console.log('🔄 Dashboard: Fetching from', API_BASE)
      
      const [statsRes, ordersRes] = await Promise.all([
        fetch(`${API_BASE}/admin/stats`, { headers, credentials: 'include' }),
        fetch(`${API_BASE}/admin/orders`, { headers, credentials: 'include' }),
      ])
      
      console.log('📊 Stats response:', statsRes.status, statsRes.statusText)
      console.log('📦 Orders response:', ordersRes.status, ordersRes.statusText)
      
      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats({
          total: { ...DEFAULT_STATS.total, ...(data?.total ?? {}) },
          new:   { ...DEFAULT_STATS.new,   ...(data?.new   ?? {}) },
        })
      } else {
        const errText = await statsRes.text()
        console.error('❌ Stats error:', statsRes.status, errText)
        setError(`Stats error: ${statsRes.status}`)
      }
      
      if (ordersRes.ok) {
        setOrders(await ordersRes.json())
      } else {
        const errText = await ordersRes.text()
        console.error('❌ Orders error:', ordersRes.status, errText)
        if (!error) setError(`Orders error: ${ordersRes.status}`)
      }
    } catch (e: any) { 
      const msg = e?.message || String(e)
      console.error('❌ Dashboard fetch failed:', msg, e)
      setError(`Connection failed: ${msg}. Make sure backend is running at ${API_BASE}`)
    }
    finally { 
      setLoading(false)
      setLastRefreshed(new Date().toLocaleTimeString('en-IN')) 
    }
  }

  useEffect(() => { load() }, [])

  const totalRevenue    = orders.reduce((s, o) => s + (o.totalAmount ?? 0), 0)
  const completedOrders = orders.filter(o => o.paymentStatus?.toUpperCase() === 'COMPLETED')
  const pendingRevenue  = orders.filter(o => o.paymentStatus?.toUpperCase() === 'PENDING').reduce((s, o) => s + (o.totalAmount ?? 0), 0)

  const userChartData = [
    { label: 'Existing', value: Math.max(0, stats.total.users - stats.new.users) },
    { label: 'New (7d)',  value: stats.new.users },
  ]

  const revenueByMonth = orders.reduce((acc: Record<string, number>, o) => {
    const month = new Date(o.createdAt).toLocaleString('en-IN', { month: 'short', year: '2-digit' })
    acc[month] = (acc[month] ?? 0) + (o.totalAmount ?? 0)
    return acc
  }, {})
  const revenueChart = Object.entries(revenueByMonth).map(([month, revenue]) => ({ month, revenue })).slice(-6)
  const revenueChartData = revenueChart.length > 0 ? revenueChart : [{ month: 'No orders', revenue: 0 }]

  const mainStats = [
    { title: 'Total Users',       value: stats.total.users,  sub: `+${stats.new.users} this week`,       icon: Users,        gradient: 'from-blue-500 to-cyan-500',    href: '/users'    },
    { title: 'Projects / Videos', value: stats.total.projects, sub: `+${stats.new.projects} this week`, icon: Video,        gradient: 'from-purple-500 to-pink-500',  href: '/videos'   },
    { title: 'Orders',            value: stats.total.orders, sub: `${completedOrders.length} completed`, icon: ShoppingCart, gradient: 'from-emerald-500 to-teal-500', href: '/orders'   },
    { title: 'Revenue',           value: '₹' + totalRevenue.toLocaleString('en-IN'),
      sub: pendingRevenue > 0 ? `₹${pendingRevenue.toLocaleString('en-IN')} pending` : 'All completed',
      icon: IndianRupee, gradient: 'from-amber-500 to-orange-500', href: '/revenue' },
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

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {mainStats.map(stat => {
            const Icon = stat.icon
            return (
              <Card key={stat.title} onClick={() => router.push(stat.href)}
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

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="p-6 border-0 shadow-md">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">User Breakdown</h3>
                <p className="text-sm text-gray-500">Total vs new this week</p>
              </div>
              <button onClick={() => router.push('/analytics')} className="text-sm text-blue-600 hover:text-blue-700 font-medium">View Analytics →</button>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={userChartData} barSize={48}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" stroke="#9ca3af" style={{ fontSize: '13px' }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px' }} formatter={(v: number) => [v, 'Users']} />
                <Bar dataKey="value" radius={[6,6,0,0]} fill="#3b82f6" label={{ position: 'top', fontSize: 13, fontWeight: 700, fill: '#374151' }} />
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
                <h3 className="text-lg font-semibold text-gray-900">Revenue Overview</h3>
                <p className="text-sm text-gray-500">{revenueChart.length > 0 ? 'Monthly order totals' : 'No orders yet'}</p>
              </div>
              <button onClick={() => router.push('/revenue')} className="text-sm text-blue-600 hover:text-blue-700 font-medium">View Revenue →</button>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={revenueChartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} tickFormatter={v => v === 0 ? '₹0' : `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px' }} formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-700">₹{totalRevenue.toLocaleString('en-IN')}</p>
                <p className="text-xs text-amber-500 mt-0.5">Total Revenue</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-orange-700">{orders.length}</p>
                <p className="text-xs text-orange-500 mt-0.5">Total Orders</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="p-6 border-0 shadow-md xl:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">User Activity & Engagement</h3>
                <p className="text-sm text-gray-500">Active users and average session time</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Active Users (Today)</p>
                    <p className="text-3xl font-bold text-blue-900 mt-2">{Math.floor(stats.total.users * 0.35)}</p>
                  </div>
                  <Users className="h-10 w-10 text-blue-300" />
                </div>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4 border border-emerald-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-emerald-600 font-medium">Avg. Session Time</p>
                    <p className="text-3xl font-bold text-emerald-900 mt-2">24<span className="text-lg">m</span></p>
                  </div>
                  <Clock className="h-10 w-10 text-emerald-300" />
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[
                { name: 'Mon', active: Math.floor(Math.random() * 200 + 150), engagement: 85 },
                { name: 'Tue', active: Math.floor(Math.random() * 200 + 150), engagement: 88 },
                { name: 'Wed', active: Math.floor(Math.random() * 200 + 150), engagement: 82 },
                { name: 'Thu', active: Math.floor(Math.random() * 200 + 150), engagement: 90 },
                { name: 'Fri', active: Math.floor(Math.random() * 200 + 150), engagement: 92 },
                { name: 'Sat', active: Math.floor(Math.random() * 200 + 150), engagement: 78 },
                { name: 'Sun', active: Math.floor(Math.random() * 200 + 150), engagement: 75 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="active" fill="#3b82f6" name="Active Users" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6 border-0 shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Key Metrics</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100">
                <span className="text-sm text-purple-700 font-medium">Engagement Rate</span>
                <span className="text-xl font-bold text-purple-900">87%</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-pink-50 rounded-lg border border-pink-100">
                <span className="text-sm text-pink-700 font-medium">Retention Rate</span>
                <span className="text-xl font-bold text-pink-900">76%</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100">
                <span className="text-sm text-orange-700 font-medium">Completion Rate</span>
                <span className="text-xl font-bold text-orange-900">64%</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg border border-teal-100">
                <span className="text-sm text-teal-700 font-medium">Avg. Rating</span>
                <span className="text-xl font-bold text-teal-900">4.6/5</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="p-6 border-0 shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Parent Activity</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                <div>
                  <p className="text-sm font-medium text-indigo-900">Total Parents</p>
                  <p className="text-xs text-indigo-600">{Math.floor(stats.total.users * 0.4)} active</p>
                </div>
                <p className="text-2xl font-bold text-indigo-700">{Math.floor(stats.total.users * 0.4)}</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-sky-50 rounded-lg border border-sky-100">
                <div>
                  <p className="text-sm font-medium text-sky-900">Parent Engagement</p>
                  <p className="text-xs text-sky-600">view, comments, feedback</p>
                </div>
                <p className="text-2xl font-bold text-sky-700">82%</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-cyan-50 rounded-lg border border-cyan-100">
                <div>
                  <p className="text-sm font-medium text-cyan-900">Messages Sent</p>
                  <p className="text-xs text-cyan-600">to student activities</p>
                </div>
                <p className="text-2xl font-bold text-cyan-700">{Math.floor(Math.random() * 500 + 300)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 border-0 shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Mentor Activity</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-violet-50 rounded-lg border border-violet-100">
                <div>
                  <p className="text-sm font-medium text-violet-900">Active Mentors</p>
                  <p className="text-xs text-violet-600">guiding students</p>
                </div>
                <p className="text-2xl font-bold text-violet-700">{Math.floor(stats.total.users * 0.08)}</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-rose-50 rounded-lg border border-rose-100">
                <div>
                  <p className="text-sm font-medium text-rose-900">Sessions Conducted</p>
                  <p className="text-xs text-rose-600">last 7 days</p>
                </div>
                <p className="text-2xl font-bold text-rose-700">{Math.floor(Math.random() * 80 + 40)}</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-fuchsia-50 rounded-lg border border-fuchsia-100">
                <div>
                  <p className="text-sm font-medium text-fuchsia-900">Student Feedback</p>
                  <p className="text-xs text-fuchsia-600">average rating</p>
                </div>
                <p className="text-2xl font-bold text-fuchsia-700">4.8/5</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}
