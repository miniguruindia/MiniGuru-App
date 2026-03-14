export interface OrderProduct {
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
