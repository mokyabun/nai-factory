<script lang="ts">
import { createSortable } from '@dnd-kit/svelte/sortable'
import { DotsSix } from 'phosphor-svelte'
import type { Scene } from '$lib/types'
import SceneCard from './scene-card.svelte'

let {
    scene,
    index,
    selected,
    selectMode,
    isProcessing,
    slideshowCount,
    onToggleSelect,
}: {
    scene: Scene
    index: number
    selected: boolean
    selectMode: boolean
    isProcessing: boolean
    slideshowCount: number
    onToggleSelect: (id: number) => void
} = $props()

// svelte-ignore state_referenced_locally
const sortable = createSortable({
	get id() { return scene.id },
	get index() { return index },
	group: 'scenes'
})
</script>

<div
	{@attach sortable.attach}
	class={`group relative ${sortable.isDragging ? 'opacity-40' : ''}`}
>
	<SceneCard
		{scene}
		{selected}
		{selectMode}
		{isProcessing}
		{slideshowCount}
		{onToggleSelect}
	/>
	<div
		{@attach sortable.attachHandle}
		class="absolute left-1/2 top-1 z-30 flex -translate-x-1/2 cursor-grab items-center justify-center rounded bg-black/50 px-2 py-0.5 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
	>
		<DotsSix class="h-3.5 w-3.5 text-white" />
	</div>
</div>
