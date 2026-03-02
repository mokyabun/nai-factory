<script lang="ts">
    import CommandIcon from '@lucide/svelte/icons/command'
    import * as Sidebar from '$lib/components/ui/sidebar'
</script>

<Sidebar.Header>
    <Sidebar.Menu>
        <Sidebar.MenuItem>
            <Sidebar.MenuButton size="lg" class="md:h-8 md:p-0">
                {#snippet child({ props })}
                    <a href="##" {...props}>
                        <div
                            class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
                        >
                            <CommandIcon class="size-4" />
                        </div>
                        <div class="grid flex-1 text-start text-sm leading-tight">
                            <span class="truncate font-medium">Acme Inc</span>
                            <span class="truncate text-xs">Enterprise</span>
                        </div>
                    </a>
                {/snippet}
            </Sidebar.MenuButton>
        </Sidebar.MenuItem>
    </Sidebar.Menu>
</Sidebar.Header>
