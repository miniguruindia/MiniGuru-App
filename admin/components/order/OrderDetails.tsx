import { useState, useEffect } from 'react';
import { Order,  } from '@/types/order';
import { Product } from '@/types/product';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProductById } from '@/utils/api/productApi';

interface OrderDetailsProps {
  order: Order;
}

export function OrderDetails({ order }: OrderDetailsProps) {
  const [productNames, setProductNames] = useState<{ [key: string]: string }>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProductNames = async () => {
      const productNamesMap: { [key: string]: string } = {};
      
      await Promise.all(order.products.map(async (product) => {
        try {
          const productDetails: Product = await getProductById(product.productId);
          productNamesMap[product.productId] = productDetails.name;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) {
          productNamesMap[product.productId] = 'Unknown Product';
          setError('Failed to fetch some product details');
        }
      }));
      
      setProductNames(productNamesMap);
    };

    fetchProductNames();
  }, [order.products]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Details: {order.id}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div>
            <h3 className="font-semibold">Customer</h3>
            <p>{order.user.name} ({order.user.email})</p>
          </div>
          <div>
            <h3 className="font-semibold">Total Amount</h3>
            <p>₹{order.totalAmount.toFixed(2)}</p>
          </div>
          <div>
            <h3 className="font-semibold">Payment Status</h3>
            <p>{order.paymentStatus}</p>
          </div>
          <div>
            <h3 className="font-semibold">Delivery Address</h3>
            <p>{order.deliveryAddress}</p>
          </div>
          <div>
            <h3 className="font-semibold">Products</h3>
            {error && <p className="text-red-500">{error}</p>}
            <ul>
              {order.products.map((product) => (
                <li key={product.productId}>
                  Product: {productNames[product.productId] || 'Loading...'}, Quantity: {product.quantity}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold">Transaction Details</h3>
            <p>Transaction ID: {order.transaction.id}</p>
            <p>Amount: ₹{order.transaction.amount.toFixed(2)}</p>
            <p>Type: {order.transaction.type}</p>
            <p>Status: {order.transaction.status}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
