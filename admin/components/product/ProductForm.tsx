'use client'
// UpdateProductForm.tsx — updated with brand, size, howToUse, multiple images
import { useState, useEffect } from 'react'
import { Product, ProductCategory } from '@/types/product'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { getAllProductCategories } from '@/utils/api/productApi'

interface UpdateProductFormProps {
  product?: Product
  onSubmit: (product: FormData | Product) => void
  onCancel: () => void
}

export function ProductForm({ product, onSubmit, onCancel }: UpdateProductFormProps) {
  const [formData, setFormData] = useState({
    name:        product?.name        || '',
    description: product?.description || '',
    brand:       (product as any)?.brand       || '',
    size:        (product as any)?.size        || '',
    howToUse:    (product as any)?.howToUse    || '',
    price:       product?.price       || 0,
    inventory:   product?.inventory   || 0,
    categoryId:  product?.categoryId  || '',
    images:      [] as File[],
  })
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [error, setError]           = useState('')
  const [previews, setPreviews]     = useState<string[]>(
    Array.isArray(product?.images) ? (product?.images ?? []).map(img =>
      typeof img === 'string'
        ? (img.startsWith('http') ? img : `${process.env.NEXT_PUBLIC_API_URL}/${img}`)
        : '') : []
  )

  useEffect(() => {
    getAllProductCategories()
      .then(setCategories)
      .catch(() => setError('Failed to load categories'))
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setFormData(prev => ({ ...prev, images: files }))
    setPreviews(files.map(f => URL.createObjectURL(f)))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const fd = new FormData()
    fd.append('name',         formData.name)
    fd.append('description',  formData.description)
    fd.append('brand',        formData.brand)
    fd.append('size',         formData.size)
    fd.append('howToUse',     formData.howToUse)
    fd.append('price',        String(formData.price))
    fd.append('inventory',    String(formData.inventory))
    fd.append('categoryName', formData.categoryId)
    formData.images.forEach(img => fd.append('images', img))
    onSubmit(fd)
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-lg font-bold">Edit Product</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && <p className="text-red-500 text-sm">{error}</p>}

          {/* Name */}
          <div className="space-y-1">
            <Label htmlFor="name">Product Name *</Label>
            <Input id="name" name="name" value={formData.name}
              onChange={handleChange} required placeholder="e.g. HB Pencil" />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label htmlFor="description">Description *</Label>
            <Textarea id="description" name="description" value={formData.description}
              onChange={handleChange} required rows={3}
              placeholder="What is this product? What does it include?" />
          </div>

          {/* Brand + Size row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="brand">Brand</Label>
              <Input id="brand" name="brand" value={formData.brand}
                onChange={handleChange} placeholder="e.g. Camlin, Apsara" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="size">Size / Quantity</Label>
              <Input id="size" name="size" value={formData.size}
                onChange={handleChange} placeholder="e.g. 10 cm, Pack of 5" />
            </div>
          </div>

          {/* How to use */}
          <div className="space-y-1">
            <Label htmlFor="howToUse">How to Use</Label>
            <Textarea id="howToUse" name="howToUse" value={formData.howToUse}
              onChange={handleChange} rows={4}
              placeholder="Step-by-step instructions for using this material in a project..." />
          </div>

          {/* Price + Inventory row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="price">Price (₹) *</Label>
              <Input id="price" name="price" type="number" value={formData.price}
                onChange={handleChange} required min={0} step={0.01} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inventory">Inventory *</Label>
              <Input id="inventory" name="inventory" type="number" value={formData.inventory}
                onChange={handleChange} required min={0} />
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1">
            <Label htmlFor="categoryId">Category *</Label>
            <select id="categoryId" name="categoryId"
              value={formData.categoryId}
              onChange={e => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required>
              <option value="">Select category...</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Images */}
          <div className="space-y-2">
            <Label htmlFor="images">Product Images (up to 10)</Label>
            <Input id="images" name="images" type="file" accept="image/*"
              multiple onChange={handleImageChange}
              className="cursor-pointer" />
            {previews.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {previews.map((src, i) => src ? (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Preview ${i+1}`}
                      className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                    <span className="absolute -top-1 -right-1 bg-indigo-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                      {i+1}
                    </span>
                  </div>
                ) : null)}
              </div>
            )}
            <p className="text-xs text-gray-400">Leave empty to keep existing images. Select new images to replace them.</p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" className="bg-indigo-500 hover:bg-indigo-600 text-white">
            Save Changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}