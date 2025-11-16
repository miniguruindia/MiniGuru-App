'use client'

import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { ProductList } from '@/components/product/ProductList'
import { ProductForm } from '@/components/product/ProductForm'
import { Product } from '@/types/product'
import { Button } from "@/components/ui/button"
import { SkeletonCard } from '@/components/SkeletonCard'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import { getAllProducts, createProduct, deleteProduct } from '@/utils/api/productApi'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])  // State to store products
  const [loading, setLoading] = useState<boolean>(true)    // Loading state to show skeleton loader
  const [error, setError] = useState<string | null>(null)   // Error state to capture any API fetch issues
  const [isAddingProduct, setIsAddingProduct] = useState(false)  // State to control product form visibility

  // Fetch products on initial render
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)
        setError(null)  // Reset error state before fetching
        const fetchedProducts = await getAllProducts()  // API call to fetch products
        setProducts(fetchedProducts)  // Set products to state
      } catch (error) {
        console.error(error)
        setError(error.message || 'An error occurred while fetching products.')
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()  // Call the function to fetch products when the page loads
  }, [])

  // Handle deleting a product
  const handleDeleteProduct = async (productId: string) => {
    try {
      // Make API call to delete product
      await deleteProduct(productId)
      
      // Optimistically update the UI by removing the product from state
      setProducts(products.filter(product => product.id !== productId))
    } catch (error) {
      setError(error.message || 'Failed to delete product.')
    }
  }

  // Handle adding a new product (shows the product form)
  const handleAddProduct = () => {
    setIsAddingProduct(true)
  }

  // Handle form submission for adding/updating products
  const handleSubmitProduct = async (formData: FormData) => {
    try {
      // Call API to create a new product
      const newProduct = await createProduct(formData)

      // Optimistically update the UI by adding the new product to state
      setProducts(prevProducts => [...prevProducts, newProduct])

      // Close the form after submission
      setIsAddingProduct(false)
    } catch (error) {
      setError(error.message || 'Failed to create product.')
    }
  }

  // Display loading skeletons if data is still loading
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

  // Display error if the API call fails
  if (error) {
    return (
      <AdminLayout>
        <ErrorDisplay message={error} />  {/* Display error message */}
      </AdminLayout>
    )
  }

  // Main UI after products are fetched
  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-6">Products</h1>
      {/* Show Add New Product button or the product form */}
      {!isAddingProduct && (
        <Button onClick={handleAddProduct} className="mb-4">Add New Product</Button>
      )}
      {/* Show ProductForm if adding a new product, otherwise show ProductList */}
      {isAddingProduct ? (
        <ProductForm
          onSubmit={handleSubmitProduct}
          onCancel={() => setIsAddingProduct(false)}
        />
      ) : (
        <ProductList
          products={products}
          onDeleteProduct={handleDeleteProduct}
        />
      )}
    </AdminLayout>
  )
}
