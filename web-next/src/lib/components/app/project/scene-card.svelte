<script lang="ts">
import { createMutation, useQueryClient } from '@tanstack/svelte-query'
import { Check, Copy, Image, ListPlus, Pencil, Spinner, Trash } from 'phosphor-svelte'
import { onDestroy } from 'svelte'
import { goto } from '$app/navigation'
import { api, imageUrl } from '$lib/api'
import ConfirmDeleteDialog from '$lib/components/app/dialogs/confirm-delete-dialog.svelte'
import { Button } from '$lib/components/ui/button'
import * as ContextMenu from '$lib/components/ui/context-menu'
import { qk } from '$lib/query-keys'
import type { Scene } from '$lib/types'
import { cn } from '$lib/utils'

interface Props {
    scene: Scene
    selected?: boolean
    selectMode?: boolean
    isProcessing?: boolean
    slideshowCount?: number
    onToggleSelect?: (id: number) => void
}

let {
    scene,
    selected = false,
    selectMode = false,
    isProcessing = false,
    slideshowCount = 4,
    onToggleSelect,
}: Props = $props()

const queryClient = useQueryClient()
let currentThumbIndex = $state(0)
let deleteOpen = $state(false)
let interval: ReturnType<typeof setInterval> | null = null

const queueCount = $derived(scene.queueCount ?? 0)
const inQueue = $derived(queueCount > 0)
const images = $derived(scene.latestImages ?? [])
const cycleImages = $derived(slideshowCount > 0 ? images.slice(-slideshowCount) : images)
const currentThumbImg = $derived(cycleImages[currentThumbIndex] ?? null)

$effect(() => {
    if (interval) clearInterval(interval)
    currentThumbIndex = 0
    if (cycleImages.length <= 1) return
    interval = setInterval(() => {
        currentThumbIndex = (currentThumbIndex + 1) % cycleImages.length
    }, 2000)
})

onDestroy(() => {
    if (interval) clearInterval(interval)
})

const deleteScene = createMutation(() => ({
    mutationFn: () => api.scenes({ id: scene.id }).delete(),
    onSuccess: () =>
        queryClient.invalidateQueries({
            queryKey: qk.scenes(scene.projectId),
        }),
}))
const duplicateScene = createMutation(() => ({
    mutationFn: () => api.scenes({ id: scene.id }).duplicate.post(),
    onSuccess: () =>
        queryClient.invalidateQueries({
            queryKey: qk.scenes(scene.projectId),
        }),
}))
const enqueue = createMutation(() => ({
    mutationFn: () => api.queue.enqueue.post({ sceneId: scene.id }),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [qk.queueStatus()] })
        queryClient.invalidateQueries({
            queryKey: qk.scenes(scene.projectId),
        })
    },
}))
const clearQueue = createMutation(() => ({
    mutationFn: () => api.queue.delete({ query: { sceneId: scene.id } }),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: qk.queueStatus() })
        queryClient.invalidateQueries({
            queryKey: qk.scenes(scene.projectId),
        })
    },
}))
</script>

