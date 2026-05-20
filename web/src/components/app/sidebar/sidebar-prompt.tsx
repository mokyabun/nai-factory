import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlignLeft, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CodeEditor } from '#/components/app/code-editor/code-editor'
import { CharacterPromptEditor } from '#/components/app/project/character-prompt-editor'
import { PromptEditor } from '#/components/app/sidebar/prompt-editor'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { ScrollArea } from '#/components/ui/scroll-area'
import { SidebarHeader } from '#/components/ui/sidebar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { api } from '#/lib/api'
import { qk } from '#/lib/queries'
import { tagCompletionSource } from '#/lib/tag-autocomplete'
import { debounce } from '#/lib/utils'

interface SidebarPromptProps {
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

    function addVariable() {
        setVariables((prev) => [...prev, ['', '']])
    }

    function removeVariable(i: number) {
        const next = variables.filter((_, idx) => idx !== i)
        setVariables(next)
        if (loadedProjectId) saveVariablesRef.current(loadedProjectId, next)
    }

    function updateVarKey(i: number, key: string) {
        const next = variables.map((v, idx) => (idx === i ? [key, v[1]] : v)) as [string, string][]
        setVariables(next)
    }

    function updateVarValue(i: number, value: string) {
        const next = variables.map((v, idx) => (idx === i ? [v[0], value] : v)) as [
            string,
            string,
        ][]
        setVariables(next)
        if (loadedProjectId) saveVariablesRef.current(loadedProjectId, next)
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
                        <TabsTrigger value="variables" className="flex-1 text-xs">
                            변수
                        </TabsTrigger>
                        <TabsTrigger value="chars" className="flex-1 text-xs">
                            캐릭터
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="prompt" className="flex-1 overflow-hidden px-2 py-1">
                        <PromptEditor
                            prompt={prompt}
                            negativePrompt={negativePrompt}
                            onPromptChange={handlePromptChange}
                            onNegativePromptChange={handleNegativePromptChange}
                            className="min-h-[300px]"
                        />
                    </TabsContent>

                    <TabsContent value="variables" className="flex-1 overflow-hidden">
                        <ScrollArea className="h-full">
                            <div className="flex flex-col gap-2 px-2 pb-2">
                                {variables.map(([key, value], i) => (
                                    <div key={i} className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1">
                                            <Input
                                                className="h-7 flex-1 px-2 font-mono text-xs"
                                                value={key}
                                                placeholder="변수명"
                                                onChange={(e) => updateVarKey(i, e.target.value)}
                                                onBlur={() => {
                                                    if (loadedProjectId)
                                                        saveVariablesRef.current(
                                                            loadedProjectId,
                                                            variables,
                                                        )
                                                }}
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 shrink-0"
                                                onClick={() => removeVariable(i)}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <CodeEditor
                                            value={value}
                                            placeholder="값 (태그, 프롬프트 등)..."
                                            minLines={2}
                                            completionSource={tagCompletionSource}
                                            onChange={(v) => updateVarValue(i, v)}
                                        />
                                    </div>
                                ))}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1.5 text-xs"
                                    onClick={addVariable}
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    변수 추가
                                </Button>
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="chars" className="flex-1 overflow-hidden">
                        <ScrollArea className="h-full">
                            <div className="px-2 pb-2">
                                <CharacterPromptEditor
                                    projectId={project.id}
                                    characterPrompts={
                                        (project.characterPrompts as {
                                            enabled: boolean
                                            center: { x: number; y: number }
                                            prompt: string
                                            uc: string
                                        }[]) ?? []
                                    }
                                />
                            </div>
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            )}
        </>
    )
}
