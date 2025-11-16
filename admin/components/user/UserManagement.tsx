import { useState } from 'react'
import { User } from '@/types/users'
import { UserList } from './UserList'
import { UserDetails } from './UserDetails'
import { UserEditForm } from './UserEditForm'
import { ConfirmationDialog } from '../ConfirmationDialog'
import { ErrorDisplay } from '../ErrorDisplay'
import { useErrorHandler } from '../../hooks/useErrorHandler'

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { error, setError, handleError } = useErrorHandler()

  const handleViewDetails = (userId: string) => {
    try {
      const user = users.find(u => u.id === userId)
      if (user) {
        setSelectedUser(user)
        setIsEditing(false)
      } else {
        throw new Error("User not found")
      }
    } catch (error) {
      handleError(error)
    }
  }

  const handleEditUser = (userId: string) => {
    try {
      const user = users.find(u => u.id === userId)
      if (user) {
        setSelectedUser(user)
        setIsEditing(true)
      } else {
        throw new Error("User not found")
      }
    } catch (error) {
      handleError(error)
    }
  }

  const handleDeleteUser = (userId: string) => {
    try {
      const user = users.find(u => u.id === userId)
      if (user) {
        setSelectedUser(user)
        setIsDeleting(true)
      } else {
        throw new Error("User not found")
      }
    } catch (error) {
      handleError(error)
    }
  }

  const handleSaveUser = (updatedUser: User) => {
    try {
      setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u))
      setSelectedUser(updatedUser)
      setIsEditing(false)
    } catch (error) {
      handleError(error)
    }
  }

  const handleConfirmDelete = () => {
    try {
      if (selectedUser) {
        setUsers(users.filter(u => u.id !== selectedUser.id))
        setSelectedUser(null)
        setIsDeleting(false)
      }
    } catch (error) {
      handleError(error)
    }
  }

  const handleCloseDeleteDialog = () => {
    setIsDeleting(false)
  }

  return (
    <div className="container mx-auto p-4 space-y-8">
      <h1 className="text-3xl font-bold">User Management</h1>
      {error && <ErrorDisplay message={error} />}
      <UserList
        users={users}
        onViewDetails={handleViewDetails}
        onEditUser={handleEditUser}
        onDeleteUser={handleDeleteUser}
      />
      {selectedUser && !isEditing && (
        <UserDetails user={selectedUser} />
      )}
      {selectedUser && isEditing && (
        <UserEditForm
          user={selectedUser}
          onSave={handleSaveUser}
          onCancel={() => setIsEditing(false)}
        />
      )}
      <ConfirmationDialog
        isOpen={isDeleting}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        title="Confirm Delete"
        description={`Are you sure you want to delete ${selectedUser?.name}?`}
      />
    </div>
  )
}

