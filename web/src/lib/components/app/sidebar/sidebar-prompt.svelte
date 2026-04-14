<script lang="ts">
    import { createQuery, useQueryClient } from '@tanstack/svelte-query'
    import { api } from '$lib/api'
    import { qk } from '$lib/queries'
    import { selectedProject } from '$lib/states/selected-project.svelte'
    import PromptInput from './prompt/prompt-editor.svelte'
    import * as Tabs from '$lib/components/ui/tabs'
    import * as ScrollArea from '$lib/components/ui/scroll-area'
    import * as Sidebar from '$lib/components/ui/sidebar'
    import { Input } from '$lib/components/ui/input'
    import { Button } from '$lib/components/ui/button'
    import { CodeEditor } from '$lib/components/ui/code-editor'
    import CharacterPromptEditor from '$lib/components/app/project/character-prompt-editor.svelte'
    import PlusIcon from '@lucide/svelte/icons/plus'
    import XIcon from '@lucide/svelte/icons/x'
    import TextAlignStartIcon from '@lucide/svelte/icons/text-align-start'

    const queryClient = useQueryClient()

    const projectQuery = createQuery(() => ({
        queryKey: qk.project(selectedProject.id!),
        queryFn: async () => {
            const { data } = await api.api.projects({ projectId: selectedProject.id! }).get()
            return data ?? null
        },
        enabled: !!selectedProject.id,
    }))

    // Local editing state
    let loadedProjectId = $state<number | null>(null)
    let prompt = $state('')
    let negativePrompt = $state('')
    let variables = $state<[string, string][]>([])
    let characterPrompts = $state<any[]>([])

    let saveTimeout: ReturnType<typeof setTimeout> | null = null
    let varSaveTimeout: ReturnType<typeof setTimeout> | null = null

    // Sync local state only when switching to a different project
    $effect(() => {
        const data = projectQuery.data
        if (data && data.id !== loadedProjectId) {
            loadedProjectId = data.id
            prompt = data.prompt ?? ''
            negativePrompt = data.negativePrompt ?? ''
            variables = Object.entries(data.variables ?? {})
            characterPrompts = [...(data.characterPrompts ?? [])]
        }
    })

    $effect(() => {
        if (loadedProjectId && (prompt !== projectQuery.data?.prompt || negativePrompt !== projectQuery.data?.negativePrompt)) {
            schedulePromptSave()
        }
    })

    function schedulePromptSave() {
        if (!loadedProjectId) return
        if (saveTimeout) clearTimeout(saveTimeout)
        saveTimeout = setTimeout(async () => {
            const { data } = await api.api.projects({ projectId: loadedProjectId! }).patch({ prompt, negativePrompt })
            if (data) queryClient.setQueryData(qk.project(loadedProjectId!), data)
        }, 600)
    }

    async function saveVariables() {
        if (!loadedProjectId) return
        const vars = Object.fromEntries(variables)
        const { data } = await api.api.projects({ projectId: loadedProjectId }).patch({ variables: vars })
        if (data) queryClient.setQueryData(qk.project(loadedProjectId), data)
    }

    function scheduleVariableSave() {
        if (varSaveTimeout) clearTimeout(varSaveTimeout)
        varSaveTimeout = setTimeout(saveVariables, 600)
    }

    function addVariable() {
        variables = [...variables, ['', '']]
    }

    function removeVariable(i: number) {
        variables = variables.filter((_, idx) => idx !== i)
        saveVariables()
    }

    function updateVarKey(i: number, key: string) {
        variables[i] = [key, variables[i][1]]
    }

    function updateVarValue(i: number, value: string) {
        variables[i] = [variables[i][0], value]
    }

    let project = $derived(projectQuery.data)
</script>

<Sidebar.Header class="border-b">
    <div class="flex items-center gap-2 px-2 py-1">
        <TextAlignStartIcon class="h-4 w-4 shrink-0" />
        <span class="truncate text-sm font-medium">
            {project?.name ?? '프로젝트 선택 안 됨'}
        </span>
    </div>
</Sidebar.Header>

{#if !project}
    <div class="flex flex-1 items-center justify-center p-4 text-center text-xs text-muted-foreground">
        왼쪽 패널에서 프로젝트를 선택하세요
    </div>
{:else}
    <Tabs.Root value="prompt" class="flex flex-1 flex-col overflow-hidden">
        <Tabs.List class="mx-2 my-1 shrink-0">
            <Tabs.Trigger value="prompt" class="flex-1 text-xs">프롬프트</Tabs.Trigger>
            <Tabs.Trigger value="variables" class="flex-1 text-xs">변수</Tabs.Trigger>
            <Tabs.Trigger value="chars" class="flex-1 text-xs">캐릭터</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="prompt" class="flex-1 overflow-hidden px-2 pb-2">
            <PromptInput
                bind:prompt
                bind:negativePrompt
                class="h-full"
            />
        </Tabs.Content>

        <Tabs.Content value="variables" class="flex-1 overflow-hidden">
            <ScrollArea.Root class="h-full">
                <div class="flex flex-col gap-2 px-2 pb-2">
                    {#each variables as [key, value], i (i)}
                        <div class="flex flex-col gap-1">
                            <div class="flex items-center gap-1">
                                <Input
                                    class="h-7 flex-1 px-2 font-mono text-xs"
                                    value={key}
                                    placeholder="변수명"
                                    oninput={(e) => updateVarKey(i, (e.target as HTMLInputElement).value)}
                                    onblur={saveVariables}
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    class="h-6 w-6 shrink-0"
                                    onclick={() => removeVariable(i)}
                                >
                                    <XIcon class="h-3 w-3" />
                                </Button>
                            </div>
                            <CodeEditor
                                value={value}
                                placeholder="값 (태그, 프롬프트 등)..."
                                minLines={2}
                                onchange={(v) => { updateVarValue(i, v); scheduleVariableSave() }}
                            />
                        </div>
                    {/each}
                    <Button
                        variant="outline"
                        size="sm"
                        class="h-7 gap-1.5 text-xs"
                        onclick={addVariable}
                    >
                        <PlusIcon class="h-3.5 w-3.5" />
                        변수 추가
                    </Button>
                </div>
            </ScrollArea.Root>
        </Tabs.Content>

        <Tabs.Content value="chars" class="flex-1 overflow-hidden">
            <ScrollArea.Root class="h-full">
                <div class="px-2 pb-2">
                    <CharacterPromptEditor
                        projectId={project.id}
                        bind:characterPrompts
                    />
                </div>
            </ScrollArea.Root>
        </Tabs.Content>
    </Tabs.Root>
{/if}
