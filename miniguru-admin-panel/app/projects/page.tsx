'use client'

import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { ProjectList } from '@/components/project/ProjectList'
import { SkeletonCard } from '@/components/SkeletonCard'  // Import the Skeleton component
import { ErrorDisplay } from '@/components/ErrorDisplay'  // Import the ErrorDisplay component
import { Project } from '@/types/project'
import { getAllProjects, deleteProjectById } from '@/utils/api/projectApi'
import { Button } from '@/components/ui/button';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true)
        setError(null)  // Reset error before fetching

        const res = await getAllProjects(page) // Pass the page number to the API function
        
        setProjects(res.projects);
        setTotalPages(res.pagination.totalPages);
      } catch (error) {
        setError(error.message || 'An error occurred while fetching projects.')
      } finally {
        setLoading(false)
      }
    }

    fetchProjects()
  }, [page])

  const handleDeleteProject =  async (projectId: string) => {
    try{
      await deleteProjectById(projectId);
    }
    catch(error){
      setError('An error occurred while deleting the project.' + error.message);
      return;
    }

    setProjects(projects.filter(project => project.id !== projectId))
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-4">
          {/* Show Skeleton while loading */}
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
        <ErrorDisplay message={error} />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-6">Projects</h1>
      <ProjectList projects={projects} onDeleteProject={handleDeleteProject} />
      
      <div className="flex justify-between mt-6">
        <Button onClick={() => setPage(page - 1)} disabled={page === 1}>
          Previous
        </Button>
        <span className="text-lg font-medium">Page {page} of {totalPages}</span>
        <Button onClick={() => setPage(page + 1)} disabled={page === totalPages}>
          Next
        </Button>
      </div>
    </AdminLayout>
  )
}
