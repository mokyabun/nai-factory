<script lang="ts">
    import { createSortable } from '@dnd-kit/svelte/sortable'
    import SceneCard from './scene-card.svelte'
    import GripHorizontalIcon from '@lucide/svelte/icons/grip-horizontal'
    import type { api } from '$lib/api'

    type Scene = NonNullable<Awaited<ReturnType<typeof api.api.scenes.get>>['data']>[number]

    let {
        scene,
        index,
        selected,
        isProcessing,
        ontoggleselect,
    }: {
        scene: Scene
        index: number
        selected: boolean
        isProcessing: boolean
        ontoggleselect: (id: number) => void
    } = $props()

    const sortable = createSortable({ id: scene.id, get index() { return index } })
</script>

<div
    {@attach sortable.attach}
    class="group relative {sortable.isDragging ? 'opacity-40' : ''}"
    style="transition: opacity 150ms"
>
    <SceneCard {scene} {selected} {isProcessing} {ontoggleselect} />

    <!-- Drag handle — thumbnail 상단 중앙에 hover 시 표시 -->
    <div
        {@attach sortable.attachHandle}
        class="absolute left-1/2 top-1 z-30 flex -translate-x-1/2 cursor-grab items-center justify-center rounded bg-black/50 px-2 py-0.5 opacity-50 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        title="드래그하여 순서 변경"
    >
        <GripHorizontalIcon class="h-3.5 w-3.5 text-white" />
    </div>
</div>
