import { createFileRoute } from '@tanstack/react-router'

import { ProjectPage } from '@/features/project/project-page'

export const Route = createFileRoute('/project/$projectId/')({ component: ProjectRoute })

function ProjectRoute() {
    const { projectId } = Route.useParams()
    return <ProjectPage projectId={Number(projectId)} />
}
