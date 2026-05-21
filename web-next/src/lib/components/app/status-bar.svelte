<script lang="ts">
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { Play, Spinner, Square, Trash } from 'phosphor-svelte'
import { api } from '$lib/api'
import { qk } from '$lib/query-keys'
import type { QueueStatus } from '$lib/types'

const queryClient = useQueryClient()

const statusQuery = createQuery(() => ({
    queryKey: qk.queueStatus(),
    queryFn: async () => {
        const { data } = await api.queue.status.get()
        return (data ?? {
            running: false,
            processing: false,
            pendingCount: 0,
            estimatedSeconds: null,
            currentSceneId: null,
        }) as QueueStatus
    },
}))

const startQueue = createMutation(() => ({
    mutationFn: () => api.queue.start.post(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.queueStatus() }),
}))

const stopQueue = createMutation(() => ({
    mutationFn: () => api.queue.stop.post(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.queueStatus() }),
}))

const clearAll = createMutation(() => ({
    mutationFn: () => api.queue.delete(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.queueStatus() }),
}))

const status = $derived(
    statusQuery.data ?? {
        running: false,
        processing: false,
        pendingCount: 0,
        estimatedSeconds: null,
        currentSceneId: null,
    },
)
const pendingCount = $derived(status.pendingCount ?? status.count ?? 0)
</script>

<div class="flex h-10 shrink-0 items-center border-t bg-primary text-xs text-primary-foreground">
	<div class="flex items-center gap-2 px-4">
		{#if status.running}
			{#if status.processing}
				<Spinner class="h-3.5 w-3.5 animate-spin opacity-80" />
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

	<div class="flex items-center gap-1.5 px-4">
		<span class="font-semibold tabular-nums">{pendingCount}개</span>
		<span class="opacity-70">남음</span>
		{#if status.estimatedSeconds !== null && status.estimatedSeconds !== undefined && pendingCount > 0}
			<span class="opacity-50">
				(예상 {status.estimatedSeconds >= 60
					? `${Math.ceil(status.estimatedSeconds / 60)}분`
					: `${status.estimatedSeconds}초`})
			</span>
		{/if}
	</div>

	<div class="flex-1"></div>

	<div class="flex h-full items-center divide-x divide-primary-foreground/20">
		{#if pendingCount > 0}
			<button
				type="button"
				onclick={() => clearAll.mutate()}
				disabled={clearAll.isPending}
				class="flex h-full items-center gap-1.5 px-4 transition-colors hover:bg-primary-foreground/15 disabled:opacity-50"
			>
				<Trash class="h-3.5 w-3.5" />
				전체 삭제
			</button>
		{/if}

		{#if status.running}
			<button
				type="button"
				onclick={() => stopQueue.mutate()}
				class="flex h-full items-center gap-1.5 px-4 transition-colors hover:bg-primary-foreground/15"
			>
				<Square class="h-3.5 w-3.5" />
				정지
			</button>
		{:else}
			<button
				type="button"
				onclick={() => startQueue.mutate()}
				class="flex h-full items-center gap-1.5 px-4 transition-colors hover:bg-primary-foreground/15"
			>
				<Play class="h-3.5 w-3.5" />
				시작
			</button>
		{/if}
	</div>
</div>
