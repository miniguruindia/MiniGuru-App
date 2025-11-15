import { useState } from 'react'
import { User } from '@/types/users'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface UserEditFormProps {
  user: User;
  onSave: (updatedUser: User) => void;
  onCancel: () => void;
}

export function UserEditForm({ user, onSave, onCancel }: UserEditFormProps) {
  const [editedUser, setEditedUser] = useState(user)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setEditedUser(prev => ({ ...prev, [name]: value }))
  }

  const handleRoleChange = (value: string) => {
    setEditedUser(prev => ({ ...prev, role: value as 'USER' | 'ADMIN' }))
  }

  // const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const balance = parseFloat(e.target.value)
  //   setEditedUser(prev => ({ ...prev, wallet: { ...prev.wallet, balance } }))
  // }

  const validate = () => {
    const newErrors: { [key: string]: string } = {}
    if (!editedUser.name) newErrors.name = "Name is required"
    if (!editedUser.email) newErrors.email = "Email is required"
    if (!editedUser.age || editedUser.age <= 0) newErrors.age = "Age must be a positive number"
    if (!editedUser.phoneNumber) newErrors.phoneNumber = "Phone number is required"
    if (!editedUser.score || editedUser.score < 0) newErrors.score = "Score must be a non-negative number"
    if (!editedUser.wallet || editedUser.wallet.balance < 0) newErrors.walletBalance = "Wallet balance must be a non-negative number"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) {
      onSave(editedUser)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit User: {user.name}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" value={editedUser.name} onChange={handleChange} />
            {errors.name && <p className="text-red-500">{errors.name}</p>}
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" value={editedUser.email} onChange={handleChange} />
            {errors.email && <p className="text-red-500">{errors.email}</p>}
          </div>
          <div>
            <Label htmlFor="age">Age</Label>
            <Input id="age" name="age" type="number" value={editedUser.age} onChange={handleChange} />
            {errors.age && <p className="text-red-500">{errors.age}</p>}
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Select onValueChange={handleRoleChange} defaultValue={editedUser.role}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <Input id="phoneNumber" name="phoneNumber" value={editedUser.phoneNumber} onChange={handleChange} />
            {errors.phoneNumber && <p className="text-red-500">{errors.phoneNumber}</p>}
          </div>
          <div>
            <Label htmlFor="score">Score</Label>
            <Input id="score" name="score" type="number" value={editedUser.score} onChange={handleChange} />
            {errors.score && <p className="text-red-500">{errors.score}</p>}
          </div>
          {/* <div>
            <Label htmlFor="walletBalance">Wallet Balance</Label>
            <Input id="walletBalance" name="walletBalance" type="number" value={editedUser.wallet.balance} onChange={handleBalanceChange} />
            {errors.walletBalance && <p className="text-red-500">{errors.walletBalance}</p>}
          </div> */}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit">Save Changes</Button>
        </CardFooter>
      </form>
    </Card>
  )
}

