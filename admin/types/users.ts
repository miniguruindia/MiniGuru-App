export interface Wallet {
  id: string;
  userId: string | null;
  balance: number;
}

export interface ScoreHistory {
  time: string;
  updatedScore: number;
}

export interface Project {
  id: string;
  title: string;
  status?: string;
}

export interface OrderProduct {
  productId: string;
  quantity: number;
}

export interface UserOrder {
  id: string;
  totalAmount: number;
  paymentStatus: string;
  fulfillmentStatus: string;
  courierName: string | null;
  trackingNumber: string | null;
  estimatedDelivery: string | null;
  deliveryAddress: string | null;
  createdAt: string;
  products: OrderProduct[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  age: number;
  role: 'USER' | 'ADMIN' | 'SUPERADMIN';
  createdAt: string;
  updatedAt: string;
  score: number;
  wallet: Wallet;
  scoreHistory: ScoreHistory[];
  phoneNumber: string;
  projects: Project[];
  totalProjects: number;
  profilePhoto?: string | null;
  orders?: UserOrder[];
}
