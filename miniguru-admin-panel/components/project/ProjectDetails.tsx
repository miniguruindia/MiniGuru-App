import { Project } from '@/types/project'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Image from 'next/image'

interface ProjectDetailsProps {
  project: Project;
}

export function ProjectDetails({ project }: ProjectDetailsProps) {
  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>{project.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
            <div>
            <h3 className="font-semibold">Description</h3>
            <p>{project.description}</p>
            </div>
            <div>
            <h3 className="font-semibold">Duration</h3>
            <p>{new Date(project.startDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} - {new Date(project.endDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
            </div>
            <div>
            <h3 className="font-semibold">Materials</h3>
            <ul className="list-disc list-inside">
              {project.materials.map((material) => (
              <li key={material.productId}>{material.name} (Quantity: {material.quantity})</li>
              ))}
            </ul>
            </div>
            {project.video.url && (
            <div>
              <h3 className="font-semibold">Project Video</h3>
              <video src={project.video.url} controls className="w-full max-w-md mt-2" />
            </div>
            )}
            <div>
            <h3 className="font-semibold">Thumbnail Image</h3>
            <Image src={project.thumbnail} alt={project.title} width={500} height={300} className="w-full max-w-md mt-2 rounded-md object-cover" />
            </div>
          <div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

