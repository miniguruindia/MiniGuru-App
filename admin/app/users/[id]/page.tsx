'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AdminLayout } from '@/components/AdminLayout'
import { UserDetails } from '@/components/user/UserDetails'
import { UserEditForm } from '@/components/user/UserEditForm'
import { Button } from "@/components/ui/button"
import { SkeletonCard } from '@/components/SkeletonCard'    
import { ErrorDisplay } from '@/components/ErrorDisplay'  // Import the ErrorDisplay component
import { User } from '@/types/users'

// BUGFIX (Aug 2026): this page used to import fetchUserDetails/updateUserDetails
// from '@/utils/api/userApi', which (along with apiClient.ts and auth.ts) is
// marked "use server" — every call routed browser → Vercel server function →
// backend → back through Vercel → browser, an extra hop that made this page
// slow to load. The People Directory LIST view hit and fixed the exact same
// bug back on July 29, 2026, but only for its own component — the detail
// page reached by clicking into an individual user from that list was
// missed. Fixed the same way: read the (deliberately non-httpOnly) auth
// cookie directly and fetch the backend straight from the browser.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

function authToken(): string {
  const m = document.cookie.match(/(?:^|; )auth_token=([^;]*)/)
  return m ? decodeURIComponent(m[1]) : ''
}

async function fetchUserDetails(userId: string): Promise<User> {
  const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
    headers: { Authorization: `Bearer ${authToken()}` },
  })
  if (res.status === 404) throw new Error(`User with ID ${userId} not found`)
  if (res.status === 403) throw new Error(`Access to user ID ${userId} is forbidden`)
  if (!res.ok) throw new Error(`Failed to load user (${res.status})`)
  const data = await res.json()
  return data.user
}

async function updateUserDetails(userId: string, updates: Partial<User>): Promise<User> {
  const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${authToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (res.status === 404) throw new Error(`User with ID ${userId} not found`)
  if (res.status === 403) throw new Error(`Access to user ID ${userId} is forbidden`)
  if (!res.ok) throw new Error('An error occurred while updating user details')
  return res.json()
}

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchUser = async (id: string) => {
      try {
        setLoading(true)
        setError(null)  // Reset any previous errors
        const foundUser = await fetchUserDetails(id)
        setUser(foundUser || null) // If no user found, set to null
      } catch (error) {
        setError(error.message || 'Error fetching user details.')
      } finally {
        setLoading(false)
      }
    }

    if (params?.id) {
      fetchUser(params.id.toString()) // Pass the param ID to fetchUser
    }
  }, [params.id])

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-4">
          {/* Show Skeleton while loading */}
          <SkeletonCard />
        </div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
        <ErrorDisplay message={error} />
      </AdminLayout>
    )
  }

  if (!user) {
    return (
      <AdminLayout>
        <div>User not found</div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <Button onClick={() => router.back()}>Back</Button>
        <h1 className="text-3xl font-bold">User Details</h1>
        {isEditing ? (
          <UserEditForm
            user={user}
            onSave={handleSave}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <>
            <UserDetails user={user} />
            <Button onClick={() => setIsEditing(true)}>Edit User</Button>
          </>
        )}
      </div>
    </AdminLayout>
  )

  // Function to handle saving the edited user data
  async function handleSave(updatedUser: User) {
    setUser(updatedUser)
    // Extract the fields to update by comparing updatedUser with user
    const updatesToUser: Partial<User> = {}
    for (const key in updatedUser) {
      if (updatedUser[key] !== user[key]) {
      updatesToUser[key] = updatedUser[key]
      }
    }

    try {
      const res= await updateUserDetails(user.id, updatesToUser);
      console.log(res)
      setIsEditing(false)
    } catch (error) {
      setError(error.message || 'Error updating user details.')
    }
  }
}
