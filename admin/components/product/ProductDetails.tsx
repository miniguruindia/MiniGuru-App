import { Product } from '@/types/product'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Image from 'next/image'

interface ProductDetailsProps {
  product: Product;
}

export function ProductDetails({ product }: ProductDetailsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{product.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="font-semibold">Description:</dt>
            <dd>{product.description}</dd>
          </div>
          <div>
            <dt className="font-semibold">Price:</dt>
            <dd>₹{product.price.toFixed(2)}</dd>
          </div>
          <div>
            <dt className="font-semibold">Inventory:</dt>
            <dd>{product.inventory}</dd>
          </div>
          <div>
            <dt className="font-semibold">Category:</dt>
            <dd>{product.categoryId}</dd> {/* Assuming categoryId is a name for simplicity */}
          </div>
          <div>
            <dt className="font-semibold">Created At:</dt>
            <dd>{new Date(product.createdAt || '').toLocaleDateString()}</dd>
          </div>
          <div>
            <dt className="font-semibold">Updated At:</dt>
            <dd>{new Date(product.updatedAt || '').toLocaleDateString()}</dd>
          </div>
          <div>
            <dt className="font-semibold">Images:</dt>
            <dd>
              {product.images && product.images.length > 0 ? (
                <div className="space-y-2">
                  {product.images.map((image, index) => (
                    <Image key={index} src={typeof image === 'string' ? image : URL.createObjectURL(image)} alt={`Product image ${index + 1}`} className="max-w-xs" width={200} height={200} />
                  ))}
                </div>
              ) : (
                <span>No images available</span>
              )}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}
