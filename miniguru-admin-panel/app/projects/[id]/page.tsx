'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AdminLayout } from '@/components/AdminLayout'
import { ProjectDetails } from '@/components/project/ProjectDetails'
import { Button } from "@/components/ui/button"
import { SkeletonCard } from '@/components/SkeletonCard'    
import { ErrorDisplay } from '@/components/ErrorDisplay'  
import { Project } from '@/types/project'
import { getProjectById } from '@/utils/api/projectApi'


export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)  // State to store error message

  useEffect(() => {
    async function fetchProject(id) {
      try {
        setLoading(true)
        setError(null)  // Reset any previous errors
        if (params.id) {
          const projectData = await getProjectById(id);
          console.log(projectData)
          setProject(projectData)
        }
      } catch (error) {
        setError(error.message || 'An error occurred while fetching project details.')
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchProject(params.id.toString())
    }
  }, [params.id])

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-4">
          
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

  if (!project) {
    return (
      <AdminLayout>
        <div>Project not found</div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <Button onClick={() => router.back()} className="mb-4">Back</Button>
        <h1 className="text-3xl font-bold mb-6">Project Details</h1>
        <ProjectDetails project={project} />
      </div>
    </AdminLayout>
  )
}
