// admin/app/products/page.tsx
// Products page is retired — shop now uses /materials directly.
// Redirect anyone who navigates here to /materials.
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ProductsPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/materials') }, [router])
  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-gray-500 text-sm">Redirecting to Materials...</p>
    </div>
  )
}