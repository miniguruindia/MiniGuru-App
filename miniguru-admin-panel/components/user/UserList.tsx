import { useState } from 'react'
import { User } from '@/types/users'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from 'next/link'


interface UserListProps {

  users: User[];

  onViewDetails?: (userId: string) => void;

  onEditUser?: (userId: string) => void;

  onDeleteUser?: (userId: string) => void;
}

export function UserList({ users, onDeleteUser }: UserListProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <Input
        type="text"
        placeholder="Search users by name"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="max-w-sm"
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredUsers.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                <div className="space-x-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/users/${user.id}`}>View</Link>
                  </Button>
                  <Button variant="destructive" size="sm" className="border-black " onClick={() => onDeleteUser(user.id)}>Delete</Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

