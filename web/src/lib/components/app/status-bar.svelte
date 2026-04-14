<script lang="ts">
    import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query'
    import { api } from '$lib/api'
    import { qk } from '$lib/queries'
    import PlayIcon from '@lucide/svelte/icons/play'
    import SquareIcon from '@lucide/svelte/icons/square'
    import LoaderIcon from '@lucide/svelte/icons/loader'
    import Trash2Icon from '@lucide/svelte/icons/trash-2'

    const queryClient = useQueryClient()

    const statusQuery = createQuery(() => ({
        queryKey: qk.queueStatus(),
        queryFn: async () => {
            const { data } = await api.api.queue.status.get()
            return data ?? { running: false, processing: false, pendingCount: 0, estimatedSeconds: null, currentSceneId: null as number | null }
        },
        refetchInterval: 2000,
    }))

    const startQueue = createMutation(() => ({
        mutationFn: () => api.api.queue.start.post(),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.queueStatus() }),
    }))

    const stopQueue = createMutation(() => ({
        mutationFn: () => api.api.queue.stop.post(),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.queueStatus() }),
    }))

    const clearAll = createMutation(() => ({
        mutationFn: () => api.api.queue.delete(),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.queueStatus() }),
    }))

    let status = $derived(statusQuery.data ?? { running: false, processing: false, pendingCount: 0, estimatedSeconds: null as number | null, currentSceneId: null as number | null })
</script>

<div class="flex h-10 shrink-0 items-center border-t bg-primary text-xs text-primary-foreground">
    <!-- Status indicator -->
    <div class="flex items-center gap-2 px-4">
        {#if status.running}
            {#if status.processing}
                <LoaderIcon class="h-3.5 w-3.5 animate-spin opacity-80" />
            {:else}
                <span class="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_6px_1px_#4ade80]"></span>
            {/if}
            <span class="font-medium">{status.processing ? '생성 중' : '실행 중'}</span>
        {:else}
            <span class="h-2 w-2 rounded-full bg-primary-foreground/30"></span>
            <span class="opacity-70">정지됨</span>
        {/if}
    </div>

    <div class="h-4 w-px bg-primary-foreground/20"></div>

    <!-- Queue count -->
    <div class="flex items-center gap-1.5 px-4">
        <span class="font-semibold tabular-nums">{status.pendingCount}개</span>
        <span class="opacity-70">남음</span>
        {#if status.estimatedSeconds !== null && status.pendingCount > 0}
            <span class="opacity-50">(예상 {status.estimatedSeconds >= 60
                ? Math.ceil(status.estimatedSeconds / 60) + '분'
                : status.estimatedSeconds + '초'})</span>
        {/if}
    </div>

    <div class="flex-1"></div>

    <!-- Actions -->
    <div class="flex h-full items-center divide-x divide-primary-foreground/20">
        {#if status.pendingCount > 0}
            <button
                onclick={() => clearAll.mutate()}
                disabled={clearAll.isPending}
                class="flex h-full items-center gap-1.5 px-4 hover:bg-primary-foreground/15 disabled:opacity-50 transition-colors"
                title="큐 전체 삭제"
            >
                <Trash2Icon class="h-3.5 w-3.5" />
                전체 삭제
            </button>
        {/if}

        {#if status.running}
            <button
                onclick={() => stopQueue.mutate()}
                class="flex h-full items-center gap-1.5 px-4 hover:bg-primary-foreground/15 transition-colors"
            >
                <SquareIcon class="h-3.5 w-3.5" />
                정지
            </button>
        {:else}
            <button
                onclick={() => startQueue.mutate()}
                class="flex h-full items-center gap-1.5 px-4 hover:bg-primary-foreground/15 transition-colors"
            >
                <PlayIcon class="h-3.5 w-3.5" />
                시작
            </button>
        {/if}
    </div>
</div>
