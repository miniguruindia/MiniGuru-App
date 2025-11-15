export interface ProductCategory {
    id: string;
    name: string;
    icon: string;
  }
  
  // Interface for Product
 export interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    inventory: number;
    categoryId: string;
    images: (string| File)[];
    createdAt?: string;
    updatedAt?: string;
  }