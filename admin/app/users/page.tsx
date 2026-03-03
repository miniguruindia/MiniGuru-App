'use client'

import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { UserList } from '@/components/user/UserList'
import { User } from '@/types/users'
import { listUsers, deleteUser } from '@/utils/api/userApi'
import { SkeletonCard } from '@/components/SkeletonCard'
import { RefreshCw, WifiOff } from 'lucide-react'

export default function UsersPage() {
  const [users, setUsers]   = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const usersList = await listUsers()
      setUsers(usersList)
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 502 || status === 503) {
        setError('backend_down')
      } else if (status === 403) {
        setError('forbidden')
      } else {
        setError(err?.message || 'unknown')
      }
    } finally {
      setLoading(false)
      setRetrying(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleRetry = () => {
    setRetrying(true)
    fetchUsers()
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteUser(userId)
      setUsers(prev => prev.filter(u => u.id !== userId))
    } catch (err: any) {
      alert('Could not delete user: ' + (err?.message || 'Unknown error'))
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </AdminLayout>
    )
  }

  // ── Error states ────────────────────────────────────────────
  if (error) {
    const isBackendDown = error === 'backend_down'
    const isForbidden   = error === 'forbidden'

    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
            isBackendDown ? 'bg-red-100' : 'bg-amber-100'
          }`}>
            <WifiOff className={`h-8 w-8 ${isBackendDown ? 'text-red-500' : 'text-amber-500'}`} />
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {isBackendDown ? 'Backend Server is Down' :
             isForbidden  ? 'Access Denied'          :
             'Could Not Load Users'}
          </h2>

          <p className="text-gray-500 text-sm mb-2 max-w-sm">
            {isBackendDown
              ? 'The API server returned a 502 error. Your backend is not running or is unreachable.'
              : isForbidden
              ? 'Your admin token does not have permission to view users.'
              : `Error: ${error}`}
          </p>

          {isBackendDown && (
            <div className="mt-2 mb-6 p-4 bg-gray-50 rounded-lg text-left text-sm text-gray-600 max-w-sm">
              <p className="font-semibold mb-1">How to fix:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Go to your backend folder in terminal</li>
                <li>Run <code className="bg-gray-200 px-1 rounded">pm2 status</code> or <code className="bg-gray-200 px-1 rounded">npm run start</code></li>
                <li>Check your <code className="bg-gray-200 px-1 rounded">.env.local</code> API URL is correct</li>
              </ol>
            </div>
          )}

          <button
            onClick={handleRetry}
            disabled={retrying}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      </AdminLayout>
    )
  }

  // ── Success ─────────────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Users</h1>
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      <UserList users={users} onDeleteUser={handleDeleteUser} />
    </AdminLayout>
  )
}