"use client";
import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { CategoryList } from '@/components/category/CategoryList';
import { CategoryForm } from '@/components/category/CategoryForm';
import { Button } from "@/components/ui/button";

import { getAllProductCategories, createProductCategory, deleteProductCategory, updateProductCategory } from '@/utils/api/productApi';
import { getAllProjectCategories, createProjectCategory, deleteProjectCategory, updateProjectCategory } from '@/utils/api/projectApi';
import { ProductCategory } from '@/types/product';
import { ProjectCategory } from '@/types/project';

export default function CategoriesPage() {
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [projectCategories, setProjectCategories] = useState<ProjectCategory[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | ProjectCategory | null>(null);
  const [categoryType, setCategoryType] = useState<'product' | 'project'>('product');

  // Fetch product and project categories on component mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const productResponse = await getAllProductCategories();
        setProductCategories(productResponse);

        const projectResponse = await getAllProjectCategories();
        setProjectCategories(projectResponse);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    fetchCategories();
  }, []);

  // Handle deleting categories
  const handleDeleteCategory = async (category: ProductCategory | ProjectCategory) => {
    try {
      if ('id' in category) {
        if (categoryType === 'product') {
          await deleteProductCategory(category.id);  // Delete from backend
          setProductCategories(productCategories.filter(c => c.id !== category.id));  // Update local state
        } else {
          await deleteProjectCategory(category.id);  // Delete from backend
          setProjectCategories(projectCategories.filter(c => c.id !== category.id));  // Update local state
        }
      }
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  // Handle adding categories (switching between product and project)
  const handleAddCategory = (type: 'product' | 'project') => {
    setCategoryType(type);
    setIsAddingCategory(true);
    setEditingCategory(null);
  };

  // Handle editing an existing category
  const handleEditCategory = (category: ProductCategory | ProjectCategory) => {
    setEditingCategory(category);
    setIsAddingCategory(false);
    setCategoryType('id' in category ? 'product' : 'project');
  };

  // Handle category form submission (create or update)
  const handleSubmitCategory = async (categoryData: Partial<ProductCategory | ProjectCategory>) => {
    try {
      if (editingCategory) {
        // Update category
        if (categoryType === 'product') {
          await updateProductCategory(editingCategory.id, categoryData);  // Update backend
          setProductCategories(productCategories.map(c => c.id === editingCategory.id ? { ...c, ...categoryData } : c));  // Update local state
        } else {
          await updateProjectCategory(editingCategory.id, categoryData);  // Update backend
          setProjectCategories(projectCategories.map(c => c.id === editingCategory.id ? { ...c, ...categoryData } : c));  // Update local state
        }
      } else {
        // Create new category
        if (categoryType === 'product') {
          const newCategory = await createProductCategory(categoryData.name);  // Create on backend
          setProductCategories([...productCategories, newCategory]);  // Update local state
        } else {
          const newCategory = await createProjectCategory(categoryData.name);  // Create on backend
          setProjectCategories([...projectCategories, newCategory]);  // Update local state
        }
      }
    } catch (error) {
      console.error('Error saving category:', error);
    }
    setIsAddingCategory(false);
    setEditingCategory(null);
  };

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-6">Categories</h1>
      {!isAddingCategory && !editingCategory && (
        <div className="mb-4 space-x-2">
          <Button onClick={() => handleAddCategory('product')}>Add Product Category</Button>
          <Button onClick={() => handleAddCategory('project')}>Add Project Category</Button>
        </div>
      )}
      {(isAddingCategory || editingCategory) ? (
        <CategoryForm
          category={editingCategory || undefined}
          onSubmit={handleSubmitCategory}
          onCancel={() => {
            setIsAddingCategory(false);
            setEditingCategory(null);
          }}
        />
      ) : (
        <>
          <h2 className="text-2xl font-bold mt-6 mb-3">Product Categories</h2>
          <CategoryList
            categories={productCategories}
            onEditCategory={handleEditCategory}
            onDeleteCategory={handleDeleteCategory}
          />
          <h2 className="text-2xl font-bold mt-6 mb-3">Project Categories</h2>
          <CategoryList
            categories={projectCategories}
            onEditCategory={handleEditCategory}
            onDeleteCategory={handleDeleteCategory}
          />
        </>
      )}
    </AdminLayout>
  );
}
