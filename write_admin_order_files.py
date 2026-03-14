types_content = '''export interface OrderProduct {
  productId: string;
  quantity: number;
}

export interface User {
  name: string;
  email: string;
}

export interface Transaction {
  id: string;
  walletId: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  status: string | null;
  createdAt: string;
}

export type FulfillmentStatus = 'PENDING_DISPATCH' | 'DISPATCHED' | 'DELIVERED';

export interface Order {
  id: string;
  userId: string;
  totalAmount: number;
  paymentStatus: 'COMPLETED' | 'PENDING' | 'FAILED';
  fulfillmentStatus: FulfillmentStatus;
  courierName: string | null;
  trackingNumber: string | null;
  estimatedDelivery: string | null;
  dispatchedAt: string | null;
  createdAt: string;
  updatedAt: string;
  transactionId: string;
  deliveryAddress: string | null;
  products: OrderProduct[];
  user: User;
  transaction: Transaction;
}
'''

api_content = '''"use server"
import { Order } from "@/types/order";
import { apiClient } from "@/utils/api/apiClient";
import { NotFoundError, ForbiddenError, ServiceError } from './error';

export const getAllOrders = async (): Promise<Order[]> => {
  try {
    const response = await apiClient.get('/admin/orders');
    return response.data;
  } catch (error) {
    handleError(error);
  }
}

export const updateDispatch = async (
  orderId: string,
  data: {
    fulfillmentStatus: string;
    courierName: string;
    trackingNumber: string;
    estimatedDelivery?: string;
  }
): Promise<Order> => {
  try {
    const response = await apiClient.patch(`/admin/orders/${orderId}/dispatch`, data);
    return response.data;
  } catch (error) {
    handleError(error);
  }
}

const handleError = (error): never => {
  if (error.response) {
    switch (error.response.status) {
      case 404: throw new NotFoundError('Order not found');
      case 403: throw new ForbiddenError('Access is forbidden');
      default: throw new ServiceError('An unexpected error occurred');
    }
  }
  throw new ServiceError('An error occurred while processing the request');
};
'''

