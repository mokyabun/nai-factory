import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlignLeft } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SidebarHeader } from '@/components/ui/sidebar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { qk } from '@/lib/queries'
import { debounce } from '@/lib/utils'
import { CharacterPromptEditor } from './character-prompt-editor'
import { PromptEditor } from './prompt-editor'
import { PromptVariableEditor } from './prompt-variable-editor'
import { VibeTransferEditor } from './vibe-transfer-editor'

type SidebarPromptProps = {
    projectId: number
}

export function SidebarPrompt({ projectId }: SidebarPromptProps) {
    const queryClient = useQueryClient()

    const projectQuery = useQuery({
        queryKey: qk.project(projectId),
        queryFn: async () => {
            const { data } = await api.projects({ projectId }).get()
            return data ?? null
        },
    })

    const [loadedProjectId, setLoadedProjectId] = useState<number | null>(null)
    const [prompt, setPrompt] = useState('')
    const [negativePrompt, setNegativePrompt] = useState('')
    const [variables, setVariables] = useState<[string, string][]>([])

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
        if (data && data.id !== loadedProjectId) {
            savePromptRef.current.cancel()
            saveVariablesRef.current.cancel()

            setLoadedProjectId(data.id)
            setPrompt(data.prompt ?? '')
            setNegativePrompt(data.negativePrompt ?? '')
            setVariables(Object.entries(data.variables ?? {}))
        }
    }, [projectQuery.data, loadedProjectId])

    // Flush pending saves on unmount
    useEffect(() => {
        return () => {
            savePromptRef.current.flush()
            saveVariablesRef.current.flush()
        }
    }, [])

    function handlePromptChange(value: string) {
        setPrompt(value)
        if (loadedProjectId) savePromptRef.current(loadedProjectId, value, negativePrompt)
    }

    function handleNegativePromptChange(value: string) {
        setNegativePrompt(value)
        if (loadedProjectId) savePromptRef.current(loadedProjectId, prompt, value)
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
                <Tabs defaultValue="prompt" className="flex flex-1 flex-col overflow-hidden">
                    <TabsList className="shrink-0 w-full" variant="line">
                        <TabsTrigger value="prompt" className="flex-1 text-xs">
                            프롬프트
                        </TabsTrigger>
                        <TabsTrigger value="reference" className="flex-1 text-xs">
                            레퍼런스
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent
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
                        <PromptVariableEditor variables={variables} onChange={setVariables} />
                    </TabsContent>

                    <TabsContent
                        value="reference"
                        className="flex flex-col flex-1 overflow-hidden px-2 my-4 gap-4 overflow-y-auto scrollbar-none"
                    >
                        <VibeTransferEditor projectId={project.id} />
                    </TabsContent>
                </Tabs>
            )}
        </>
    )
}
