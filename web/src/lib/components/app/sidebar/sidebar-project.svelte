<script lang="ts" module>
    // This is sample data.
    const data = {
        tree: [
            ['lib', ['components', 'button.svelte', 'card.svelte'], 'utils.ts'],
            [
                'routes',
                ['hello', '+page.svelte', '+page.ts'],
                '+page.svelte',
                '+page.server.ts',
                '+layout.svelte',
            ],
            ['static', 'favicon.ico', 'svelte.svg'],
            'eslint.config.js',
            '.gitignore',
            'svelte.config.js',
            'tailwind.config.js',
            'package.json',
            'README.md',
            'tsconfig.json',
        ],
    }
</script>

<script lang="ts">
    import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
    import FileIcon from '@lucide/svelte/icons/file'
    import FolderIcon from '@lucide/svelte/icons/folder'
    import * as Collapsible from '$lib/components/ui/collapsible'
    import * as Sidebar from '$lib/components/ui/sidebar'
    import type { ComponentProps } from 'svelte'
    import { goto } from '$app/navigation'

    let { ref = $bindable(null), ...restProps }: ComponentProps<typeof Sidebar.Root> = $props()

    function handleButtonClick(item: string) {
        goto(`/project/${item.toLowerCase().replace('.svelte', '')}`)
    }
</script>

<Sidebar.Content>
    <Sidebar.Group>
        <Sidebar.GroupLabel>Files</Sidebar.GroupLabel>
        <Sidebar.GroupContent>
            <Sidebar.Menu>
                {#each data.tree as item, index (index)}
                    {@render Tree({ item })}
                {/each}
            </Sidebar.Menu>
        </Sidebar.GroupContent>
    </Sidebar.Group>
</Sidebar.Content>

<!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -->
{#snippet Tree({ item }: { item: string | any[] })}
    {@const [name, ...items] = Array.isArray(item) ? item : [item]}
    {#if !items.length}
        <Sidebar.MenuButton
            isActive={name === 'button.svelte'}
            class="data-[active=true]:bg-transparent"
            onclick={() => handleButtonClick(name)}
        >
            <FileIcon />
            {name}
        </Sidebar.MenuButton>
    {:else}
        <Sidebar.MenuItem>
            <Collapsible.Root
                class="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
                open={name === 'lib' || name === 'components'}
            >
                <Collapsible.Trigger>
                    {#snippet child({ props })}
                        <Sidebar.MenuButton {...props}>
                            <ChevronRightIcon className="transition-transform" />
                            <FolderIcon />
                            {name}
                        </Sidebar.MenuButton>
                    {/snippet}
                </Collapsible.Trigger>
                <Collapsible.Content>
                    <Sidebar.MenuSub>
                        {#each items as subItem, index (index)}
                            {@render Tree({ item: subItem })}
                        {/each}
                    </Sidebar.MenuSub>
                </Collapsible.Content>
            </Collapsible.Root>
        </Sidebar.MenuItem>
    {/if}
{/snippet}
