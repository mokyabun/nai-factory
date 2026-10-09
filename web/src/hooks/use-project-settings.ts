import type { Project, ProjectSettings, ProjectSettingsPatch } from '@nai-factory/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { call, contract } from '@/lib/api'
import { qk } from '@/lib/queries'

import { useAutosave } from './use-autosave'

/** Display settings of a project page, shown at once and saved after a pause. */
export function useProjectSettings(projectId: number, project: Project | undefined) {
    const queryClient = useQueryClient()

    const save = useCallback(
        async (patch: ProjectSettingsPatch) => {
            const data = await call(contract.projects.update, {
                params: { id: projectId },
                body: { settings: patch },
            })
            queryClient.setQueryData(qk.projects.get(projectId), data)
        },
        [projectId, queryClient],
    )
    const settings = useAutosave<ProjectSettings, ProjectSettingsPatch>({
        data: project?.settings,
        save,
    })

    return {
        slideshowImageCount: settings.value?.slideshowImageCount ?? 4,
        sceneCardSize: settings.value?.sceneCardSize ?? 'md',
        setSlideshowImageCount: (value: string) =>
            settings.update({ slideshowImageCount: Math.min(10, Math.max(1, Number(value) || 1)) }),
        setSceneCardSize: (value: ProjectSettings['sceneCardSize']) =>
            settings.update({ sceneCardSize: value }),
    }
}
