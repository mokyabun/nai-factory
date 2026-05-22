<script lang="ts">
import { createSortable } from '@dnd-kit/svelte/sortable'
import { Trash } from 'phosphor-svelte'
import { Button } from '$lib/components/ui/button'
import type { ImageItem } from '$lib/types'

let {
    img,
    index,
    src,
    onView,
    onDelete,
}: {
    img: ImageItem
    index: number
    src: string
    onView: (img: ImageItem) => void
    onDelete: (img: ImageItem) => void
} = $props()

// svelte-ignore state_referenced_locally
const sortable = createSortable({
    get id() {
        return img.id
    },
    get index() {
        return index
    },
    group: 'images',
})
</script>

<div
	{@attach sortable.attach}
	class="group relative aspect-[3/4] cursor-pointer"
	class:opacity-40={sortable.isDragging}
>
	<button
		type="button"
		class="h-full w-full overflow-hidden rounded-lg border bg-muted"
		onclick={() => onView(img)}
		{@attach sortable.attachHandle}
	>
		<img
			{src}
			alt=""
			class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
			loading="lazy"
			draggable="false"
		/>
	</button>

	<Button
		variant="ghost"
		size="icon-sm"
		class="absolute top-1.5 right-1.5 hidden h-7 w-7 rounded-full bg-black/50 text-white hover:bg-black/70 group-hover:flex"
		onclick={(event) => {
			event.stopPropagation()
			onDelete(img)
		}}
	>
		<Trash class="h-3.5 w-3.5" />
	</Button>
</div>
