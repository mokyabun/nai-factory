import type { Project, ProjectPatch, PromptVariable } from '@nai-factory/shared'
import { isNovelAIV5Model } from '@nai-factory/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Provider, useAtom } from 'jotai'
import { AlignLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo } from 'react'

import { SidebarHeader } from '@/components/ui/sidebar'
import { useDebouncedPatch } from '@/hooks/use-debounced-patch'
import { call, contract } from '@/lib/api'
import { restoreSnapshot, snapshotQuery } from '@/lib/optimistic'
import { normalizeVariableDraft, variableValidationMessage } from '@/lib/prompt-variables'
import { qk } from '@/lib/queries'

import {
    createSidebarPromptDraft,
    sidebarParameterParamsAtom,
    sidebarPromptDraftAtom,
} from './atom'
import { CharacterPromptEditor } from './character-prompt-editor'
import { CharacterReferenceEditor } from './character-reference-editor'
import { ParameterEditor } from './parameter-editor'
import { PromptEditor } from './prompt-editor'
import { PromptVariableEditor } from './prompt-variable-editor'
import {
    SidebarPromptTabs,
    SidebarPromptTabsContent,
    SidebarPromptTabsList,
    SidebarPromptTabsTrigger,
} from './sidebar-prompt-tabs'
import { VibeTransferEditor } from './vibe-transfer-editor'

type SidebarPromptProps = {
    projectId: number | null
}

export function SidebarPrompt({ projectId }: SidebarPromptProps) {
    if (projectId === null) {
        return (
            <div className="flex h-full min-h-0 flex-1 items-center justify-center p-4 text-center text-xs text-muted-foreground">
                왼쪽 패널에서 프로젝트를 선택하세요
            </div>
        )
    }

    return (
        <Provider key={projectId}>
            <SidebarPromptContent projectId={projectId} />
        </Provider>
    )
}