<ContextMenu.Root>
	<ContextMenu.Trigger>
		<div
			class={cn(
				"relative flex w-56 flex-col overflow-hidden rounded-lg border bg-card transition-all hover:shadow-md",
				inQueue &&
					"border-primary shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary)_30%,transparent)]",
				selected && "ring-2 ring-primary ring-offset-2",
			)}
		>
			{#if inQueue}
				<div
					class="absolute top-1.5 right-1.5 z-20 rounded bg-primary px-1.5 py-0.5 text-[10px] leading-none font-semibold text-primary-foreground shadow"
				>
					큐 {queueCount}
				</div>
			{/if}

			{#if selectMode && onToggleSelect}
				<button
					type="button"
					class={cn(
						"absolute top-1.5 left-1.5 z-20 flex h-5 w-5 items-center justify-center rounded border-2 transition-colors",
						selected
							? "border-primary bg-primary text-primary-foreground"
							: "border-white/70 bg-black/30 text-transparent hover:border-primary",
					)}
					onclick={(event) => {
						event.stopPropagation();
						onToggleSelect?.(scene.id);
					}}
				>
					<Check class="h-3 w-3" />
				</button>
			{/if}

			<button
				type="button"
				class="group relative aspect-[3/4] w-full overflow-hidden bg-muted text-left"
				onclick={() => goto(`/scene/${scene.id}/images`)}
			>
				{#if currentThumbImg === null}
					<div class="flex h-full items-center justify-center">
						<Image class="h-10 w-10 text-muted-foreground/20" />
					</div>
				{:else}
					<img
						src={imageUrl(
							currentThumbImg.thumbnailPath ??
								currentThumbImg.filePath,
						)}
						alt={scene.name}
						class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
						loading="lazy"
					/>
				{/if}

				<div
					class="absolute right-0 bottom-0 left-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/65 to-transparent px-1.5 pt-8 pb-1.5"
				>
					<span
						class="min-w-0 truncate text-[10px] font-medium text-white/90"
						>{scene.name}</span
					>
					{#if cycleImages.length > 1}
						<div class="flex shrink-0 gap-1">
							{#each cycleImages as _, index}
								<div
									class={cn(
										"h-1 w-1 rounded-full transition-colors",
										index === currentThumbIndex
											? "bg-white"
											: "bg-white/35",
									)}
								></div>
							{/each}
						</div>
					{/if}
					<span
						class="shrink-0 text-[10px] font-medium text-white/90"
					>
						{(scene.imageCount ?? 0) > 0
							? `${scene.imageCount}장`
							: ""}
					</span>
				</div>

				{#if isProcessing}
					<div
						class="absolute inset-0 flex items-center justify-center bg-primary/20 backdrop-blur-[2px]"
					>
						<div class="flex flex-col items-center gap-1.5">
							<Spinner
								class="h-7 w-7 animate-spin text-white drop-shadow"
							/>
							<span
								class="text-[10px] font-semibold text-white drop-shadow"
								>생성 중</span
							>
						</div>
					</div>
				{/if}
			</button>

			<div class="flex border-t">
				<Button
					variant="ghost"
					size="sm"
					class="h-8 flex-1 gap-1 rounded-none text-xs"
					onclick={() => enqueue.mutate()}
					disabled={enqueue.isPending}
				>
					<ListPlus class="h-3.5 w-3.5" />큐 추가
				</Button>
				<div class="w-px bg-border"></div>
				<Button
					variant="ghost"
					size="sm"
					class="h-8 flex-1 gap-1 rounded-none text-xs text-muted-foreground hover:text-destructive"
					onclick={() => clearQueue.mutate()}
					disabled={clearQueue.isPending || !inQueue}
				>
					<Trash class="h-3.5 w-3.5" />큐 삭제
				</Button>
				<div class="w-px bg-border"></div>
				<Button
					variant="ghost"
					size="sm"
					class="h-8 flex-1 gap-1 rounded-none text-xs"
					onclick={() => goto(`/scene/${scene.id}`)}
				>
					<Pencil class="h-3.5 w-3.5" />
					수정
				</Button>
			</div>
		</div>
	</ContextMenu.Trigger>
	<ContextMenu.Content>
		<ContextMenu.Item
			onclick={() => duplicateScene.mutate()}
			disabled={duplicateScene.isPending}
		>
			<Copy class="mr-2 h-4 w-4" />
			복제
		</ContextMenu.Item>
		<ContextMenu.Separator />
		<ContextMenu.Item
			class="text-destructive focus:text-destructive"
			onclick={() => (deleteOpen = true)}
		>
			<Trash class="mr-2 h-4 w-4" />
			삭제
		</ContextMenu.Item>
	</ContextMenu.Content>
</ContextMenu.Root>

<ConfirmDeleteDialog
	bind:open={deleteOpen}
	title="씬 삭제"
	description={`"${scene.name}" 씬과 모든 생성된 이미지를 삭제합니다. 되돌릴 수 없습니다.`}
	onConfirm={() => deleteScene.mutate()}
/>
