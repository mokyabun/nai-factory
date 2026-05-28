import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Provider, useAtom } from 'jotai'
import { AlignLeft } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { SidebarHeader } from '@/components/ui/sidebar'
import { api } from '@/lib/api'
import { qk } from '@/lib/queries'
import { debounce } from '@/lib/utils'
import { createSidebarPromptDraft, sidebarPromptDraftAtom } from './atom'
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
            <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-muted-foreground">
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
    const { loadedProjectId, prompt, negativePrompt, variables } = draft

    const projectQuery = useQuery({
        queryKey: qk.project(projectId),
        queryFn: async () => {
            const { data } = await api.projects({ projectId }).get()
            return data ?? null
        },
    })

    const savePromptRef = useRef(
        debounce(async (projectId: number, prompt: string, negativePrompt: string) => {
            const { data } = await api.projects({ projectId }).patch({ prompt, negativePrompt })

            if (data) queryClient.setQueryData(qk.project(projectId), data)
        }, 600),
    )

    const saveVariablesRef = useRef(
        debounce(async (projectId: number, vars: [string, string][]) => {
            const { data } = await api
                .projects({ projectId })
                .patch({ variables: Object.fromEntries(vars) })

            if (data) queryClient.setQueryData(qk.project(projectId), data)
        }, 600),
    )

    // Sync local state when switching projects
    useEffect(() => {
        const data = projectQuery.data
        if (!data) return

        if (loadedProjectId === data.id) return

        setDraft(createSidebarPromptDraft(data))
        savePromptRef.current.cancel()
        saveVariablesRef.current.cancel()
    }, [projectQuery.data, loadedProjectId, setDraft])

    // Flush pending saves on unmount
    useEffect(() => {
        return () => {
            savePromptRef.current.flush()
            saveVariablesRef.current.flush()
        }
    }, [])

    function handlePromptChange(value: string) {
        setDraft((current) => ({ ...current, prompt: value }))
        if (loadedProjectId) savePromptRef.current(loadedProjectId, value, negativePrompt)
    }

    function handleNegativePromptChange(value: string) {
        setDraft((current) => ({ ...current, negativePrompt: value }))
        if (loadedProjectId) savePromptRef.current(loadedProjectId, prompt, value)
    }

    function handleVariablesChange(value: [string, string][]) {
        setDraft((current) => ({ ...current, variables: value }))
        if (loadedProjectId) saveVariablesRef.current(loadedProjectId, value)
    }

    const project = projectQuery.data

    return (
        <>
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
                    className="flex flex-1 flex-col overflow-hidden"
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
                        className="flex flex-col flex-1 overflow-hidden px-2 my-4 gap-4 overflow-y-auto scrollbar-none"
                    >
                        <span className="text-lg">프롬프트</span>
                        <PromptEditor
                            prompt={prompt}
                            negativePrompt={negativePrompt}
                            onPromptChange={handlePromptChange}
                            onNegativePromptChange={handleNegativePromptChange}
                            className="min-h-[300px]"
                        />

                        <span className="text-lg mt-4">캐릭터 프롬프트</span>
                        <CharacterPromptEditor
                            projectId={project.id}
                            characterPrompts={project.characterPrompts ?? []}
                        />

                        <span className="text-lg mt-4">변수</span>
                        <PromptVariableEditor
                            variables={variables}
                            onChange={handleVariablesChange}
                        />
                    </SidebarPromptTabsContent>

                    <SidebarPromptTabsContent
                        value="reference"
                        className="flex flex-col flex-1 overflow-hidden px-2 my-4 gap-4 overflow-y-auto scrollbar-none"
                    >
                        <span className="text-lg">바이브 이미지</span>
                        <VibeTransferEditor projectId={project.id} />

                        <span className="text-lg mt-4">캐릭터 레퍼런스</span>
                        <CharacterReferenceEditor projectId={project.id} />
                    </SidebarPromptTabsContent>

                    <SidebarPromptTabsContent
                        value="parameter"
                        className="flex flex-col flex-1 overflow-hidden px-2 my-4 gap-4 overflow-y-auto scrollbar-none"
                    >
                        <span className="text-lg">파라미터</span>
                        <ParameterEditor project={project} />
                    </SidebarPromptTabsContent>
                </SidebarPromptTabs>
            )}
        </>
    )
}