export function SidebarPromptContent({ projectId }: { projectId: number }) {
    const queryClient = useQueryClient()
    const [draft, setDraft] = useAtom(sidebarPromptDraftAtom)
    const [parameterDraft] = useAtom(sidebarParameterParamsAtom)
    const { loadedProjectId, prompt, negativePrompt, variables } = draft

    const projectQuery = useQuery({
        queryKey: qk.projects.get(projectId),
        queryFn: () => call(contract.projects.get, { params: { id: projectId } }),
    })

    const settingsQuery = useQuery({
        queryKey: qk.settings.get(),
        queryFn: () => call(contract.settings.get),
    })

    // The component is keyed by project, so pending edits always belong to `projectId`.
    const saveProject = useCallback(
        async (patch: ProjectPatch) => {
            const previousProject = await snapshotQuery<Project>(
                queryClient,
                qk.projects.get(projectId),
            )
            queryClient.setQueryData<Project>(qk.projects.get(projectId), (project) =>
                project
                    ? {
                          ...project,
                          ...patch,
                          parameters: project.parameters,
                          settings: project.settings,
                      }
                    : project,
            )
            try {
                const data = await call(contract.projects.update, {
                    params: { id: projectId },
                    body: patch,
                })
                queryClient.setQueryData(qk.projects.get(projectId), data)
            } catch {
                restoreSnapshot(queryClient, previousProject)
            }
        },
        [projectId, queryClient],
    )
    const pendingSave = useDebouncedPatch(saveProject)

    // Load the draft once the project arrives.
    useEffect(() => {
        const data = projectQuery.data
        if (!data) return
        if (loadedProjectId === data.id) return
        setDraft(createSidebarPromptDraft(data))
    }, [projectQuery.data, loadedProjectId, setDraft])

    function handlePromptChange(value: string) {
        setDraft((current) => ({ ...current, prompt: value }))
        if (loadedProjectId) pendingSave.schedule({ prompt: value })
    }

    function handleNegativePromptChange(value: string) {
        setDraft((current) => ({ ...current, negativePrompt: value }))
        if (loadedProjectId) pendingSave.schedule({ negativePrompt: value })
    }

    function handleVariablesChange(value: PromptVariable) {
        setDraft((current) => ({ ...current, variables: value }))
        if (loadedProjectId && !variableValidationMessage(value)) {
            pendingSave.schedule({ variables: normalizeVariableDraft(value) })
        }
    }

    const project = projectQuery.data
    const isV5 = isNovelAIV5Model(parameterDraft?.model ?? project?.parameters.model ?? '')
    const completionVariables = useMemo(
        () => [...(settingsQuery.data?.globalVariables ?? []), ...variables],
        [settingsQuery.data?.globalVariables, variables],
    )

    return (
        <div className="flex h-full min-h-0 flex-col bg-sidebar">
            <SidebarHeader className="border-b">
                <div className="flex items-center gap-2 px-1 py-1">
                    <AlignLeft className="h-4 w-4 shrink-0" />
                    <span className="truncate text-md font-bold">
                        {project?.name ?? '프로젝트 선택 안 됨'}
                    </span>
                </div>
            </SidebarHeader>

            {!project ? (
                <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-muted-foreground">
                    왼쪽 패널에서 프로젝트를 선택하세요
                </div>
            ) : (
                <SidebarPromptTabs
                    defaultValue="prompt"
                    className="flex min-h-0 flex-1 flex-col overflow-hidden"
                >
                    <SidebarPromptTabsList>
                        <SidebarPromptTabsTrigger value="prompt">프롬프트</SidebarPromptTabsTrigger>
                        <SidebarPromptTabsTrigger value="reference">
                            레퍼런스
                        </SidebarPromptTabsTrigger>
                        <SidebarPromptTabsTrigger value="parameter">
                            파라미터
                        </SidebarPromptTabsTrigger>
                    </SidebarPromptTabsList>

                    <SidebarPromptTabsContent
                        value="prompt"
                        className="flex flex-col gap-4 overflow-y-auto px-2 py-4 scrollbar-none"
                    >
                        <span className="text-lg">프롬프트</span>
                        <PromptEditor
                            prompt={prompt}
                            negativePrompt={negativePrompt}
                            variables={completionVariables}
                            onPromptChange={handlePromptChange}
                            onNegativePromptChange={handleNegativePromptChange}
                        />

                        <span className="text-lg mt-4">캐릭터 프롬프트</span>
                        <CharacterPromptEditor
                            projectId={project.id}
                            characterPrompts={project.characterPrompts ?? []}
                            variables={completionVariables}
                        />

                        <span className="text-lg mt-4">변수</span>
                        <PromptVariableEditor
                            variables={variables}
                            onChange={handleVariablesChange}
                        />
                    </SidebarPromptTabsContent>

                    <SidebarPromptTabsContent
                        value="reference"
                        className="flex flex-col gap-4 overflow-y-auto px-2 py-4 scrollbar-none"
                    >
                        {isV5 ? (
                            <p className="text-xs text-muted-foreground">
                                V5는 바이브 전송과 캐릭터 레퍼런스를 지원하지 않습니다. 저장된
                                레퍼런스는 다른 모델에서 사용할 수 있습니다.
                            </p>
                        ) : (
                            <>
                                <span className="text-lg">바이브 이미지</span>
                                <VibeTransferEditor projectId={project.id} />

                                <span className="text-lg mt-4">캐릭터 레퍼런스</span>
                                <CharacterReferenceEditor projectId={project.id} />
                            </>
                        )}
                    </SidebarPromptTabsContent>

                    <SidebarPromptTabsContent
                        value="parameter"
                        className="flex flex-col gap-4 overflow-y-auto px-2 py-4 scrollbar-none"
                    >
                        <span className="text-lg">파라미터</span>
                        <ParameterEditor project={project} />
                    </SidebarPromptTabsContent>
                </SidebarPromptTabs>
            )}
        </div>
    )
}
