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
import { fetchUserDetails , updateUserDetails } from '@/utils/api/userApi'

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
