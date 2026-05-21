<script lang="ts">
import { goto } from '$app/navigation'
import { createMutation, useQueryClient } from '@tanstack/svelte-query'
import { ArrowLeft, FileJs } from 'phosphor-svelte'
import { Button } from '$lib/components/ui/button'
import * as Dialog from '$lib/components/ui/dialog'
import { Input } from '$lib/components/ui/input'
import { Label } from '$lib/components/ui/label'
import OptionRow from './option-row.svelte'
import { api } from '$lib/api'
import { qk } from '$lib/query-keys'

type Step = 'choose' | 'options' | 'project-name'

type ImportOptions = {
    importPrompt: boolean
    importNegativePrompt: boolean
    importScenes: boolean
    importCharacterPrompts: boolean
    importParameters: boolean
}

type ParsedFile = {
    raw: unknown
    name: string
    sceneCount: number
    hasPreset: boolean
}

let {
    open = $bindable(false),
    file,
    projectId,
    onOpenChange,
}: {
    open?: boolean
    file: File | null
    projectId: number | null
    onOpenChange?: (open: boolean) => void
} = $props()

const queryClient = useQueryClient()
let step = $state<Step>('choose')
let parsed = $state<ParsedFile | null>(null)
let parseError = $state<string | null>(null)
let projectName = $state('')
let options = $state<ImportOptions>({
    importPrompt: true,
    importNegativePrompt: true,
    importScenes: true,
    importCharacterPrompts: true,
    importParameters: true,
})

let lastFile = $state<File | null>(null)

$effect(() => {
    if (!file || file === lastFile) return
    lastFile = file
    parsed = null
    parseError = null
    step = projectId ? 'choose' : 'project-name'

    file.text()
        .then((text) => {
            const raw = JSON.parse(text) as Record<string, unknown>
            const name = typeof raw.name === 'string' ? raw.name : file.name.replace(/\.json$/, '')
            const scenesObj = raw.scenes as Record<string, unknown> | undefined
            parsed = {
                raw,
                name,
                sceneCount: scenesObj ? Object.keys(scenesObj).length : 0,
                hasPreset: !!raw.selectedWorkflow && !!raw.presets,
            }
            projectName = name
        })
        .catch(() => {
            parseError = 'JSON 파일을 파싱할 수 없습니다.'
        })
})

const importMutation = createMutation(() => ({
    mutationFn: async () => {
        if (!parsed || !projectId) throw new Error('Invalid import state')
        const { error } = await api['sd-studio'].import.post({
            projectId,
            data: parsed.raw,
            options,
        })
        if (error) throw new Error(String(error.value))
    },
    onSuccess: () => {
        if (projectId) queryClient.invalidateQueries({ queryKey: qk.scenes(projectId) })
        setOpen(false)
    },
}))

const createAndImportMutation = createMutation(() => ({
    mutationFn: async () => {
        if (!parsed || !projectName.trim()) throw new Error('Invalid import state')
        const { data: project, error: createError } = await api.projects.post({
            groupId: null,
            name: projectName.trim(),
        })
        if (createError || !project) throw new Error('프로젝트 생성 실패')

        const { error: importError } = await api['sd-studio'].import.post({
            projectId: project.id,
            data: parsed.raw,
            options: {
                importPrompt: true,
                importNegativePrompt: true,
                importScenes: true,
                importCharacterPrompts: true,
                importParameters: true,
            },
        })
        if (importError) throw new Error('가져오기 실패')
        return project.id
    },
    onSuccess: (newProjectId) => {
        queryClient.invalidateQueries({ queryKey: qk.groupsWithProjects() })
        goto(`/project/${newProjectId}`)
        setOpen(false)
    },
}))

const isLoading = $derived(importMutation.isPending || createAndImportMutation.isPending)

function setOpen(value: boolean) {
    if (isLoading && !value) return
    open = value
    onOpenChange?.(value)
}

function toggleOption(key: keyof ImportOptions) {
    options = { ...options, [key]: !options[key] }
}
</script>

