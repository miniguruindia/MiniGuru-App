'use client'

import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { UserList } from '@/components/user/UserList'
import { User } from '@/types/users'
import { listUsers, deleteUser } from '@/utils/api/userApi'
import { SkeletonCard } from '@/components/SkeletonCard' // Import Skeleton component
import { ErrorDisplay } from '@/components/ErrorDisplay' // Import Error Display component

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const usersList = await listUsers();
        setUsers(usersList);
      } catch (error) {
        setError('An error occurred while fetching users.'+error.message
        );
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleDeleteUser = async (userId: string) => { 
    try {
      await deleteUser(userId);
    } catch (error) {
      setError('An error occurred while deleting the user.' + error.message);
      return;
    }
    setUsers(users.filter(user => user.id !== userId));
  };

  if (loading) {
    return (
      <AdminLayout>
        {/* Show skeleton loaders while data is loading */}
        <div className="space-y-4">
          {[...Array(5)].map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <ErrorDisplay message={error} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-6">Users</h1>
      <UserList users={users} onDeleteUser={handleDeleteUser} />
    </AdminLayout>
  );
}
