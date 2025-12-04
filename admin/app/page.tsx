"use client"

import { AdminLayout } from '@/components/AdminLayout'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getStats } from '@/utils/api/stats'
import { useEffect, useState } from 'react'
import { Users, FolderKanban, ShoppingCart, Package, TrendingUp, TrendingDown, Activity } from 'lucide-react'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    total: { users: 0, projects: 0, orders: 0, products: 0 },
    new: { users: 0, projects: 0, orders: 0 }
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        const data = await getStats()
        setStats(data)
      } catch (err) {
        setError('Failed to fetch stats')
      }
    }
    fetchStats()
  }, [])

  const statCards = [
    {
      title: 'Total Users',
      value: stats.total.users,
      change: stats.new.users,
      icon: Users,
      gradient: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600'
    },
    {
      title: 'Total Projects',
      value: stats.total.projects,
      change: stats.new.projects,
      icon: FolderKanban,
      gradient: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-50',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600'
    },
    {
      title: 'Total Orders',
      value: stats.total.orders,
      change: stats.new.orders,
      icon: ShoppingCart,
      gradient: 'from-pink-500 to-rose-500',
      bgColor: 'bg-pink-50',
      iconBg: 'bg-pink-100',
      iconColor: 'text-pink-600'
    },
    {
      title: 'Total Products',
      value: stats.total.products,
      change: 0,
      icon: Package,
      gradient: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-50',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600'
    },
  ]

  const newItems = [
    { label: 'New Users', value: stats.new.users, icon: Users, color: 'text-blue-600' },
    { label: 'New Projects', value: stats.new.projects, icon: FolderKanban, color: 'text-purple-600' },
    { label: 'New Orders', value: stats.new.orders, icon: ShoppingCart, color: 'text-pink-600' },
  ]

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-gray-500 mt-1">Welcome back! Here's what's happening today.</p>
          </div>
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
            <Activity className="h-5 w-5 text-green-600 animate-pulse" />
            <span className="text-sm font-medium text-green-700">System Active</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, index) => {
            const Icon = stat.icon
            const isPositive = stat.change > 0
            
            return (
              <Card 
                key={index} 
                className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                {/* Gradient Top Bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.gradient}`} />
                
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-3 rounded-xl ${stat.iconBg}`}>
                    <Icon className={`h-5 w-5 ${stat.iconColor}`} />
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="flex items-end justify-between">
                    <p className="text-4xl font-bold text-gray-800">{stat.value}</p>
                    {stat.change > 0 && (
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        <span className="text-xs font-semibold">+{stat.change}</span>
                      </div>
                    )}
                  </div>
                  {stat.change > 0 && (
                    <p className="text-xs text-gray-500 mt-2">New this month</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {newItems.map((item, index) => {
            const Icon = item.icon
            return (
              <Card key={index} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Icon className={`h-5 w-5 ${item.color}`} />
                    </div>
                    <CardTitle className="text-lg">{item.label}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-5xl font-bold bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent">
                    {item.value}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">Recently added</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Quick Stats Bar */}
        <Card className="border-0 shadow-md bg-gradient-to-r from-gray-50 to-gray-100">
          <CardContent className="py-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-800">{stats.total.users + stats.total.projects}</p>
                <p className="text-sm text-gray-600">Total Items</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-800">{stats.new.users + stats.new.projects + stats.new.orders}</p>
                <p className="text-sm text-gray-600">New Today</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{stats.total.orders}</p>
                <p className="text-sm text-gray-600">Completed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{stats.total.products}</p>
                <p className="text-sm text-gray-600">Available</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
