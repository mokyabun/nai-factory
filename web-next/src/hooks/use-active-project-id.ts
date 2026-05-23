import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { qk } from '@/lib/queries'

function idFromPath(pathname: string, prefix: string) {
    if (!pathname.startsWith(prefix)) return null

    const id = Number(pathname.split('/')[2])
    return Number.isFinite(id) && id > 0 ? id : null
}

export function useActiveProjectId(pathname: string) {
    const projectId = idFromPath(pathname, '/project/')
    const sceneId = idFromPath(pathname, '/scene/')

    const sceneContextQuery = useQuery({
        queryKey: qk.sceneContext(sceneId ?? 0),
        queryFn: async () => {
            const { data } = await api.scenes({ id: sceneId as number }).summary.get()
            return data ? { projectId: data.projectId } : null
        },
        enabled: sceneId !== null,
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
    })

    return projectId ?? sceneContextQuery.data?.projectId ?? null
}
