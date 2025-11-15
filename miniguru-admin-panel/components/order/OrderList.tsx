import { useState } from 'react'
import { Order } from '@/types/order'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { OrderDetails } from '@/components/order/OrderDetails'


interface OrderListProps {
  orders: Order[];
}

export function OrderList({ orders }: OrderListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)



  const filteredOrders = orders.filter(order =>
    order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.user.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <Input
        type="text"
        placeholder="Search orders by ID or customer name"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="max-w-sm"
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order ID</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Total Amount</TableHead>
            <TableHead>Payment Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredOrders.map((order) => (
            <TableRow key={order.id}>
              <TableCell>{order.id}</TableCell>
              <TableCell>{order.user.name}</TableCell>
              <TableCell>₹{order.totalAmount.toFixed(2)}</TableCell>
              <TableCell>{order.paymentStatus}</TableCell>
              <TableCell>
                <Button variant="outline" size="sm" onClick={() => setSelectedOrder(order)}>
                  View Details
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selectedOrder && (
        <div className="mt-6 p-4 border rounded shadow-md bg-white">
          <OrderDetails order={selectedOrder} />
          <Button variant="outline" size="sm" onClick={() => setSelectedOrder(null)} className="mt-4">
            Close Details
          </Button>
        </div>
      )}
    </div>
  )
}
