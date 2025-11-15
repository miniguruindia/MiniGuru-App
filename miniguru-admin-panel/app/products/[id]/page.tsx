// products/[id]/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AdminLayout } from '@/components/AdminLayout'
import { UpdateProductForm } from '@/components/product/UpdateProductForm'
import { ProductDetails } from '@/components/product/ProductDetails'
import { Button } from "@/components/ui/button"
import { SkeletonCard } from '@/components/SkeletonCard'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import { Product } from '@/types/product'
import { getProductById, updateProduct } from '@/utils/api/productApi'

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  
  const [product, setProduct] = useState<Product | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch product details when the page loads or when the product ID changes
  useEffect(() => {
    const fetchProduct = async (id: string) => {
      try {
        setLoading(true)
        setError(null)  // Reset any previous errors
        const foundProduct = await getProductById(id)
        setProduct(foundProduct || null) // If no product found, set to null
      } catch (error) {
        setError(error.message || 'Error fetching product details.')
      } finally {
        setLoading(false)
      }
    }

    if (params?.id) {
      fetchProduct(params.id.toString()) // Pass the param ID to fetchProduct
    }
  }, [params.id])

  // Handle saving the updated product
  const handleSave = async (formData: FormData) => {
    try {
      const updated = await updateProduct(product!.id, formData)
      setProduct(updated)
      setIsEditing(false)
    } catch (error) {
      setError(error.message || 'Error updating product details.')
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-4">
          {/* Show Skeleton while loading */}
          <SkeletonCard />
        </div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
        <ErrorDisplay message={error} />
      </AdminLayout>
    )
  }

  if (!product) {
    return (
      <AdminLayout>
        <div>Product not found</div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <Button onClick={() => router.back()}>Back</Button>
        <h1 className="text-3xl font-bold">Product Details</h1>
        {isEditing ? (
          <UpdateProductForm
            product={product}
            onSubmit={handleSave}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <>
            <ProductDetails product={product} />
            <Button onClick={() => setIsEditing(true)}>Edit Product</Button>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
