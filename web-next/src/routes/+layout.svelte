<script lang="ts">
import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query'
import AppShell from '$lib/components/app/app-shell.svelte'
import './layout.css'

let { children } = $props()
const queryClient = new QueryClient()
</script>

<svelte:head>
	<title>NAI Factory</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<QueryClientProvider client={queryClient}>
	<AppShell>
		{@render children()}
	</AppShell>
</QueryClientProvider>
