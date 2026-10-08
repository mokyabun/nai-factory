import { useQuery } from '@tanstack/react-query'

import { call, contract } from '@/lib/api'
import { qk } from '@/lib/queries'

function idFromPath(pathname: string, prefix: string) {
    if (!pathname.startsWith(prefix)) return null

    const id = Number(pathname.split('/')[2])
    return Number.isFinite(id) && id > 0 ? id : null
}

export function useActiveProjectId(pathname: string) {
    const projectId = idFromPath(pathname, '/project/')
    const sceneId = idFromPath(pathname, '/scene/')

    const sceneQuery = useQuery({
        queryKey: qk.scenes.get(sceneId ?? 0),
        queryFn: () => call(contract.scenes.get, { params: { id: sceneId as number } }),
        enabled: sceneId !== null,
    })

    return projectId ?? sceneQuery.data?.projectId ?? null
}
