<script lang="ts">
import { createQuery, useQueryClient } from '@tanstack/svelte-query'
import { page } from '$app/state'
import { FileJs } from 'phosphor-svelte'
import type { Snippet } from 'svelte'
import SdStudioImportDialog from '$lib/components/app/dialogs/sd-studio-import-dialog.svelte'
import Header from '$lib/components/app/header.svelte'
import AppSidebar from '$lib/components/app/sidebar/app-sidebar.svelte'
import StatusBar from '$lib/components/app/status-bar.svelte'
import * as Sidebar from '$lib/components/ui/sidebar'
import { api, BASE_URL } from '$lib/api'
import { qk } from '$lib/query-keys'

let { children }: { children: Snippet } = $props()

const queryClient = useQueryClient()
let dragDepth = $state(0)
let pendingFile = $state<File | null>(null)
let importDialogOpen = $state(false)

const pathname = $derived(page.url.pathname)
const projectIdFromPath = $derived(
    pathname.startsWith('/project/') ? Number(pathname.split('/')[2]) || null : null,
)
const sceneIdFromPath = $derived(
    pathname.startsWith('/scene/') ? Number(pathname.split('/')[2]) || null : null,
)

const sceneContextQuery = createQuery(() => ({
    queryKey: qk.sceneContext(sceneIdFromPath ?? 0),
    queryFn: async () => {
        const { data } = await api.scenes({ id: sceneIdFromPath as number }).summary.get()
        return data ? { projectId: (data as { projectId: number }).projectId } : null
    },
    enabled: sceneIdFromPath !== null,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
}))

const activeProjectId = $derived(projectIdFromPath ?? sceneContextQuery.data?.projectId ?? null)
const isDragOver = $derived(dragDepth > 0)

$effect(() => {
    const es = new EventSource(`${BASE_URL}/sse`)
    let reconnected = false

    es.addEventListener('open', () => {
        if (reconnected) queryClient.invalidateQueries()
        reconnected = true
    })

    es.onmessage = (event: MessageEvent<string>) => {
        try {
            const { domain } = JSON.parse(event.data) as { domain: string }
            if (domain === 'images') {
                queryClient.invalidateQueries({
                    predicate: (query) =>
                        query.queryKey[0] === 'images' || query.queryKey[0] === 'scenes',
                })
            }
            if (domain === 'queue') {
                queryClient.invalidateQueries({
                    predicate: (query) =>
                        query.queryKey[0] === 'queue' || query.queryKey[0] === 'scenes',
                })
            }
        } catch {
            return
        }
    }

    return () => es.close()
})

function hasFiles(event: DragEvent) {
    return event.dataTransfer?.types.includes('Files') ?? false
}

function handleDragEnter(event: DragEvent) {
    if (!hasFiles(event)) return
    event.preventDefault()
    dragDepth += 1
}

function handleDragOver(event: DragEvent) {
    if (!hasFiles(event)) return
    event.preventDefault()
}

function handleDragLeave() {
    dragDepth = Math.max(0, dragDepth - 1)
}

function handleDrop(event: DragEvent) {
    event.preventDefault()
    dragDepth = 0
    const file = Array.from(event.dataTransfer?.files ?? []).find((item) =>
        item.name.endsWith('.json'),
    )
    if (!file) return
    pendingFile = file
    importDialogOpen = true
}

function handleImportOpenChange(open: boolean) {
    importDialogOpen = open
    if (!open) pendingFile = null
}
</script>

<div
	role="application"
	class="relative flex h-screen flex-col overflow-hidden"
	ondragenter={handleDragEnter}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
>
	{#if isDragOver}
		<div
			class="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm"
		>
			<div
				class="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary bg-background/90 px-16 py-12"
			>
				<FileJs class="size-12 text-primary" />
				<p class="text-base font-medium">SD Studio JSON 파일 놓기</p>
			</div>
		</div>
	{/if}

	<Sidebar.Provider style="--sidebar-width: 350px;">
		<AppSidebar projectId={activeProjectId} />
		<Sidebar.Inset class="flex flex-col overflow-hidden">
			<Header />
			<div class="flex flex-1 flex-col overflow-auto p-4">
				{@render children()}
			</div>
			<StatusBar />
		</Sidebar.Inset>
	</Sidebar.Provider>
</div>

<SdStudioImportDialog
	bind:open={importDialogOpen}
	file={pendingFile}
	projectId={activeProjectId}
	onOpenChange={handleImportOpenChange}
/>
