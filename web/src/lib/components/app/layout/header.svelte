<script lang="ts">
    import { page } from '$app/state'
    import * as Breadcrumb from '$lib/components/ui/breadcrumb'
    import { Separator } from '$lib/components/ui/separator'
    import * as Sidebar from '$lib/components/ui/sidebar'

    let currentPage = $derived.by(() => {
        const path = page.url.pathname

        // Convert the path to an array of parts, capitalizing each part
        const paths =
            path === '/'
                ? ['Home']
                : path
                      .slice(1)
                      .split('/')
                      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))

        return paths
    })
</script>

{#snippet Route({ name, last }: { name: string; last: boolean })}
    <Breadcrumb.Item>
        <Breadcrumb.Link href="##">{name}</Breadcrumb.Link>
    </Breadcrumb.Item>
    {#if !last}
        <Breadcrumb.Separator />
    {/if}
{/snippet}

<header class="sticky top-0 flex shrink-0 items-center gap-2 border-b bg-background p-4">
    <Sidebar.Trigger class="-ms-1" />
    <Separator orientation="vertical" class="me-2 data-[orientation=vertical]:h-4" />
    <Breadcrumb.Root>
        <Breadcrumb.List>
            {#each currentPage as part, index (index)}
                {@render Route({ name: part, last: index === currentPage.length - 1 })}
            {/each}
        </Breadcrumb.List>
    </Breadcrumb.Root>
</header>
