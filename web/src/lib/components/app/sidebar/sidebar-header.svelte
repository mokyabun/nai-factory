<script lang="ts">
    import FactoryIcon from '@lucide/svelte/icons/factory'
    import * as Sidebar from '$lib/components/ui/sidebar'
</script>

<Sidebar.Header>
    <Sidebar.Menu>
        <Sidebar.MenuItem>
            <Sidebar.MenuButton size="lg" class="md:h-8 md:p-0">
                {#snippet child({ props })}
                    <a href="/" {...props}>
                        <div
                            class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
                        >
                            <FactoryIcon class="size-4" />
                        </div>
                        <div class="grid flex-1 text-start text-sm leading-tight">
                            <span class="truncate font-medium">NAI Factory</span>
                            <span class="truncate text-xs">Local</span>
                        </div>
                    </a>
                {/snippet}
            </Sidebar.MenuButton>
        </Sidebar.MenuItem>
    </Sidebar.Menu>
</Sidebar.Header>
