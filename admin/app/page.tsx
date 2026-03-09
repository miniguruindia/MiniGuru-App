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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

async function authHeader() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') || '' : ''
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
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
  const [lastRefreshed, setLastRefreshed] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const headers = await authHeader()
      const [statsRes, ordersRes] = await Promise.all([
        fetch(`${API_BASE}/admin/stats`,  { headers }),
        fetch(`${API_BASE}/admin/orders`, { headers }),
      ])
      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats({
          total: { ...DEFAULT_STATS.total, ...(data?.total ?? {}) },
          new:   { ...DEFAULT_STATS.new,   ...(data?.new   ?? {}) },
        })
      }
      if (ordersRes.ok) setOrders(await ordersRes.json())
    } catch (e) { console.error('Dashboard fetch failed:', e) }
    finally { setLoading(false); setLastRefreshed(new Date().toLocaleTimeString('en-IN')) }
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

        <Card className="p-6 border-0 shadow-md">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button onClick={() => router.push('/videos')} className="p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left">
              <AlertCircle className="h-5 w-5 text-amber-600 mb-2" />
              <p className="font-medium text-gray-900 text-sm">Video Approvals</p>
              <p className="text-xs text-gray-500 mt-0.5">Review pending videos</p>
            </button>
            <button onClick={() => router.push('/orders')} className="p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left">
              <Clock className="h-5 w-5 text-blue-600 mb-2" />
              <p className="font-medium text-gray-900 text-sm">Pending Orders</p>
              <p className="text-xs text-gray-500 mt-0.5">{stats.new.orders} to process</p>
            </button>
            <button onClick={() => router.push('/users')} className="p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left">
              <Users className="h-5 w-5 text-purple-600 mb-2" />
              <p className="font-medium text-gray-900 text-sm">New Users</p>
              <p className="text-xs text-gray-500 mt-0.5">{stats.new.users} this week</p>
            </button>
            <button onClick={() => router.push('/communication')} className="p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left">
              <TrendingUp className="h-5 w-5 text-green-600 mb-2" />
              <p className="font-medium text-gray-900 text-sm">Communication</p>
              <p className="text-xs text-gray-500 mt-0.5">Inbox & broadcasts</p>
            </button>
          </div>
        </Card>
      </div>
    </AdminLayout>
  )
}
