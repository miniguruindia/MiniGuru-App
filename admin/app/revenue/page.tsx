'use client'

import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { Card } from '@/components/ui/card'
import {
  IndianRupee, ShoppingCart, TrendingUp,
  RefreshCw, AlertCircle, CheckCircle, Clock
} from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

async function authHeader() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') || '' : ''
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

interface Order {
  id: string
  totalAmount: number
  paymentStatus: string
  deliveryAddress: string
  createdAt: string
  user: { name: string; email: string }
  products: { productId: string; quantity: number }[]
}

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toUpperCase()
  const styles: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-700',
    PENDING:   'bg-yellow-100 text-yellow-700',
    FAILED:    'bg-red-100 text-red-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[s] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

export default function RevenuePage() {
  const [orders,  setOrders]  = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API_BASE}/admin/orders`, { headers: await authHeader() })
      if (!res.ok) throw new Error(`${res.status}`)
      setOrders(await res.json())
    } catch {
      setError('Could not load orders — check backend connection')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const totalRevenue    = orders.reduce((s, o) => s + (o.totalAmount ?? 0), 0)
  const completedOrders = orders.filter(o => o.paymentStatus?.toUpperCase() === 'COMPLETED')
  const pendingOrders   = orders.filter(o => o.paymentStatus?.toUpperCase() === 'PENDING')
  const completedRev    = completedOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0)
  const cutoff          = new Date(); cutoff.setDate(cutoff.getDate() - 7)
  const recentRevenue   = orders.filter(o => new Date(o.createdAt) >= cutoff).reduce((s, o) => s + (o.totalAmount ?? 0), 0)

  const summaryCards = [
    { label: 'Total Revenue', value: fmt(totalRevenue),           sub: `${orders.length} orders`,             icon: <IndianRupee className="h-5 w-5 text-green-600" />,  color: 'bg-green-50'  },
    { label: 'Completed',     value: fmt(completedRev),           sub: `${completedOrders.length} orders`,    icon: <CheckCircle  className="h-5 w-5 text-blue-600" />,   color: 'bg-blue-50'   },
    { label: 'Pending',       value: fmt(totalRevenue-completedRev), sub: `${pendingOrders.length} orders`,   icon: <Clock        className="h-5 w-5 text-amber-600" />,  color: 'bg-amber-50'  },
    { label: 'Last 7 Days',   value: fmt(recentRevenue),          sub: 'recent revenue',                      icon: <TrendingUp   className="h-5 w-5 text-purple-600" />, color: 'bg-purple-50' },
  ]

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Revenue</h1>
            <p className="text-sm text-gray-500 mt-1">All orders and payment totals</p>
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
          {summaryCards.map(c => (
            <Card key={c.label} className="border-0 shadow-sm p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">{c.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{loading ? '—' : c.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
                </div>
                <div className={`p-3 rounded-xl ${c.color}`}>{c.icon}</div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-gray-400" />
            <h2 className="font-semibold text-gray-800 text-sm">All Orders</h2>
            <span className="ml-auto text-xs text-gray-400">{orders.length} total</span>
          </div>
          {loading ? (
            <div className="divide-y divide-gray-50">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-32" />
                  <div className="h-4 bg-gray-100 rounded w-40 flex-1" />
                  <div className="h-4 bg-gray-100 rounded w-20" />
                  <div className="h-4 bg-gray-100 rounded w-16" />
                  <div className="h-4 bg-gray-100 rounded w-24" />
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <ShoppingCart className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">No orders yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 font-medium border-b border-gray-100">
                    <th className="px-6 py-3">Order ID</th>
                    <th className="px-6 py-3">Customer</th>
                    <th className="px-6 py-3">Items</th>
                    <th className="px-6 py-3">Amount</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.map(o => (
                    <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-gray-400">{o.id.slice(-8).toUpperCase()}</td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-800">{o.user?.name ?? '—'}</p>
                        <p className="text-xs text-gray-400">{o.user?.email ?? ''}</p>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{o.products?.length ?? 0} item{o.products?.length !== 1 ? 's' : ''}</td>
                      <td className="px-6 py-4 font-semibold text-gray-900">{fmt(o.totalAmount ?? 0)}</td>
                      <td className="px-6 py-4"><StatusBadge status={o.paymentStatus} /></td>
                      <td className="px-6 py-4 text-gray-400 text-xs">
                        {new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <p className="text-xs text-gray-400 text-center">
          Revenue figures are based on wallet deductions · Razorpay integration coming soon
        </p>
      </div>
    </AdminLayout>
  )
}