details_content = '''"use client";
import { useState, useEffect } from 'react';
import { Order, FulfillmentStatus } from '@/types/order';
import { Product } from '@/types/product';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getProductById } from '@/utils/api/productApi';
import { updateDispatch } from '@/utils/api/orderApi';

interface OrderDetailsProps {
  order: Order;
  onUpdated?: (updated: Order) => void;
}

const STATUS_LABELS: Record<FulfillmentStatus, string> = {
  PENDING_DISPATCH: 'Pending Dispatch',
  DISPATCHED: 'Dispatched',
  DELIVERED: 'Delivered',
};

const STATUS_COLORS: Record<FulfillmentStatus, string> = {
  PENDING_DISPATCH: 'bg-yellow-100 text-yellow-800',
  DISPATCHED: 'bg-blue-100 text-blue-800',
  DELIVERED: 'bg-green-100 text-green-800',
};

export function OrderDetails({ order, onUpdated }: OrderDetailsProps) {
  const [productNames, setProductNames] = useState<{ [key: string]: string }>({});
  const [isDispatchOpen, setIsDispatchOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [courierName, setCourierName] = useState(order.courierName ?? '');
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber ?? '');
  const [estimatedDelivery, setEstimatedDelivery] = useState(
    order.estimatedDelivery ? order.estimatedDelivery.slice(0, 10) : ''
  );
  const [fulfillmentStatus, setFulfillmentStatus] = useState<FulfillmentStatus>(
    order.fulfillmentStatus ?? 'PENDING_DISPATCH'
  );

  useEffect(() => {
    const fetchProductNames = async () => {
      const map: { [key: string]: string } = {};
      await Promise.all(order.products.map(async (p) => {
        try {
          const details: Product = await getProductById(p.productId);
          map[p.productId] = details.name;
        } catch {
          map[p.productId] = 'Unknown Product';
        }
      }));
      setProductNames(map);
    };
    fetchProductNames();
  }, [order.products]);

  const handleDispatchSave = async () => {
    if (!courierName || !trackingNumber) {
      setSaveError('Courier name and tracking number are required.');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updated = await updateDispatch(order.id, {
        fulfillmentStatus,
        courierName,
        trackingNumber,
        estimatedDelivery: estimatedDelivery || undefined,
      });
      setSaveSuccess(true);
      setIsDispatchOpen(false);
      if (onUpdated) onUpdated(updated);
    } catch (err) {
      setSaveError('Failed to save dispatch details. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const fs = order.fulfillmentStatus ?? 'PENDING_DISPATCH';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Order: {order.id.slice(-8).toUpperCase()}</span>
          <span className={`text-sm px-3 py-1 rounded-full font-medium ${STATUS_COLORS[fs]}`}>
            {STATUS_LABELS[fs]}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div>
          <h3 className="font-semibold text-sm text-gray-500 mb-1">Customer</h3>
          <p>{order.user.name} — {order.user.email}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold text-sm text-gray-500 mb-1">Total Amount</h3>
            <p className="text-lg font-bold">Rs.{order.totalAmount.toFixed(2)}</p>
          </div>
          <div>
            <h3 className="font-semibold text-sm text-gray-500 mb-1">Payment</h3>
            <span className={`text-sm px-2 py-1 rounded-full ${
              order.paymentStatus === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>{order.paymentStatus}</span>
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-sm text-gray-500 mb-1">Delivery Address</h3>
          <p>{order.deliveryAddress ?? 'Not provided'}</p>
        </div>
        <div>
          <h3 className="font-semibold text-sm text-gray-500 mb-1">Products</h3>
          <ul className="space-y-1">
            {order.products.map((p) => (
              <li key={p.productId} className="flex justify-between text-sm">
                <span>{productNames[p.productId] ?? 'Loading...'}</span>
                <span className="text-gray-500">x{p.quantity}</span>
              </li>
            ))}
          </ul>
        </div>
        {order.courierName && (
          <div className="bg-blue-50 rounded-lg p-3 space-y-1 text-sm">
            <h3 className="font-semibold text-blue-800 mb-2">Dispatch Details</h3>
            <p><span className="text-gray-500">Courier:</span> {order.courierName}</p>
            <p><span className="text-gray-500">Tracking:</span> {order.trackingNumber}</p>
            {order.estimatedDelivery && (
              <p><span className="text-gray-500">Est. Delivery:</span> {new Date(order.estimatedDelivery).toLocaleDateString('en-IN')}</p>
            )}
            {order.dispatchedAt && (
              <p><span className="text-gray-500">Dispatched:</span> {new Date(order.dispatchedAt).toLocaleDateString('en-IN')}</p>
            )}
          </div>
        )}
        {saveSuccess && (
          <p className="text-green-600 text-sm font-medium">Dispatch details saved successfully.</p>
        )}
        <Button variant="outline" onClick={() => setIsDispatchOpen(!isDispatchOpen)} className="w-full">
          {isDispatchOpen ? 'Cancel' : order.courierName ? 'Update Dispatch Details' : 'Fill Dispatch Details'}
        </Button>
        {isDispatchOpen && (
          <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
            <h3 className="font-semibold text-sm">Dispatch Details</h3>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Status</label>
              <select
                value={fulfillmentStatus}
                onChange={(e) => setFulfillmentStatus(e.target.value as FulfillmentStatus)}
                className="w-full border rounded px-3 py-2 text-sm bg-white"
              >
                <option value="PENDING_DISPATCH">Pending Dispatch</option>
                <option value="DISPATCHED">Dispatched</option>
                <option value="DELIVERED">Delivered</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Courier Name *</label>
              <Input placeholder="e.g. Delhivery, BlueDart, DTDC" value={courierName} onChange={(e) => setCourierName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tracking Number *</label>
              <Input placeholder="e.g. DL1234567890" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Estimated Delivery Date</label>
              <Input type="date" value={estimatedDelivery} onChange={(e) => setEstimatedDelivery(e.target.value)} />
            </div>
            {saveError && <p className="text-red-500 text-sm">{saveError}</p>}
            <Button onClick={handleDispatchSave} disabled={isSaving} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              {isSaving ? 'Saving...' : 'Save Dispatch Details'}
            </Button>
          </div>
        )}
        <div className="text-xs text-gray-400 pt-2 border-t">
          <p>Transaction: {order.transaction.id}</p>
          <p>Ordered: {new Date(order.createdAt).toLocaleString('en-IN')}</p>
        </div>
      </CardContent>
    </Card>
  );
}
'''

list_content = '''"use client";
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
'''

with open('/workspaces/MiniGuru-App/admin/types/order.ts', 'w') as f:
    f.write(types_content)
print("types/order.ts written")

with open('/workspaces/MiniGuru-App/admin/utils/api/orderApi.ts', 'w') as f:
    f.write(api_content)
print("utils/api/orderApi.ts written")

with open('/workspaces/MiniGuru-App/admin/components/order/OrderDetails.tsx', 'w') as f:
    f.write(details_content)
print("components/order/OrderDetails.tsx written")

with open('/workspaces/MiniGuru-App/admin/components/order/OrderList.tsx', 'w') as f:
    f.write(list_content)
print("components/order/OrderList.tsx written")

print("\nAll files written successfully!")
