import { ProjectCategory } from "@/types/project"
import { ProductCategory } from '@/types/product'
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface CategoryListProps {
  categories: (ProductCategory | ProjectCategory)[];
  onEditCategory: (category: ProductCategory | ProjectCategory) => void;
  onDeleteCategory: (category: ProductCategory | ProjectCategory) => void;
}

export function CategoryList({ categories, onEditCategory, onDeleteCategory }: CategoryListProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Icon</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.map((category) => (
          <TableRow key={category.id}>
            <TableCell>{category?.name || 'Unnamed Category'}</TableCell>
            <TableCell>{category?.icon || 'No icon'}</TableCell>
            <TableCell>
              <div className="space-x-2">
                <Button variant="outline" size="sm" onClick={() => onEditCategory(category)}>Edit</Button>
                <Button variant="destructive" size="sm" onClick={() => onDeleteCategory(category)}>Delete</Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

