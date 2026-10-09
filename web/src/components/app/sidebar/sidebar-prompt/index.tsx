import type {
    CharacterPrompt,
    Parameters,
    Project,
    ProjectPatch,
    PromptVariable,
} from '@nai-factory/shared'
import { isNovelAIV5Model } from '@nai-factory/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlignLeft } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { SidebarHeader } from '@/components/ui/sidebar'
import { useAutosave } from '@/hooks/use-autosave'
import { call, contract } from '@/lib/api'
import { normalizeVariableDraft, variableValidationMessage } from '@/lib/prompt-variables'
import { qk, queries } from '@/lib/queries'

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

const NO_VARIABLES: PromptVariable = []

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

    // Keyed by project, so unsaved edits are saved to the project they were made in.
    return <SidebarPromptContent key={projectId} projectId={projectId} />
}

function SidebarPromptContent({ projectId }: { projectId: number }) {
    const queryClient = useQueryClient()
    const projectQuery = useQuery(queries.projects.get(projectId))
    const settingsQuery = useQuery(queries.settings.get())

    const saveProject = useCallback(
        async (patch: ProjectPatch) => {
            const body = patch.variables
                ? { ...patch, variables: normalizeVariableDraft(patch.variables) }
                : patch
            const data = await call(contract.projects.update, { params: { id: projectId }, body })
            queryClient.setQueryData(qk.projects.get(projectId), data)
        },
        [projectId, queryClient],
    )
    // Prompt, variables, character prompts and parameters share one autosave queue.
    const { value: project, update } = useAutosave<Project, ProjectPatch>({
        data: projectQuery.data,
        save: saveProject,
    })

    // Variables that fail validation stay local, and unsaved, until they are fixed.
    const [invalidVariables, setInvalidVariables] = useState<PromptVariable | null>(null)
    const variables = invalidVariables ?? project?.variables ?? NO_VARIABLES

    function handleVariablesChange(value: PromptVariable) {
        if (variableValidationMessage(value)) {
            setInvalidVariables(value)
            return
        }
        setInvalidVariables(null)
        update({ variables: value })
    }

    function handleCharacterPromptsChange(
        characterPrompts: CharacterPrompt[],
        options?: { immediate?: boolean },
    ) {
        update({ characterPrompts }, options)
    }

    function handleParameterChange<K extends keyof Parameters>(key: K, value: Parameters[K]) {
        update({ parameters: { [key]: value } })
    }

    const isV5 = isNovelAIV5Model(project?.parameters.model ?? '')
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
                            prompt={project.prompt ?? ''}
                            negativePrompt={project.negativePrompt ?? ''}
                            variables={completionVariables}
                            onPromptChange={(prompt) => update({ prompt })}
                            onNegativePromptChange={(negativePrompt) => update({ negativePrompt })}
                        />

                        <span className="text-lg mt-4">캐릭터 프롬프트</span>
                        <CharacterPromptEditor
                            characterPrompts={project.characterPrompts ?? []}
                            variables={completionVariables}
                            onChange={handleCharacterPromptsChange}
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
                        <ParameterEditor
                            parameters={project.parameters}
                            onChange={handleParameterChange}
                        />
                    </SidebarPromptTabsContent>
                </SidebarPromptTabs>
            )}
        </div>
    )
}
