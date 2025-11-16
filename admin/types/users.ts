export interface Wallet {
  id: string;
  userId: string | null;
  balance: number;
}

export interface ScoreHistory {
  time: string; // ISO date string
  updatedScore: number;
}

export interface Project {
  id: string;
  title: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  age: number;
  role: 'USER' | 'ADMIN';
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  score: number;
  wallet: Wallet;
  scoreHistory: ScoreHistory[];
  phoneNumber: string;
  projects: Project[];
  totalProjects: number;
}
