'use client'

import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import {
  Users, FolderOpen, ShoppingCart, Package,
  TrendingUp, RefreshCw, AlertCircle
} from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

async function authHeader() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') || '' : ''
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

interface Stats {
  total: { users: number; projects: number; orders: number; products: number }
  new:   { users: number; projects: number; orders: number }
}

function StatCard({
  label, total, newCount, icon, color
}: {
  label: string; total: number; newCount?: number
  icon: React.ReactNode; color: string
}) {
  return (
    <Card className="border-0 shadow-sm p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{total.toLocaleString('en-IN')}</p>
          {newCount !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs text-green-600 font-medium">+{newCount} this week</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          {icon}
        </div>
      </div>
    </Card>
  )
}

function SkeletonCard() {
  return (
    <Card className="border-0 shadow-sm p-6 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-gray-100 rounded w-24" />
          <div className="h-8 bg-gray-100 rounded w-16" />
          <div className="h-3 bg-gray-100 rounded w-28" />
        </div>
        <div className="h-12 w-12 bg-gray-100 rounded-xl" />
      </div>
    </Card>
  )
}

export default function AnalyticsPage() {
  const [stats,   setStats]   = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API_BASE}/admin/stats`, { headers: await authHeader() })
      if (!res.ok) throw new Error(`${res.status}`)
      setStats(await res.json())
    } catch (e) {
      setError('Could not load stats — check backend connection')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const cards = stats ? [
    { label: 'Total Users',    total: stats.total.users,    newCount: stats.new.users,    icon: <Users className="h-5 w-5 text-blue-600" />,   color: 'bg-blue-50'   },
    { label: 'Total Projects', total: stats.total.projects, newCount: stats.new.projects, icon: <FolderOpen className="h-5 w-5 text-purple-600" />, color: 'bg-purple-50' },
    { label: 'Total Orders',   total: stats.total.orders,   newCount: stats.new.orders,   icon: <ShoppingCart className="h-5 w-5 text-green-600" />,  color: 'bg-green-50'  },
    { label: 'Total Products', total: stats.total.products, newCount: undefined,          icon: <Package className="h-5 w-5 text-amber-600" />,   color: 'bg-amber-50'  },
  ] : []

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="text-sm text-gray-500 mt-1">Platform overview — last 7 days vs all time</p>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading
            ? Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)
            : cards.map(c => <StatCard key={c.label} {...c} />)
          }
        </div>

        {stats && (
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="font-semibold text-gray-800 text-sm">New This Week</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {[
                { label: 'New Users',    value: stats.new.users,    icon: <Users className="h-4 w-4 text-blue-500" />,   pct: stats.total.users    ? Math.round(stats.new.users    / stats.total.users    * 100) : 0 },
                { label: 'New Projects', value: stats.new.projects, icon: <FolderOpen className="h-4 w-4 text-purple-500" />, pct: stats.total.projects ? Math.round(stats.new.projects / stats.total.projects * 100) : 0 },
                { label: 'New Orders',   value: stats.new.orders,   icon: <ShoppingCart className="h-4 w-4 text-green-500" />,  pct: stats.total.orders   ? Math.round(stats.new.orders   / stats.total.orders   * 100) : 0 },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-4 px-6 py-4">
                  <div className="flex items-center gap-3 w-40">
                    {row.icon}
                    <span className="text-sm text-gray-700">{row.label}</span>
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(row.pct, 100)}%` }} />
                  </div>
                  <div className="flex items-center gap-3 w-24 text-right justify-end">
                    <span className="text-sm font-semibold text-gray-900">+{row.value}</span>
                    <span className="text-xs text-gray-400">{row.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <p className="text-xs text-gray-400 text-center">
          Stats pulled live from database · Revenue and deeper charts coming soon
        </p>
      </div>
    </AdminLayout>
  )
}
