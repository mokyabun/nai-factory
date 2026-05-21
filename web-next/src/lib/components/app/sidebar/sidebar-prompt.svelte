<script lang="ts">
import { createQuery, useQueryClient } from '@tanstack/svelte-query'
import { AlignLeft, Plus, X } from 'phosphor-svelte'
import { onDestroy } from 'svelte'
import CodeEditor from '$lib/components/app/code-editor.svelte'
import CharacterPromptEditor from '$lib/components/app/project/character-prompt-editor.svelte'
import PromptEditor from '$lib/components/app/project/prompt-editor.svelte'
import { Button } from '$lib/components/ui/button'
import { Input } from '$lib/components/ui/input'
import { ScrollArea } from '$lib/components/ui/scroll-area'
import { SidebarHeader } from '$lib/components/ui/sidebar'
import * as Tabs from '$lib/components/ui/tabs'
import { api } from '$lib/api'
import { qk } from '$lib/query-keys'
import { tagCompletionSource } from '$lib/tag-autocomplete'
import type { CharacterPrompt, ProjectData } from '$lib/types'
import { debounce } from '$lib/utils'

let { projectId }: { projectId: number } = $props()
const queryClient = useQueryClient()

const projectQuery = createQuery(() => ({
    queryKey: qk.project(projectId),
    queryFn: async () => {
        const { data } = await api.projects({ projectId }).get()
        return (data ?? null) as ProjectData | null
    },
}))

let loadedProjectId = $state<number | null>(null)
let prompt = $state('')
let negativePrompt = $state('')
let variables = $state<[string, string][]>([])
let tab = $state('prompt')

const savePrompt = debounce(async (id: number, promptValue: string, negativeValue: string) => {
    const { data } = await api
        .projects({ projectId: id })
        .patch({ prompt: promptValue, negativePrompt: negativeValue })
    if (data) queryClient.setQueryData(qk.project(id), data)
}, 600)

const saveVariables = debounce(async (id: number, vars: [string, string][]) => {
    const { data } = await api
        .projects({ projectId: id })
        .patch({ variables: Object.fromEntries(vars) })
    if (data) queryClient.setQueryData(qk.project(id), data)
}, 600)

$effect(() => {
    const project = projectQuery.data
    if (!project || project.id === loadedProjectId) return
    savePrompt.cancel()
    saveVariables.cancel()
    loadedProjectId = project.id
    prompt = project.prompt ?? ''
    negativePrompt = project.negativePrompt ?? ''
    variables = Object.entries(project.variables ?? {})
})

onDestroy(() => {
    savePrompt.flush()
    saveVariables.flush()
})

function handlePromptChange(value: string) {
    prompt = value
    if (loadedProjectId) savePrompt(loadedProjectId, value, negativePrompt)
}

function handleNegativePromptChange(value: string) {
    negativePrompt = value
    if (loadedProjectId) savePrompt(loadedProjectId, prompt, value)
}

function saveCurrentVariables(next = variables) {
    if (loadedProjectId) saveVariables(loadedProjectId, next)
}

function addVariable() {
    variables = [...variables, ['', '']]
}

function removeVariable(index: number) {
    variables = variables.filter((_, i) => i !== index)
    saveCurrentVariables()
}

function updateVarKey(index: number, key: string) {
    variables = variables.map((item, i) => (i === index ? [key, item[1]] : item)) as [
        string,
        string,
    ][]
}

function updateVarValue(index: number, value: string) {
    variables = variables.map((item, i) => (i === index ? [item[0], value] : item)) as [
        string,
        string,
    ][]
    saveCurrentVariables()
}

const project = $derived(projectQuery.data)
</script>

<SidebarHeader class="border-b">
	<div class="flex items-center gap-2 px-1 py-1">
		<AlignLeft class="h-4 w-4 shrink-0" />
		<span class="truncate text-md font-bold">{project?.name ?? '프로젝트 선택 안 됨'}</span>
	</div>
</SidebarHeader>

{#if !project}
	<div class="flex flex-1 items-center justify-center p-4 text-center text-xs text-muted-foreground">
		왼쪽 패널에서 프로젝트를 선택하세요
	</div>
{:else}
	<Tabs.Root bind:value={tab} class="flex flex-1 flex-col overflow-hidden">
		<Tabs.List class="w-full shrink-0" variant="line">
			<Tabs.Trigger value="prompt" class="flex-1 text-xs">프롬프트</Tabs.Trigger>
			<Tabs.Trigger value="variables" class="flex-1 text-xs">변수</Tabs.Trigger>
			<Tabs.Trigger value="chars" class="flex-1 text-xs">캐릭터</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="prompt" class="flex-1 overflow-hidden px-2 py-1">
			<PromptEditor
				{prompt}
				{negativePrompt}
				onPromptChange={handlePromptChange}
				onNegativePromptChange={handleNegativePromptChange}
				class="min-h-[300px]"
			/>
		</Tabs.Content>

		<Tabs.Content value="variables" class="flex-1 overflow-hidden">
			<ScrollArea class="h-full">
				<div class="flex flex-col gap-2 px-2 pb-2">
					{#each variables as [key, value], index (index)}
						<div class="flex flex-col gap-1">
							<div class="flex items-center gap-1">
								<Input
									class="h-7 flex-1 px-2 font-mono text-xs"
									value={key}
									placeholder="변수명"
									oninput={(event) => updateVarKey(index, event.currentTarget.value)}
									onblur={() => saveCurrentVariables()}
								/>
								<Button
									variant="ghost"
									size="icon-xs"
									class="h-6 w-6 shrink-0"
									onclick={() => removeVariable(index)}
								>
									<X class="h-3 w-3" />
								</Button>
							</div>
							<CodeEditor
								{value}
								placeholder="값 (태그, 프롬프트 등)..."
								minLines={2}
								completionSource={tagCompletionSource}
								onChange={(next) => updateVarValue(index, next)}
							/>
						</div>
					{/each}
					<Button variant="outline" size="sm" class="h-7 gap-1.5 text-xs" onclick={addVariable}>
						<Plus class="h-3.5 w-3.5" />
						변수 추가
					</Button>
				</div>
			</ScrollArea>
		</Tabs.Content>

		<Tabs.Content value="chars" class="flex-1 overflow-hidden">
			<ScrollArea class="h-full">
				<div class="px-2 pb-2">
					<CharacterPromptEditor
						projectId={project.id}
						characterPrompts={(project.characterPrompts as CharacterPrompt[]) ?? []}
					/>
				</div>
			</ScrollArea>
		</Tabs.Content>
	</Tabs.Root>
{/if}
