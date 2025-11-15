// UpdateProductForm.tsx
import { useState, useEffect } from 'react'
import { Product } from '@/types/product'
import { ProductCategory } from '@/types/product'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { getAllProductCategories } from '@/utils/api/productApi'

interface UpdateProductFormProps {
  product: Product;
  onSubmit: (product: FormData | Product) => void;
  onCancel: () => void;
}

export function UpdateProductForm({ product, onSubmit, onCancel }: UpdateProductFormProps) {
  const [formData, setFormData] = useState<Partial<Product>>({
    name: product.name || '',
    description: product.description || '',
    price: product.price || 0,
    inventory: product.inventory || 0,
    categoryId: product.categoryId || '',
    images: [],
  });

  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Fetch categories when the component mounts
    async function fetchCategories() {
      try {
        const data = await getAllProductCategories();
        setCategories(data);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        setError('Failed to load categories');
      }
    }

    fetchCategories();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, categoryId: e.target.value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setFormData(prev => ({ ...prev, images: Array.from(files) }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Construct FormData to handle image uploads
    const submitData = new FormData();
    submitData.append('name', formData.name as string);
    submitData.append('description', formData.description as string);
    submitData.append('price', String(formData.price));
    submitData.append('inventory', String(formData.inventory));
    submitData.append('categoryName', formData.categoryId);

    // Append images if any
    formData.images.forEach((image) => {
      submitData.append('images', image);
    });

    onSubmit(submitData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Product</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && <div className="text-red-500">{error}</div>}

          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <Label htmlFor="price">Price</Label>
            <Input
              id="price"
              name="price"
              type="number"
              value={formData.price}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <Label htmlFor="inventory">Inventory</Label>
            <Input
              id="inventory"
              name="inventory"
              type="number"
              value={formData.inventory}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <Label htmlFor="categoryId">Category</Label>
            <select
              id="categoryId"
              name="categoryId"
              value={formData.categoryId}
              onChange={handleCategoryChange}
              required
            >
              <option value="">Select a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="images">Product Images</Label>
            <Input
              id="images"
              name="images"
              type="file"
              multiple
              onChange={handleImageChange}
            />
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit">Save</Button>
        </CardFooter>
      </form>
    </Card>
  );
}
