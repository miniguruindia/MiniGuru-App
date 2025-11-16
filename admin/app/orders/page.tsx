'use client'

import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { OrderList } from '@/components/order/OrderList'
import { SkeletonCard } from '@/components/SkeletonCard'  // Assuming this component exists for loading states
import { ErrorDisplay } from '@/components/ErrorDisplay'  // Assuming this component exists for error display
import { Order } from '@/types/order'
import { getAllOrders } from '@/utils/api/orderApi'

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])  // Orders state to hold the fetched orders
  const [loading, setLoading] = useState<boolean>(true)  // Loading state for showing skeleton loader
  const [error, setError] = useState<string | null>(null)  // Error state for any issues during fetch

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true)
        setError(null)  // Reset error before making the request
        const fetchedOrders = await getAllOrders()  // API call to fetch orders
        setOrders(fetchedOrders)  // Set orders to the state
      } catch (error) {
        setError(error.message || 'An error occurred while fetching orders.')  // Handle error case
        console.error(error)  // Log the error to the console

      } finally {
        setLoading(false)  // Ensure loading state is turned off after the API call
      }
    }

    fetchOrders()  // Call the function to fetch orders on component mount
  }, [])

  // Render loading skeleton if still loading
  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-4">
          {/* Show Skeleton cards while loading */}
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </AdminLayout>
    )
  }

  // Render error message if there was an error during the API call
  if (error) {
    return (
      <AdminLayout>
        <ErrorDisplay message={error} />  {/* Display error message */}
      </AdminLayout>
    )
  }

  // Main UI after data is fetched
  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-6">Orders</h1>
      <OrderList orders={orders} /> 
    </AdminLayout>
  )
}
