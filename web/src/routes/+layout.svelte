<script lang="ts">
    import './layout.css'
    import favicon from '$lib/assets/favicon.svg'
    import AppSidebar from '$lib/components/app/sidebar/sidebar.svelte'
    import AppHeader from '$lib/components/app/layout/header.svelte'
    import StatusBar from '$lib/components/app/status-bar.svelte'
    import * as Sidebar from '$lib/components/ui/sidebar'
    import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query'
    import { type EventDomain, domainQueryPrefixes } from '$lib/queries'
    import { BASE_URL } from '$lib/api'

    let { children } = $props()

    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { staleTime: 5000 },
        },
    })

    $effect(() => {
        const es = new EventSource(`${BASE_URL}/api/sse`)
        const pending = new Set<EventDomain>()
        let raf: number | null = null
        let connected = false

        function flush() {
            raf = null
            for (const domain of pending) {
                const prefixes = domainQueryPrefixes[domain]
                if (!prefixes) continue
                for (const prefix of prefixes) {
                    queryClient.invalidateQueries({ queryKey: prefix })
                }
            }
            pending.clear()
        }

        es.addEventListener('open', () => {
            if (connected) {
                // Reconnected after a drop — refetch everything to recover missed events
                queryClient.invalidateQueries()
            }
            connected = true
        })

        es.onmessage = (e: MessageEvent<string>) => {
            try {
                const { domain } = JSON.parse(e.data) as { domain: EventDomain }
                pending.add(domain)
                if (raf === null) {
                    raf = requestAnimationFrame(flush)
                }
            } catch {
                // Ignore malformed messages
            }
        }

        return () => {
            if (raf !== null) cancelAnimationFrame(raf)
            es.close()
        }
    })
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<QueryClientProvider client={queryClient}>
    <div class="flex h-screen flex-col overflow-hidden">
        <Sidebar.Provider class="min-h-0 flex-1" style="--sidebar-width: 350px;">
            <AppSidebar />
            <Sidebar.Inset class="flex flex-col overflow-hidden">
                <AppHeader />
                <div class="flex flex-1 flex-col overflow-auto p-4">
                    {@render children()}
                </div>
                <StatusBar />
            </Sidebar.Inset>
        </Sidebar.Provider>
    </div>
</QueryClientProvider>
