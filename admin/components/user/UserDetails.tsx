"use client";
import { useState } from 'react';
import { User, UserOrder } from '@/types/users';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UserDetailsProps {
  user: User;
}

const FULFILLMENT_COLORS: Record<string, string> = {
  PENDING_DISPATCH: 'bg-yellow-100 text-yellow-800',
  DISPATCHED: 'bg-blue-100 text-blue-800',
  DELIVERED: 'bg-green-100 text-green-800',
};

const FULFILLMENT_LABELS: Record<string, string> = {
  PENDING_DISPATCH: 'Pending Dispatch',
  DISPATCHED: 'Dispatched',
  DELIVERED: 'Delivered',
};

export function UserDetails({ user }: UserDetailsProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'projects' | 'goins'>('overview');

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'orders',   label: `Orders (${user.orders?.length ?? 0})` },
    { id: 'projects', label: `Projects (${user.totalProjects ?? 0})` },
    { id: 'goins',    label: 'Goins History' },
  ] as const;

  return (
    <div className="space-y-6">

      {/* Profile header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              {user.profilePhoto ? (
                <img src={user.profilePhoto} alt={user.name}
                  className="w-20 h-20 rounded-full object-cover border-4 border-white shadow" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center text-3xl font-bold text-indigo-600 shadow">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-bold text-gray-900">{user.name}</h2>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  user.role === 'ADMIN' || user.role === 'SUPERADMIN'
                    ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                }`}>{user.role}</span>
              </div>
              <p className="text-gray-500 text-sm mt-1">{user.email}</p>
              <p className="text-gray-500 text-sm">{user.phoneNumber}</p>
              <p className="text-gray-400 text-xs mt-2">
                Age {user.age} · Joined {new Date(user.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {[
              { label: 'Goins', value: user.score, color: 'bg-amber-50' },
              { label: 'Wallet (₹)', value: `₹${(user.wallet?.balance ?? 0).toFixed(2)}`, color: 'bg-purple-50' },
              { label: 'Projects', value: user.totalProjects ?? 0, color: 'bg-blue-50' },
              { label: 'Orders', value: user.orders?.length ?? 0, color: 'bg-green-50' },
            ].map(s => (
              <div key={s.label} className={`${s.color} rounded-xl p-4 text-center`}>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <Card>
          <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Full Name', value: user.name },
              { label: 'Email', value: user.email },
              { label: 'Phone', value: user.phoneNumber },
              { label: 'Age', value: user.age },
              { label: 'Role', value: user.role },
              { label: 'Goins', value: user.score },
              { label: 'Wallet', value: `₹${(user.wallet?.balance ?? 0).toFixed(2)}` },
              { label: 'Projects', value: user.totalProjects ?? 0 },
              { label: 'Joined', value: new Date(user.createdAt).toLocaleDateString('en-IN') },
              { label: 'User ID', value: user.id },
            ].map(({ label, value }) => (
              <div key={label} className="border-b pb-2">
                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                <p className="text-sm font-medium text-gray-900 break-all">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Orders */}
      {activeTab === 'orders' && (
        <div className="space-y-3">
          {(!user.orders || user.orders.length === 0) ? (
            <Card><CardContent className="py-12 text-center text-gray-400">No orders yet.</CardContent></Card>
          ) : user.orders.map((order: UserOrder) => {
            const fs = order.fulfillmentStatus ?? 'PENDING_DISPATCH';
            return (
              <Card key={order.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-mono text-xs text-gray-400">#{order.id.slice(-8).toUpperCase()}</p>
                      <p className="font-bold text-lg">₹{order.totalAmount.toFixed(2)}</p>
                      <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${FULFILLMENT_COLORS[fs]}`}>
                        {FULFILLMENT_LABELS[fs] ?? fs}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        order.paymentStatus === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>{order.paymentStatus}</span>
                    </div>
                  </div>
                  {order.deliveryAddress && (
                    <p className="text-xs text-gray-500 mt-2">📍 {order.deliveryAddress}</p>
                  )}
                  {order.courierName && (
                    <p className="text-xs text-gray-500 mt-1">
                      🚚 {order.courierName} · {order.trackingNumber}
                      {order.estimatedDelivery && ` · Est. ${new Date(order.estimatedDelivery).toLocaleDateString('en-IN')}`}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Projects */}
      {activeTab === 'projects' && (
        <div className="space-y-2">
          {(!user.projects || user.projects.length === 0) ? (
            <Card><CardContent className="py-12 text-center text-gray-400">No projects yet.</CardContent></Card>
          ) : user.projects.map(p => (
            <Card key={p.id}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{p.title}</p>
                  <p className="text-xs text-gray-400 font-mono">{p.id.slice(-8)}</p>
                </div>
                {p.status && (
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">{p.status}</span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Goins History */}
      {activeTab === 'goins' && (
        <div className="space-y-2">
          {(!user.scoreHistory || user.scoreHistory.length === 0) ? (
            <Card><CardContent className="py-12 text-center text-gray-400">No Goins history yet.</CardContent></Card>
          ) : [...user.scoreHistory].reverse().map((entry, i) => (
            <Card key={i}>
              <CardContent className="py-3 flex items-center justify-between">
                <p className="text-xs text-gray-400">{new Date(entry.time).toLocaleString('en-IN')}</p>
                <p className="font-bold text-amber-600">{entry.updatedScore} Goins</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
