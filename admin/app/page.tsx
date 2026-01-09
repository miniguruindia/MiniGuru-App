'use client'

import { AdminLayout } from '@/components/AdminLayout'
import { Card } from "@/components/ui/card"
import { getStats } from '@/utils/api/stats'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Users, 
  Video, 
  ShoppingCart, 
  TrendingUp, 
  ArrowUpRight,
  IndianRupee,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts'

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState({
    total: { users: 0, projects: 0, orders: 0, products: 0 },
    new: { users: 0, projects: 0, orders: 0 }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const data = await getStats()
        setStats(data)
      } catch (err) {
        console.error('Failed to fetch stats')
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  // Mock data for user growth chart
  const userGrowthData = [
    { month: 'Jan', users: 120 },
    { month: 'Feb', users: 180 },
    { month: 'Mar', users: 250 },
    { month: 'Apr', users: 320 },
    { month: 'May', users: 450 },
    { month: 'Jun', users: stats.total.users || 520 },
  ]

  // Mock data for revenue chart
  const revenueData = [
    { month: 'Jan', revenue: 45000 },
    { month: 'Feb', revenue: 52000 },
    { month: 'Mar', revenue: 61000 },
    { month: 'Apr', revenue: 58000 },
    { month: 'May', revenue: 72000 },
    { month: 'Jun', revenue: 85000 },
  ]

  const mainStats = [
    {
      title: 'Total Users',
      value: stats.total.users,
      newCount: stats.new.users,
      icon: Users,
      gradient: 'from-blue-500 to-cyan-500',
      href: '/users',
      trend: '+12%'
    },
    {
      title: 'Videos',
      value: stats.total.projects,
      newCount: stats.new.projects,
      pendingCount: 0, // Will be dynamic
      icon: Video,
      gradient: 'from-purple-500 to-pink-500',
      href: '/videos',
      trend: '+8%'
    },
    {
      title: 'Orders',
      value: stats.total.orders,
      completedCount: stats.total.orders - stats.new.orders,
      pendingCount: stats.new.orders,
      icon: ShoppingCart,
      gradient: 'from-emerald-500 to-teal-500',
      href: '/orders',
      trend: '+15%'
    },
    {
      title: 'Revenue',
      value: '₹85,000',
      subValue: '₹12,000 pending',
      icon: IndianRupee,
      gradient: 'from-amber-500 to-orange-500',
      href: '/revenue',
      trend: '+23%'
    },
  ]

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {mainStats.map((stat, index) => {
            const Icon = stat.icon
            return (
              <Card
                key={index}
                onClick={() => router.push(stat.href)}
                className="relative overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-0"
              >
                {/* Gradient background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-5`} />
                
                <div className="relative p-6">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} bg-opacity-10`}>
                      <Icon className="h-6 w-6 text-gray-700" />
                    </div>
                    <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                      <TrendingUp className="h-4 w-4" />
                      {stat.trend}
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-medium text-gray-600 mb-1">
                    {stat.title}
                  </h3>

                  {/* Main Value */}
                  <div className="flex items-baseline gap-2 mb-3">
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                    {stat.newCount > 0 && (
                      <span className="text-sm font-medium text-green-600">
                        +{stat.newCount} new
                      </span>
                    )}
                  </div>

                  {/* Sub Stats */}
                  <div className="flex gap-4 text-sm">
                    {stat.completedCount !== undefined && (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span>{stat.completedCount} done</span>
                      </div>
                    )}
                    {stat.pendingCount !== undefined && stat.pendingCount > 0 && (
                      <div className="flex items-center gap-1 text-amber-600">
                        <Clock className="h-4 w-4" />
                        <span>{stat.pendingCount} pending</span>
                      </div>
                    )}
                    {stat.subValue && (
                      <div className="text-gray-500">{stat.subValue}</div>
                    )}
                  </div>

                  {/* Click indicator */}
                  <ArrowUpRight className="absolute bottom-4 right-4 h-5 w-5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Card>
            )
          })}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* User Growth Chart */}
          <Card className="p-6 border-0 shadow-md">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">User Growth</h3>
                <p className="text-sm text-gray-500">Monthly active users</p>
              </div>
              <button
                onClick={() => router.push('/analytics')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View Details →
              </button>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={userGrowthData}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="month" 
                  stroke="#9ca3af"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#9ca3af"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="users" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorUsers)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Revenue Chart */}
          <Card className="p-6 border-0 shadow-md">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Revenue Overview</h3>
                <p className="text-sm text-gray-500">Monthly earnings</p>
              </div>
              <button
                onClick={() => router.push('/revenue')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View Details →
              </button>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="month" 
                  stroke="#9ca3af"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#9ca3af"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => `₹${value/1000}k`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                  formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Revenue']}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#f59e0b" 
                  strokeWidth={3}
                  dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="p-6 border-0 shadow-md">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => router.push('/videos')}
              className="p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
            >
              <AlertCircle className="h-5 w-5 text-amber-600 mb-2" />
              <p className="font-medium text-gray-900">Pending Approvals</p>
              <p className="text-sm text-gray-500">0 videos to review</p>
            </button>
            <button
              onClick={() => router.push('/orders')}
              className="p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
            >
              <Clock className="h-5 w-5 text-blue-600 mb-2" />
              <p className="font-medium text-gray-900">Pending Orders</p>
              <p className="text-sm text-gray-500">{stats.new.orders} to process</p>
            </button>
            <button
              onClick={() => router.push('/users')}
              className="p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
            >
              <Users className="h-5 w-5 text-purple-600 mb-2" />
              <p className="font-medium text-gray-900">New Users</p>
              <p className="text-sm text-gray-500">{stats.new.users} this month</p>
            </button>
            <button
              onClick={() => router.push('/analytics')}
              className="p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
            >
              <TrendingUp className="h-5 w-5 text-green-600 mb-2" />
              <p className="font-medium text-gray-900">View Analytics</p>
              <p className="text-sm text-gray-500">Detailed reports</p>
            </button>
          </div>
        </Card>
      </div>
    </AdminLayout>
  )
}