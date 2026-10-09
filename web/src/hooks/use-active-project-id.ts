import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'

import { queries } from '@/lib/queries'

function toId(value: string | undefined) {
    const id = Number(value)
    return Number.isInteger(id) && id > 0 ? id : null
}

/** Project and scene ids of the current route, or null where the route has none. */
export function useRouteIds() {
    const params = useParams({ strict: false })
    return { projectId: toId(params.projectId), sceneId: toId(params.sceneId) }
}

/** The project the current route belongs to: its own id, or the project of the open scene. */
export function useActiveProjectId() {
    const { projectId, sceneId } = useRouteIds()
    const sceneQuery = useQuery({
        ...queries.scenes.get(sceneId ?? 0),
        enabled: projectId === null && sceneId !== null,
    })

    return projectId ?? sceneQuery.data?.projectId ?? null
}
