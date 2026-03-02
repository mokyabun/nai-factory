<script lang="ts">
    import './layout.css'
    import favicon from '$lib/assets/favicon.svg'
    import AppSidebar from '$lib/components/app/sidebar/sidebar.svelte'
    import AppHeader from '$lib/components/app/layout/header.svelte'
    import * as Sidebar from '$lib/components/ui/sidebar'

    let { children } = $props()
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<Sidebar.Provider style="--sidebar-width: 350px;">
    <AppSidebar />
    <Sidebar.Inset>
        <AppHeader />
        <div class="flex flex-1 flex-col gap-4 p-4">
            {@render children()}
        </div>
    </Sidebar.Inset>
</Sidebar.Provider>
