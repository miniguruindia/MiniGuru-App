'use client'

import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/AdminLayout'
import { ProjectList } from '@/components/project/ProjectList'
import { SkeletonCard } from '@/components/SkeletonCard'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import { Project } from '@/types/project'
import { Button } from '@/components/ui/button';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

async function authHeader() {
  const v = `; ${document.cookie}`
  const p = v.split('; auth_token=')
  const token = p.length === 2 ? p.pop()!.split(';').shift()! : ''
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

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
        setError(null)
        const res = await fetch(`${API_BASE}/project/all?page=${page}`, { headers: await authHeader() })
        if (!res.ok) throw new Error(`Failed to load projects (${res.status})`)
        const data = await res.json()
        setProjects(data.projects)
        setTotalPages(data.pagination?.totalPages || 1)
      } catch (error: any) {
        setError(error.message || 'An error occurred while fetching projects.')
      } finally {
        setLoading(false)
      }
    }

    fetchProjects()
  }, [page])

  const handleDeleteProject =  async (projectId: string) => {
    try{
      const res = await fetch(`${API_BASE}/admin/project/${projectId}`, { method: 'DELETE', headers: await authHeader() })
      if (!res.ok) throw new Error(`Delete failed (${res.status})`)
    }
    catch(error: any){
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
