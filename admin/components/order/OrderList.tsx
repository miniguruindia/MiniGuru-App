"use client";
import { useState } from 'react';
import { Order, FulfillmentStatus } from '@/types/order';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrderDetails } from '@/components/order/OrderDetails';

interface OrderListProps {
  orders: Order[];
}

const STATUS_COLORS: Record<FulfillmentStatus, string> = {
  PENDING_DISPATCH: 'bg-yellow-100 text-yellow-800',
  DISPATCHED: 'bg-blue-100 text-blue-800',
  DELIVERED: 'bg-green-100 text-green-800',
};

const STATUS_LABELS: Record<FulfillmentStatus, string> = {
  PENDING_DISPATCH: 'Pending Dispatch',
  DISPATCHED: 'Dispatched',
  DELIVERED: 'Delivered',
};

export function OrderList({ orders: initialOrders }: OrderListProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const handleOrderUpdated = (updated: Order) => {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
    setSelectedOrder(updated);
  };

  const filtered = orders.filter(order => {
    const matchesSearch =
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.user.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || order.fulfillmentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <Input
          type="text"
          placeholder="Search by order ID or customer name"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded px-3 py-2 text-sm bg-white"
        >
          <option value="ALL">All Statuses</option>
          <option value="PENDING_DISPATCH">Pending Dispatch</option>
          <option value="DISPATCHED">Dispatched</option>
          <option value="DELIVERED">Delivered</option>
        </select>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order ID</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Fulfillment</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((order) => {
            const fs = order.fulfillmentStatus ?? 'PENDING_DISPATCH';
            return (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-xs">{order.id.slice(-8).toUpperCase()}</TableCell>
                <TableCell>{order.user.name}</TableCell>
                <TableCell>Rs.{order.totalAmount.toFixed(2)}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    order.paymentStatus === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>{order.paymentStatus}</span>
                </TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[fs]}`}>
                    {STATUS_LABELS[fs]}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {new Date(order.createdAt).toLocaleDateString('en-IN')}
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => setSelectedOrder(order)}>
                    {fs === 'PENDING_DISPATCH' ? 'Dispatch' : 'View'}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-gray-400 py-8">No orders found.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {selectedOrder && (
        <div className="mt-6 p-4 border rounded shadow-md bg-white">
          <OrderDetails order={selectedOrder} onUpdated={handleOrderUpdated} />
          <Button variant="outline" size="sm" onClick={() => setSelectedOrder(null)} className="mt-4">Close</Button>
        </div>
      )}
    </div>
  );
}
