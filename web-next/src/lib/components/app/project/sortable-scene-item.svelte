<script lang="ts">
import { getDragDropManager } from '@dnd-kit/svelte'
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

const sortable = createSortable({
    get id() {
        return scene.id
    },
    get index() {
        return index
    },
    group: 'scenes',
})

const manager = getDragDropManager()

// {#each} 재정렬 시 Svelte가 앞으로 이동하는 드래그 소스 요소를 DOM에서 잠깐 분리합니다.
// 이때 기본 sortable.attach cleanup이 sortable.element를 undefined로 초기화하면
// Feedback 플러그인의 reactive effect가 오버레이 CSS를 리셋해 드래그 overlay가 사라집니다.
// 드래그가 활성 상태일 때는 DOM 분리가 일어나도 cleanup을 건너뜁니다.
function attach(node: HTMLElement) {
    sortable.sortable.element = node
    return () => {
        if (!manager.dragOperation.status.idle) return
        sortable.sortable.element = undefined
    }
}
</script>

<div
	{@attach attach}
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
