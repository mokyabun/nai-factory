import type { Project, ProjectSettings, ProjectSettingsPatch } from '@nai-factory/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useAtom } from 'jotai'
import { useCallback, useEffect } from 'react'

import { call, contract } from '@/lib/api'
import { restoreSnapshot, snapshotQuery } from '@/lib/optimistic'
import { qk } from '@/lib/queries'
import {
    loadedProjectIdAtom,
    sceneCardSizeAtom,
    slideshowImageCountAtom,
} from '@/routes/project/$projectId/atom'

import { useDebouncedPatch } from './use-debounced-patch'

/** Display settings of a project page, edited locally and saved after a pause. */
export function useProjectSettings(project: Project | null | undefined) {
    const queryClient = useQueryClient()
    const [loadedProjectId, setLoadedProjectId] = useAtom(loadedProjectIdAtom)
    const [slideshowImageCount, setSlideshowImageCount] = useAtom(slideshowImageCountAtom)
    const [sceneCardSize, setSceneCardSize] = useAtom(sceneCardSizeAtom)

    const save = useCallback(
        async (settings: ProjectSettingsPatch & { projectId?: number }) => {
            const { projectId, ...patch } = settings
            if (projectId === undefined) return
            const previous = await snapshotQuery<Project>(queryClient, qk.projects.get(projectId))
            queryClient.setQueryData<Project>(qk.projects.get(projectId), (current) =>
                current ? { ...current, settings: { ...current.settings, ...patch } } : current,
            )
            try {
                const data = await call(contract.projects.update, {
                    params: { id: projectId },
                    body: { settings: patch },
                })
                queryClient.setQueryData(qk.projects.get(projectId), data)
            } catch {
                restoreSnapshot(queryClient, previous)
            }
        },
        [queryClient],
    )
    const pending = useDebouncedPatch(save)

    useEffect(() => {
        if (project && project.id !== loadedProjectId) {
            // Save edits of the previous project before showing the next one.
            pending.flush()
            setLoadedProjectId(project.id)
            setSlideshowImageCount(project.settings.slideshowImageCount)
            setSceneCardSize(project.settings.sceneCardSize)
        }
    }, [
        project,
        loadedProjectId,
        pending,
        setLoadedProjectId,
        setSceneCardSize,
        setSlideshowImageCount,
    ])

    return {
        slideshowImageCount,
        sceneCardSize,
        setSlideshowImageCount: (value: string) => {
            const next = Math.min(10, Math.max(1, Number(value) || 1))
            setSlideshowImageCount(next)
            if (loadedProjectId) {
                pending.schedule({ projectId: loadedProjectId, slideshowImageCount: next })
            }
        },
        setSceneCardSize: (value: ProjectSettings['sceneCardSize']) => {
            setSceneCardSize(value)
            if (loadedProjectId)
                pending.schedule({ projectId: loadedProjectId, sceneCardSize: value })
        },
    }
}
