<script lang="ts">
import { DragDropProvider } from '@dnd-kit/svelte'
import { createMutation, useQueryClient } from '@tanstack/svelte-query'
import { Plus } from 'phosphor-svelte'
import { api } from '$lib/api'
import SortableCharacterPromptItem from '$lib/components/app/project/sortable-character-prompt-item.svelte'
import { Button } from '$lib/components/ui/button'
import { qk } from '$lib/query-keys'
import { arrayMove } from '$lib/sortable'
import type { CharacterPrompt } from '$lib/types'
import { debounce } from '$lib/utils'

let {
    projectId,
    characterPrompts,
}: {
    projectId: number
    characterPrompts: CharacterPrompt[]
} = $props()

const queryClient = useQueryClient()
let localPrompts = $state<CharacterPrompt[]>([])
let loadedSignature = $state('')

$effect(() => {
    const signature = JSON.stringify(characterPrompts)
    if (signature === loadedSignature) return
    loadedSignature = signature
    localPrompts = characterPrompts.map((item) => ({ ...item, center: { ...item.center } }))
})

const saveMutation = createMutation(() => ({
    mutationFn: (prompts: CharacterPrompt[]) =>
        api.projects({ projectId }).patch({ characterPrompts: prompts }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.project(projectId) }),
}))

const saveDebounced = debounce((prompts: CharacterPrompt[]) => {
    saveMutation.mutate(prompts)
}, 600)

function save(prompts: CharacterPrompt[], immediate = false) {
    localPrompts = prompts
    if (immediate) {
        saveDebounced.cancel()
        saveMutation.mutate(prompts)
    } else {
        saveDebounced(prompts)
    }
}

function update(index: number, patch: Partial<CharacterPrompt>) {
    save(localPrompts.map((item, i) => (i === index ? { ...item, ...patch } : item)))
}

function addCharacter() {
    save([...localPrompts, { enabled: true, center: { x: 0, y: 0 }, prompt: '', uc: '' }], true)
}

function removeCharacter(index: number) {
    save(
        localPrompts.filter((_, i) => i !== index),
        true,
    )
}

function handleDragEnd(event: {
    canceled: boolean
    operation: { source?: { id: unknown } | null; target?: { id: unknown } | null }
}) {
    if (event.canceled) return
    const sourceIndex = Number(event.operation.source?.id)
    const targetIndex = Number(event.operation.target?.id)
    if (
        !Number.isInteger(sourceIndex) ||
        !Number.isInteger(targetIndex) ||
        sourceIndex === targetIndex
    ) {
        return
    }
    save(arrayMove(localPrompts, sourceIndex, targetIndex), true)
}
</script>

<div class="flex flex-col gap-3">
	{#if localPrompts.length === 0}
		<div class="py-4 text-center text-xs text-muted-foreground">캐릭터 프롬프트 없음</div>
	{:else}
		<DragDropProvider onDragEnd={handleDragEnd}>
			<div class="flex flex-col gap-3">
				{#each localPrompts as cp, index (index)}
					<SortableCharacterPromptItem
						id={index}
						{index}
						prompt={cp}
						onUpdate={update}
						onRemove={removeCharacter}
					/>
				{/each}
			</div>
		</DragDropProvider>
	{/if}

	<Button variant="outline" size="sm" class="gap-1.5" onclick={addCharacter}>
		<Plus class="h-3.5 w-3.5" />
		캐릭터 추가
	</Button>
</div>
