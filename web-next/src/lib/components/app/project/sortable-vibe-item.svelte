<script lang="ts">
import { createSortable } from '@dnd-kit/svelte/sortable'
import { DotsSixVertical, Trash } from 'phosphor-svelte'
import { imageUrl } from '$lib/api'
import { Button } from '$lib/components/ui/button'
import { Label } from '$lib/components/ui/label'
import { Slider } from '$lib/components/ui/slider'
import type { VibeTransfer } from '$lib/types'

let {
    vibe,
    index,
    onUpdate,
    onDelete,
}: {
    vibe: VibeTransfer
    index: number
    onUpdate: (
        id: number,
        patch: { referenceStrength?: number; informationExtracted?: number },
    ) => void
    onDelete: (id: number) => void
} = $props()

// svelte-ignore state_referenced_locally
const sortable = createSortable({ id: vibe.id, index, group: 'vibes' })
</script>

<div
	{@attach sortable.attach}
	class="flex items-start gap-2 rounded-md border p-2"
	class:opacity-40={sortable.isDragging}
>
	<button
		type="button"
		{@attach sortable.attachHandle}
		class="mt-1 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
	>
		<DotsSixVertical class="h-4 w-4" />
	</button>
	<div class="h-16 w-16 shrink-0 overflow-hidden rounded border bg-muted">
		<img src={imageUrl(vibe.sourceImagePath)} alt="" class="h-full w-full object-cover" draggable="false" />
	</div>
	<div class="flex flex-1 flex-col gap-2">
		<div class="flex flex-col gap-1">
			<div class="flex items-center justify-between">
				<Label class="text-xs">레퍼런스 강도</Label>
				<span class="text-xs text-muted-foreground">{vibe.referenceStrength.toFixed(2)}</span>
			</div>
			<Slider
				type="single"
				value={vibe.referenceStrength}
				min={0}
				max={1}
				step={0.01}
				onValueChange={(value: number) => onUpdate(vibe.id, { referenceStrength: value })}
			/>
		</div>
		<div class="flex flex-col gap-1">
			<div class="flex items-center justify-between">
				<Label class="text-xs">정보 추출량</Label>
				<span class="text-xs text-muted-foreground">{vibe.informationExtracted.toFixed(2)}</span>
			</div>
			<Slider
				type="single"
				value={vibe.informationExtracted}
				min={0}
				max={1}
				step={0.01}
				onValueChange={(value: number) => onUpdate(vibe.id, { informationExtracted: value })}
			/>
		</div>
	</div>
	<Button
		variant="ghost"
		size="icon-xs"
		class="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
		onclick={() => onDelete(vibe.id)}
	>
		<Trash class="h-3.5 w-3.5" />
	</Button>
</div>
