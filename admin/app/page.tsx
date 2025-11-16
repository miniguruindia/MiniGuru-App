"use client"
import { AdminLayout } from '@/components/AdminLayout'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getStats } from '@/utils/api/stats'
import { useEffect, useState } from 'react'

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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        setError('Failed to fetch stats')
      }
    }
    fetchStats()
  }, [])

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      {error && <p className="text-red-500">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats.total.users}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats.total.projects}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats.total.orders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats.total.products}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>New Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats.new.users}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>New Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats.new.projects}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>New Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats.new.orders}</p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
