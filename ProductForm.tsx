'use client'
/**
 * ProductForm.tsx — Smart Add/Edit Product Form
 * 
 * Step 1: Choose source — MiniGuru (OWN) or Amazon Affiliate
 * Step 2a (AMAZON):
 *   - Paste any Amazon.in URL → ASIN auto-extracted
 *   - Affiliate tag appended automatically (miniguru08-21)
 *   - "Fetch Product Info" → calls /admin/amazon/product?asin=XXX
 *   - Name, description, price, image auto-filled (editable)
 * Step 2b (OWN):
 *   - Full manual form with image upload
 */

import { useState, useEffect } from 'react'
import { Product, ProductCategory } from '@/types/product'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { getAllProductCategories } from '@/utils/api/productApi'

const API = process.env.NEXT_PUBLIC_API_URL || ''
const AFFILIATE_TAG = 'miniguru08-21'

function extractAsin(url: string): string | null {
  const m = url.match(/\/dp\/([A-Z0-9]{10})|\/product\/([A-Z0-9]{10})|([A-Z0-9]{10})(?:\?|$|\/)/)
  return m?.[1] ?? m?.[2] ?? null
}

function buildAffiliateUrl(asin: string) {
  return `https://www.amazon.in/dp/${asin}?tag=${AFFILIATE_TAG}`
}

function amazonThumb(asin: string) {
  return `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.LZZZZZZZ.jpg`
}

interface Props {
  product?: Product
  onSubmit: (data: FormData | Product) => void
  onCancel: () => void
}

