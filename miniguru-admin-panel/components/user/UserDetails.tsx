import { User } from '@/types/users'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface UserDetailsProps {
  user: User;
}

export function UserDetails({ user }: UserDetailsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{user.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="font-semibold">Email:</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt className="font-semibold">Age:</dt>
            <dd>{user.age}</dd>
          </div>
          <div>
            <dt className="font-semibold">Role:</dt>
            <dd>{user.role}</dd>
          </div>
          <div>
            <dt className="font-semibold">Phone:</dt>
            <dd>{user.phoneNumber}</dd>
          </div>
          <div>
            <dt className="font-semibold">Score:</dt>
            <dd>{user.score}</dd>
          </div>
          <div>
            <dt className="font-semibold">Total Projects:</dt>
            <dd>{user.totalProjects}</dd>
          </div>
          <div>
            <dt className="font-semibold">Wallet Balance:</dt>
            <dd>₹{user.wallet.balance}</dd>
          </div>
          <div>
            <dt className="font-semibold">Created At:</dt>
            <dd>{new Date(user.createdAt).toLocaleDateString()}</dd>
          </div>
        </dl>
        <div className="mt-4">
        </div>
      </CardContent>
    </Card>
  )
}

