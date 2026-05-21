<script lang="ts">
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { createQuery } from '@tanstack/svelte-query'
import { ArrowLeft, CaretLeft, CaretRight, DownloadSimple } from 'phosphor-svelte'
import { onDestroy, onMount } from 'svelte'
import { Button } from '$lib/components/ui/button'
import { api, imageUrl } from '$lib/api'
import { qk } from '$lib/query-keys'
import type { ImageItem } from '$lib/types'
import { cn } from '$lib/utils'

const sceneId = $derived(Number(page.params.sceneId))
const imageId = $derived(Number(page.params.imageId))

const imagesQuery = createQuery(() => ({
    queryKey: qk.images(sceneId),
    queryFn: async () => {
        const { data } = await api.images.get({ query: { sceneId } })
        return (data ?? []) as ImageItem[]
    },
}))

const images = $derived(imagesQuery.data ?? [])
const currentIndex = $derived(images.findIndex((image) => image.id === imageId))
const current = $derived(images[currentIndex] ?? null)

function goTo(img: ImageItem) {
    goto(`/scene/${sceneId}/images/${img.id}`)
}

function goPrev() {
    if (currentIndex > 0) goTo(images[currentIndex - 1])
}

function goNext() {
    if (currentIndex < images.length - 1) goTo(images[currentIndex + 1])
}

function handleKey(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft') goPrev()
    if (event.key === 'ArrowRight') goNext()
    if (event.key === 'Escape') goto(`/scene/${sceneId}/images`)
}

onMount(() => window.addEventListener('keydown', handleKey))
onDestroy(() => window.removeEventListener('keydown', handleKey))
</script>

<div class="fixed inset-0 z-50 flex flex-col bg-black/95">
	<div class="flex items-center justify-between px-4 py-3">
		<Button
			variant="ghost"
			size="icon"
			class="text-white/70 hover:bg-white/10 hover:text-white"
			onclick={() => goto(`/scene/${sceneId}/images`)}
		>
			<ArrowLeft class="h-5 w-5" />
		</Button>

		<span class="text-sm text-white/60">{currentIndex + 1} / {images.length}</span>

		{#if current}
			<a
				href={imageUrl(current.filePath)}
				download
				class="inline-flex h-9 w-9 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white"
			>
				<DownloadSimple class="h-5 w-5" />
			</a>
		{/if}
	</div>

	<div class="relative flex flex-1 items-center justify-center overflow-hidden">
		{#if current}
			<img
				src={imageUrl(current.filePath)}
				alt=""
				class="max-h-full max-w-full object-contain"
				draggable="false"
			/>
		{:else}
			<span class="text-sm text-white/40">이미지를 찾을 수 없습니다.</span>
		{/if}

		{#if currentIndex > 0}
			<button
				type="button"
				class="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
				onclick={goPrev}
			>
				<CaretLeft class="h-6 w-6" />
			</button>
		{/if}
		{#if currentIndex < images.length - 1}
			<button
				type="button"
				class="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
				onclick={goNext}
			>
				<CaretRight class="h-6 w-6" />
			</button>
		{/if}
	</div>

	{#if images.length > 1}
		<div class="flex gap-2 overflow-x-auto px-4 py-3">
			{#each images as img, index (img.id)}
				<button
					type="button"
					onclick={() => goTo(img)}
					class={cn(
						'relative h-14 w-10 shrink-0 overflow-hidden rounded transition-opacity',
						index === currentIndex ? 'opacity-100 ring-2 ring-white' : 'opacity-50 hover:opacity-80'
					)}
				>
					<img
						src={imageUrl(img.thumbnailPath ?? img.filePath)}
						alt=""
						class="h-full w-full object-cover"
						loading="lazy"
					/>
				</button>
			{/each}
		</div>
	{/if}
</div>