export function ProductForm({ product, onSubmit, onCancel }: Props) {
  const existingSource = (product as any)?.sourceType || 'OWN'

  // Step 1: source picker — skip if editing existing
  const [step, setStep]             = useState<'pick' | 'amazon' | 'own'>(
    product ? (existingSource === 'AMAZON' ? 'amazon' : 'own') : 'pick'
  )

  // Amazon flow state
  const [rawUrl, setRawUrl]         = useState((product as any)?.amazonUrl || '')
  const [asin, setAsin]             = useState<string | null>(null)
  const [affiliateUrl, setAffiliateUrl] = useState((product as any)?.amazonUrl || '')
  const [fetching, setFetching]     = useState(false)
  const [fetchMsg, setFetchMsg]     = useState('')

  // Shared fields
  const [name, setName]             = useState(product?.name || '')
  const [desc, setDesc]             = useState(product?.description || '')
  const [price, setPrice]           = useState<number>(product?.price || 0)
  const [inventory, setInventory]   = useState<number>(product?.inventory || 0)
  const [catId, setCatId]           = useState(product?.categoryId || '')
  const [brand, setBrand]           = useState((product as any)?.brand || '')
  const [size, setSize]             = useState((product as any)?.size || '')
  const [howToUse, setHowToUse]     = useState((product as any)?.howToUse || '')
  const [imageUrl, setImageUrl]     = useState('') // Amazon-fetched image URL
  const [images, setImages]         = useState<File[]>([])
  const [previews, setPreviews]     = useState<string[]>(
    Array.isArray(product?.images)
      ? (product?.images ?? []).map(img =>
          typeof img === 'string'
            ? (img.startsWith('http') ? img : `${API}/${img}`)
            : '')
      : []
  )
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [error, setError]           = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getAllProductCategories().then(setCategories).catch(() => setError('Failed to load categories'))
  }, [])

  // Extract ASIN whenever rawUrl changes
  useEffect(() => {
    if (!rawUrl.trim()) { setAsin(null); setAffiliateUrl(''); return }
    const extracted = extractAsin(rawUrl)
    setAsin(extracted)
    if (extracted) {
      const url = buildAffiliateUrl(extracted)
      setAffiliateUrl(url)
      // Auto-set image preview
      setImageUrl(amazonThumb(extracted))
    } else {
      setAffiliateUrl('')
    }
  }, [rawUrl])

  // Fetch product info from backend proxy
  async function handleFetch() {
    if (!asin) { setFetchMsg('❌ No ASIN detected. Check the URL.'); return }
    setFetching(true)
    setFetchMsg('Fetching from Amazon…')
    try {
      const token = localStorage.getItem('adminToken') || ''
      const res = await fetch(`${API}/admin/amazon/product?asin=${asin}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Status ${res.status}`)
      const data = await res.json()
      if (data.name)        setName(data.name)
      if (data.description) setDesc(data.description)
      if (data.price)       setPrice(data.price)
      if (data.imageUrl)    setImageUrl(data.imageUrl)
      setFetchMsg(`✅ Fetched! Review and save.`)
    } catch (e) {
      setFetchMsg(`⚠️ Could not auto-fetch. Fill in manually below.`)
    } finally {
      setFetching(false)
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    setImages(files)
    setPreviews(files.map(f => URL.createObjectURL(f)))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const isAmazon = step === 'amazon'
    const fd = new FormData()
    fd.append('name',         name)
    fd.append('description',  desc)
    fd.append('price',        String(price))
    fd.append('inventory',    String(inventory))
    fd.append('categoryName', catId)
    fd.append('sourceType',   isAmazon ? 'AMAZON' : 'OWN')
    fd.append('amazonUrl',    isAmazon ? affiliateUrl : '')
    fd.append('flipkartUrl',  '')
    if (!isAmazon) {
      fd.append('brand',    brand)
      fd.append('size',     size)
      fd.append('howToUse', howToUse)
      images.forEach(img => fd.append('images', img))
    } else {
      // For Amazon products, store the thumbnail URL as a regular image string
      // Backend will store it as-is (external URL)
      if (imageUrl) fd.append('imageUrl', imageUrl)
    }
    onSubmit(fd)
    setSubmitting(false)
  }

  // ── STEP 1: Source picker ─────────────────────────────────────────────────
  if (step === 'pick') {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-800">Add Product</h2>
          <p className="text-sm text-gray-500 mt-1">How will children buy this product?</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Amazon card */}
          <button
            onClick={() => setStep('amazon')}
            className="group text-left p-6 rounded-2xl border-2 border-orange-200 bg-orange-50
                       hover:border-orange-400 hover:bg-orange-100 transition-all"
          >
            <div className="text-3xl mb-3">🛒</div>
            <div className="font-bold text-orange-700 text-lg">Amazon Affiliate</div>
            <div className="text-sm text-orange-600 mt-1 leading-relaxed">
              Paste an Amazon.in link — ASIN extracted automatically,
              affiliate tag added, product info fetched.
            </div>
            <div className="mt-3 text-xs font-semibold text-orange-500 bg-orange-100
                            group-hover:bg-orange-200 rounded-full px-3 py-1 inline-block">
              Tag: miniguru08-21
            </div>
          </button>

          {/* MiniGuru Own card */}
          <button
            onClick={() => setStep('own')}
            className="group text-left p-6 rounded-2xl border-2 border-indigo-200 bg-indigo-50
                       hover:border-indigo-400 hover:bg-indigo-100 transition-all"
          >
            <div className="text-3xl mb-3">📦</div>
            <div className="font-bold text-indigo-700 text-lg">MiniGuru Shop</div>
            <div className="text-sm text-indigo-600 mt-1 leading-relaxed">
              Sold directly by MiniGuru. Full form — upload images,
              set inventory, manage via Razorpay cart.
            </div>
            <div className="mt-3 text-xs font-semibold text-indigo-500 bg-indigo-100
                            group-hover:bg-indigo-200 rounded-full px-3 py-1 inline-block">
              Own inventory
            </div>
          </button>
        </div>
        <button onClick={onCancel}
          className="mt-4 text-sm text-gray-400 hover:text-gray-600 underline">
          Cancel
        </button>
      </div>
    )
  }

  // ── STEP 2a: Amazon form ──────────────────────────────────────────────────
  if (step === 'amazon') {
    return (
      <div className="w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          {!product && (
            <button onClick={() => setStep('pick')}
              className="text-gray-400 hover:text-gray-600 text-lg">←</button>
          )}
          <div>
            <h2 className="text-xl font-bold text-gray-800">🛒 Amazon Affiliate Product</h2>
            <p className="text-xs text-gray-400">
              Tag <code className="bg-orange-50 text-orange-600 px-1 rounded">miniguru08-21</code> is
              added automatically to every link.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <p className="text-red-500 text-sm">{error}</p>}

          {/* Amazon URL input */}
          <div className="rounded-xl border-2 border-orange-200 bg-orange-50 p-4 space-y-3">
            <Label className="text-orange-700 font-bold">
              Step 1 — Paste any Amazon.in product URL
            </Label>
            <Input
              value={rawUrl}
              onChange={e => setRawUrl(e.target.value)}
              placeholder="https://www.amazon.in/dp/B08N5LYM1X or any Amazon product link"
              className="border-orange-300 focus:ring-orange-400"
            />

            {/* ASIN feedback */}
            {rawUrl && (
              <div className="flex items-center gap-2">
                {asin ? (
                  <>
                    <span className="text-green-600 text-sm font-bold">✓ ASIN: {asin}</span>
                    <span className="text-xs text-gray-400">→ {affiliateUrl.substring(0, 50)}…</span>
                  </>
                ) : (
                  <span className="text-red-500 text-sm">
                    ✗ ASIN not found. Try the full product page URL.
                  </span>
                )}
              </div>
            )}

            {/* Fetch button */}
            <Button
              type="button"
              onClick={handleFetch}
              disabled={!asin || fetching}
              className="bg-orange-500 hover:bg-orange-600 text-white w-full"
            >
              {fetching ? 'Fetching…' : '✨ Fetch Product Info from Amazon'}
            </Button>
            {fetchMsg && (
              <p className="text-sm text-gray-600">{fetchMsg}</p>
            )}
          </div>

          {/* Image preview */}
          {imageUrl && (
            <div className="flex items-start gap-4 p-3 rounded-xl bg-gray-50 border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Product" onError={e => (e.currentTarget.style.display='none')}
                className="w-24 h-24 object-contain rounded-lg border border-gray-200 bg-white" />
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-gray-500">Image URL (auto-filled)</Label>
                <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)}
                  className="text-xs" />
              </div>
            </div>
          )}

          {/* Step 2 — Product details */}
          <div className="space-y-1">
            <Label>Step 2 — Verify / edit product details</Label>
          </div>

          <div className="space-y-1">
            <Label htmlFor="name">Product Name *</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)}
              required placeholder="e.g. LED Pack 50pcs Assorted Colours" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" value={desc} onChange={e => setDesc(e.target.value)}
              rows={3} placeholder="What is this? Great for what kind of STEAM projects?" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="price">Price on Amazon (₹) *</Label>
              <Input id="price" type="number" value={price}
                onChange={e => setPrice(Number(e.target.value))}
                required min={0} step={1} />
              <p className="text-xs text-gray-400">Shown as reference — Amazon sets final price.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="inventory">Stock (set 999 for affiliate)</Label>
              <Input id="inventory" type="number" value={inventory}
                onChange={e => setInventory(Number(e.target.value))}
                min={0} />
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1">
            <Label htmlFor="cat">Category *</Label>
            <select id="cat" value={catId}
              onChange={e => setCatId(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="">Select category…</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Final affiliate URL (read-only confirm) */}
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 space-y-1">
            <Label className="text-green-700 text-xs font-bold">
              ✓ Affiliate URL (auto-generated — do not edit)
            </Label>
            <div className="text-xs text-green-600 break-all font-mono bg-white
                            rounded p-2 border border-green-100">
              {affiliateUrl || '← Paste an Amazon URL above'}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={!asin || submitting}
              className="bg-orange-500 hover:bg-orange-600 text-white">
              {submitting ? 'Saving…' : 'Save Amazon Product'}
            </Button>
          </div>
        </form>
      </div>
    )
  }

  // ── STEP 2b: OWN / MiniGuru form ─────────────────────────────────────────
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        {!product && (
          <button onClick={() => setStep('pick')}
            className="text-gray-400 hover:text-gray-600 text-lg">←</button>
        )}
        <div>
          <h2 className="text-xl font-bold text-gray-800">📦 MiniGuru Shop Product</h2>
          <p className="text-xs text-gray-400">Sold directly — managed inventory + Razorpay</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="space-y-1">
          <Label htmlFor="own-name">Product Name *</Label>
          <Input id="own-name" value={name} onChange={e => setName(e.target.value)}
            required placeholder="e.g. HB Pencil" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="own-desc">Description *</Label>
          <Textarea id="own-desc" value={desc} onChange={e => setDesc(e.target.value)}
            required rows={3} placeholder="What is this product? What does it include?" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="own-brand">Brand</Label>
            <Input id="own-brand" value={brand} onChange={e => setBrand(e.target.value)}
              placeholder="e.g. Camlin, Apsara" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="own-size">Size / Quantity</Label>
            <Input id="own-size" value={size} onChange={e => setSize(e.target.value)}
              placeholder="e.g. Pack of 5, 10cm" />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="own-howto">How to Use (optional)</Label>
          <Textarea id="own-howto" value={howToUse} onChange={e => setHowToUse(e.target.value)}
            rows={3} placeholder="Step-by-step instructions for using this in a STEAM project…" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="own-price">Price (₹) *</Label>
            <Input id="own-price" type="number" value={price}
              onChange={e => setPrice(Number(e.target.value))}
              required min={0} step={0.01} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="own-inv">Inventory *</Label>
            <Input id="own-inv" type="number" value={inventory}
              onChange={e => setInventory(Number(e.target.value))}
              required min={0} />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="own-cat">Category *</Label>
          <select id="own-cat" value={catId}
            onChange={e => setCatId(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <option value="">Select category…</option>
            {categories.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="own-images">Product Images (up to 10)</Label>
          <Input id="own-images" type="file" accept="image/*" multiple
            onChange={handleImageChange} className="cursor-pointer" />
          {previews.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {previews.map((src, i) => src ? (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Preview ${i+1}`}
                    className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                  <span className="absolute -top-1 -right-1 bg-indigo-500 text-white text-xs
                                   rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {i+1}
                  </span>
                </div>
              ) : null)}
            </div>
          )}
          <p className="text-xs text-gray-400">Leave empty to keep existing images.</p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={submitting}
            className="bg-indigo-500 hover:bg-indigo-600 text-white">
            {submitting ? 'Saving…' : 'Save Product'}
          </Button>
        </div>
      </form>
    </div>
  )
}