<Dialog.Root bind:open={() => open, setOpen}>
	<Dialog.Content class="max-w-md">
		{#if parseError}
			<Dialog.Header>
				<Dialog.Title>파일 오류</Dialog.Title>
				<Dialog.Description>{parseError}</Dialog.Description>
			</Dialog.Header>
			<Dialog.Footer>
				<Button onclick={() => setOpen(false)}>닫기</Button>
			</Dialog.Footer>
		{:else if !parsed}
			<Dialog.Header>
				<Dialog.Title>파일 읽는 중...</Dialog.Title>
			</Dialog.Header>
		{:else if step === 'choose'}
			<Dialog.Header>
				<Dialog.Title class="flex items-center gap-2">
					<FileJs class="size-4" />
					SD Studio 가져오기
				</Dialog.Title>
				<Dialog.Description>
					<span class="font-medium text-foreground">{parsed.name}</span>
					{' - 씬 '}
					<span class="font-medium text-foreground">{parsed.sceneCount}개</span>
					{' 발견'}
				</Dialog.Description>
			</Dialog.Header>
			<div class="flex flex-col gap-2 py-1">
				<Button
					variant="outline"
					class="h-auto flex-col items-start gap-1 px-4 py-3 text-left"
					onclick={() => (step = 'options')}
				>
					<span class="font-medium">현재 프로젝트에 가져오기</span>
					<span class="text-xs font-normal text-muted-foreground">
						씬을 현재 프로젝트에 추가합니다. 가져올 항목을 선택할 수 있습니다.
					</span>
				</Button>
				<Button
					variant="outline"
					class="h-auto flex-col items-start gap-1 px-4 py-3 text-left"
					onclick={() => (step = 'project-name')}
				>
					<span class="font-medium">새 프로젝트로 가져오기</span>
					<span class="text-xs font-normal text-muted-foreground">
						새 프로젝트를 생성하고 모든 항목을 가져옵니다.
					</span>
				</Button>
			</div>
		{:else if step === 'options'}
			<Dialog.Header>
				<Dialog.Title>가져올 항목 선택</Dialog.Title>
				<Dialog.Description>
					{#if !parsed.hasPreset}
						<span class="block text-yellow-500">프리셋 정보가 없습니다. 씬만 가져올 수 있습니다.</span>
					{/if}
				</Dialog.Description>
			</Dialog.Header>
			<div class="flex flex-col gap-3 py-1">
				<OptionRow
					id="importPrompt"
					label="프롬프트"
					description="frontPrompt + [[prompt]] + backPrompt 형태로 프로젝트 프롬프트 설정"
					checked={options.importPrompt}
					disabled={!parsed.hasPreset}
					onChange={() => toggleOption('importPrompt')}
				/>
				<OptionRow
					id="importNegativePrompt"
					label="부정 프롬프트"
					description="프리셋의 UC를 프로젝트 부정 프롬프트로 설정"
					checked={options.importNegativePrompt}
					disabled={!parsed.hasPreset}
					onChange={() => toggleOption('importNegativePrompt')}
				/>
				<OptionRow
					id="importScenes"
					label="씬"
					description="SD Studio 씬을 현재 프로젝트에 추가"
					checked={options.importScenes}
					onChange={() => toggleOption('importScenes')}
				/>
				<OptionRow
					id="importCharacterPrompts"
					label="캐릭터 프롬프트"
					description="프리셋의 캐릭터 프롬프트 목록 가져오기"
					checked={options.importCharacterPrompts}
					disabled={!parsed.hasPreset}
					onChange={() => toggleOption('importCharacterPrompts')}
				/>
				<OptionRow
					id="importParameters"
					label="파라미터"
					description="steps, sampler, CFG 등 생성 파라미터 가져오기"
					checked={options.importParameters}
					disabled={!parsed.hasPreset}
					onChange={() => toggleOption('importParameters')}
				/>
			</div>
			{#if importMutation.isError}
				<p class="text-sm text-destructive">가져오기에 실패했습니다. 다시 시도해주세요.</p>
			{/if}
			<Dialog.Footer>
				<Button variant="outline" onclick={() => (step = 'choose')} disabled={isLoading}>
					<ArrowLeft class="mr-1 size-4" />
					뒤로
				</Button>
				<Button onclick={() => importMutation.mutate()} disabled={isLoading}>
					{isLoading ? '가져오는 중...' : '가져오기'}
				</Button>
			</Dialog.Footer>
		{:else}
			<Dialog.Header>
				<Dialog.Title>새 프로젝트로 가져오기</Dialog.Title>
				<Dialog.Description>
					씬 {parsed.sceneCount}개와 모든 설정을 새 프로젝트로 가져옵니다.
				</Dialog.Description>
			</Dialog.Header>
			<form
				class="flex flex-col gap-4 py-1"
				onsubmit={(event) => {
					event.preventDefault()
					if (projectName.trim()) createAndImportMutation.mutate()
				}}
			>
				<div class="flex flex-col gap-1.5">
					<Label for="sd-project-name">프로젝트 이름</Label>
					<Input
						id="sd-project-name"
						bind:value={projectName}
						placeholder="프로젝트 이름..."
						autofocus
					/>
				</div>
				{#if createAndImportMutation.isError}
					<p class="text-sm text-destructive">가져오기에 실패했습니다. 다시 시도해주세요.</p>
				{/if}
				<Dialog.Footer>
					{#if projectId}
						<Button type="button" variant="outline" onclick={() => (step = 'choose')} disabled={isLoading}>
							<ArrowLeft class="mr-1 size-4" />
							뒤로
						</Button>
					{/if}
					<Button type="submit" disabled={!projectName.trim() || isLoading}>
						{isLoading ? '가져오는 중...' : '가져오기'}
					</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
