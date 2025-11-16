
export type Project = {
  id: string;                    // Unique identifier for the project
  title: string;                 // Title of the project
  description: string;           // Detailed description
  startDate: Date;               // Project start date
  endDate: Date;                 // Project end date
  thumbnail: string;          // URL for the thumbnail image
  video : {
    url: string;
    uploadedAt?: string
  }
  materials: Material[];         // Array of materials required for the project
  status: 'active' | 'completed' | 'archived'; // Status of the project (if relevant)
  createdAt: Date;               // Timestamp when the project was created
  updatedAt: Date;               // Timestamp for the last update
  categoryId: string;            // ID of the project category
  category: {
    name: string;                // Name of the category
  };
  userId: string;                // ID of the user associated with the project
  user: {
    name: string;                // Name of the user
  };
  comments: Comment[];           // Array of comments associated with the project
};

export type Material = {
  productId: string;                    // Unique identifier for the material
  name: string | null;            // Name of the material (nullable)
  quantity: number;              // Quantity of the material
};

export type Comment = {
  content: string;               // Content of the comment
  commentedBy: {
    name: string;                // Name of the person who commented
    id: string;                  // ID of the person who commented
  };
};


  export interface ProjectCategory {
    id: string;
    name: string;
    icon: string;
  }

  export interface Pagination {
    totalProjects: number;
    currentPage: number;
    totalPages: number;
    pageSize: number;
  }

  export interface GetAllProjectsResponse {
    projects: Project[];
    pagination: Pagination;
  }
  