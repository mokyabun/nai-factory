<script lang="ts">
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { ArrowLeft, Plus } from 'phosphor-svelte'
import { onDestroy } from 'svelte'
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { api } from '$lib/api'
import VariationEditor from '$lib/components/app/project/variation-editor.svelte'
import { Button } from '$lib/components/ui/button'
import { Input } from '$lib/components/ui/input'
import { qk } from '$lib/query-keys'
import { debounce } from '$lib/utils'

type SceneDetail = {
    id: number
    projectId: number
    name: string
    variations: Record<string, string>[]
}

const queryClient = useQueryClient()
const sceneId = $derived(Number(page.params.sceneId))

const sceneQuery = createQuery(() => ({
    queryKey: qk.scene(sceneId),
    queryFn: async () => {
        const { data } = await api.scenes({ id: sceneId }).get()
        return (data ?? null) as SceneDetail | null
    },
}))

let name = $state('')
let variations = $state<Record<string, string>[]>([])
let loadedId = $state<number | null>(null)

const patchScene = createMutation(() => ({
    mutationFn: (patch: { name?: string; variations?: Record<string, string>[] }) =>
        api.scenes({ id: sceneId }).patch(patch),
    onSuccess: (res: { data?: unknown }) => {
        if (res.data) queryClient.setQueryData(qk.scene(sceneId), res.data)
        queryClient.invalidateQueries({ queryKey: qk.scenes(sceneQuery.data?.projectId ?? 0) })
    },
}))

const saveName = debounce((value: string) => patchScene.mutate({ name: value }), 600)
const saveVariations = debounce(
    (value: Record<string, string>[]) => patchScene.mutate({ variations: value }),
    600,
)

$effect(() => {
    const data = sceneQuery.data
    if (!data || data.id === loadedId) return
    loadedId = data.id
    name = data.name
    variations = data.variations ?? []
})

onDestroy(() => {
    saveName.flush()
    saveVariations.flush()
})

function handleNameChange(value: string) {
    name = value
    saveName(value)
}

function handleVariationsChange(value: Record<string, string>[]) {
    variations = value
    saveVariations(value)
}
</script>

{#if sceneQuery.isPending}
	<div class="flex h-full items-center justify-center text-sm text-muted-foreground">불러오는 중...</div>
{:else if !sceneQuery.data}
	<div class="flex h-full items-center justify-center text-sm text-muted-foreground">
		씬을 찾을 수 없습니다.
	</div>
{:else}
	<div class="flex h-full flex-col gap-4">
		<div class="flex items-center gap-3">
			<Button
				variant="ghost"
				size="icon-sm"
				class="h-8 w-8 shrink-0"
				onclick={() => goto(`/project/${sceneQuery.data?.projectId}`)}
			>
				<ArrowLeft class="h-4 w-4" />
			</Button>
			<Input
				value={name}
				oninput={(event) => handleNameChange(event.currentTarget.value)}
				class="h-8 max-w-xs text-sm font-medium"
				placeholder="씬 이름..."
			/>
			<span class="text-xs text-muted-foreground">
				{patchScene.isPending ? '저장 중...' : `${variations.length}개 변수 세트`}
			</span>
		</div>

		<div class="flex-1 overflow-auto">
			{#if variations.length === 0}
				<div class="flex flex-col items-center gap-3 py-16 text-muted-foreground">
					<p class="text-sm">변수 세트가 없습니다.</p>
					<Button
						variant="outline"
						size="sm"
						class="gap-1.5"
						onclick={() => handleVariationsChange([{}])}
					>
						<Plus class="h-3.5 w-3.5" />
						변수 세트 추가
					</Button>
				</div>
			{:else}
				<VariationEditor {variations} onChange={handleVariationsChange} layout="row" />
			{/if}
		</div>
	</div>
{/if}
