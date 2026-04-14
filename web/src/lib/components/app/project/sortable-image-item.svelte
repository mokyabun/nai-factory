<script lang="ts">
    import { createSortable } from '@dnd-kit/svelte/sortable'
    import * as ContextMenu from '$lib/components/ui/context-menu'
    import Trash2Icon from '@lucide/svelte/icons/trash-2'
    import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical'
    import type { api } from '$lib/api'

    type Image = NonNullable<Awaited<ReturnType<typeof api.api.images.get>>['data']>[number]

    let {
        img,
        index,
        imageUrl,
        onview,
        ondelete,
    }: {
        img: Image
        index: number
        imageUrl: string
        onview: (img: Image) => void
        ondelete: (img: Image) => void
    } = $props()

    const sortable = createSortable({ id: img.id, get index() { return index } })
</script>

<div
    {@attach sortable.attach}
    class="group relative {sortable.isDragging ? 'opacity-40' : ''}"
    style="transition: opacity 150ms"
>
    <ContextMenu.Root>
        <ContextMenu.Trigger>
            <button
                class="relative aspect-[3/4] w-full overflow-hidden rounded-lg border bg-muted transition-opacity hover:opacity-90"
                onclick={() => onview(img)}
            >
                <img
                    src={imageUrl}
                    alt="generated"
                    class="h-full w-full object-cover"
                    loading="lazy"
                />
            </button>
        </ContextMenu.Trigger>
        <ContextMenu.Content>
            <ContextMenu.Item
                class="text-destructive"
                onclick={() => ondelete(img)}
            >
                <Trash2Icon class="mr-2 h-4 w-4" />
                삭제
            </ContextMenu.Item>
        </ContextMenu.Content>
    </ContextMenu.Root>

    <!-- Drag handle -->
    <div
        {@attach sortable.attachHandle}
        class="absolute left-1 top-1 z-10 flex h-6 w-6 cursor-grab items-center justify-center rounded bg-black/50 opacity-50 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        title="드래그하여 순서 변경"
    >
        <GripVerticalIcon class="h-3.5 w-3.5 text-white" />
    </div>
</div>
