<script lang="ts">
    import { page } from '$app/state'
    import { goto } from '$app/navigation'
    import { createQuery } from '@tanstack/svelte-query'
    import { api } from '$lib/api'
    import { qk } from '$lib/queries'
    import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left'
    import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
    import XIcon from '@lucide/svelte/icons/x'

    const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

    const imageId = $derived(+page.params.imageId)
    const sceneId = $derived(+(page.url.searchParams.get('scene') ?? '0'))
    const projectId = $derived(page.params.id)

    const imagesQuery = createQuery(() => ({
        queryKey: qk.images(sceneId),
        queryFn: async () => {
            const { data } = await api.api.images.get({ query: { sceneId } })
            return data ?? []
        },
        enabled: sceneId > 0,
    }))

    const images = $derived(imagesQuery.data ?? [])
    const currentIndex = $derived(images.findIndex((i) => i.id === imageId))
    const currentImage = $derived(currentIndex >= 0 ? images[currentIndex] : null)

    function getImageUrl(path: string) {
        return `${BASE_URL}/${path}`
    }

    function navigateTo(index: number) {
        const target = images[(index + images.length) % images.length]
        if (target) goto(`/project/${projectId}/images/${target.id}?scene=${sceneId}`, { replaceState: false })
    }

    function navigatePrev() { navigateTo(currentIndex - 1) }
    function navigateNext() { navigateTo(currentIndex + 1) }

    function close() { history.back() }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === 'ArrowLeft') navigatePrev()
        else if (e.key === 'ArrowRight') navigateNext()
        else if (e.key === 'Escape') close()
    }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black">
    <!-- Close -->
    <button
        class="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
        onclick={close}
    >
        <XIcon class="h-5 w-5" />
    </button>

    <!-- Prev -->
    <button
        class="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25 disabled:opacity-30"
        onclick={navigatePrev}
        disabled={images.length <= 1}
    >
        <ChevronLeftIcon class="h-7 w-7" />
    </button>

    <!-- Image -->
    {#if currentImage}
        <img
            src={getImageUrl(currentImage.filePath)}
            alt="generated"
            class="max-h-screen max-w-[calc(100vw-8rem)] object-contain"
        />
    {:else if imagesQuery.isPending}
        <div class="h-48 w-48 animate-pulse rounded-lg bg-white/10"></div>
    {/if}

    <!-- Next -->
    <button
        class="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25 disabled:opacity-30"
        onclick={navigateNext}
        disabled={images.length <= 1}
    >
        <ChevronRightIcon class="h-7 w-7" />
    </button>

    <!-- Index indicator -->
    {#if images.length > 0}
        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm text-white">
            {currentIndex + 1} / {images.length}
        </div>
    {/if}
</div>
