<script lang="ts">
import { page } from '$app/state'
import * as Breadcrumb from '$lib/components/ui/breadcrumb'
import { Separator } from '$lib/components/ui/separator'
import { SidebarTrigger } from '$lib/components/ui/sidebar'

const parts = $derived.by(() => {
    const pathname = page.url.pathname
    if (pathname === '/') return ['Home']
    return pathname
        .slice(1)
        .split('/')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
})
</script>

<header class="sticky top-0 flex shrink-0 items-center gap-2 border-b bg-background p-4">
	<SidebarTrigger class="-ms-1" />
	<Separator orientation="vertical" class="me-2 data-[orientation=vertical]:h-4" />
	<Breadcrumb.Root>
		<Breadcrumb.List>
			{#each parts as part, index}
				<Breadcrumb.Item>
					<Breadcrumb.Link href="#">{part}</Breadcrumb.Link>
					{#if index < parts.length - 1}
						<Breadcrumb.Separator />
					{/if}
				</Breadcrumb.Item>
			{/each}
		</Breadcrumb.List>
	</Breadcrumb.Root>
</header>
