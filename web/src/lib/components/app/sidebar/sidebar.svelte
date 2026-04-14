<script lang="ts" module>
    import type { Icon } from '@lucide/svelte'

    interface SidebarItem {
        title: string
        query: string
        icon: typeof Icon
        isHidden?: boolean
    }
</script>

<script lang="ts">
    import ArchiveXIcon from '@lucide/svelte/icons/archive-x'
    import FileIcon from '@lucide/svelte/icons/file'
    import Trash2Icon from '@lucide/svelte/icons/trash-2'
    import SettingsIcon from '@lucide/svelte/icons/settings'
    import TextAlignStartIcon from '@lucide/svelte/icons/text-align-start'
    import * as Sidebar from '$lib/components/ui/sidebar'
    import { useSidebar } from '$lib/components/ui/sidebar/context.svelte.js'
    import type { ComponentProps } from 'svelte'
    import SidebarFooter from './sidebar-footer.svelte'
    import SidebarHeader from './sidebar-header.svelte'
    import SidebarProject from './sidebar-project.svelte'
    import { page } from '$app/state'
    import SidebarSettings from './sidebar-settings.svelte'
    import SidebarPrompt from './sidebar-prompt.svelte'
    import { replaceState } from '$app/navigation'

    let { ref = $bindable(null), ...restProps }: ComponentProps<typeof Sidebar.Root> = $props()

    let isInProject = $derived(page.url.pathname.startsWith('/project/'))

    const allItems: SidebarItem[] = [
        { title: '프로젝트', query: 'project', icon: FileIcon },
        { title: '프롬프트', query: 'prompt', icon: TextAlignStartIcon },
        { title: '번들', query: 'bundle', icon: ArchiveXIcon },
        { title: '휴지통', query: 'trash', icon: Trash2Icon },
        { title: '설정', query: 'settings', icon: SettingsIcon },
    ]

    let topItemQueries = $derived(['project', ...(isInProject ? ['prompt'] : [])])
    let bottomItemQueries = ['settings']
    let topItems = $derived(allItems.filter((i) => topItemQueries.includes(i.query)))
    let bottomItems = allItems.filter((i) => bottomItemQueries.includes(i.query))

    let activeItem = $state(allItems[0])

    const sidebarQueryParam = $derived(page.url.searchParams.get('sidebar'))

    $effect(() => {
        if (sidebarQueryParam) {
            const match = allItems.find((i) => i.query === sidebarQueryParam)
            if (match) activeItem = match
        }
    })

    const sidebar = useSidebar()
</script>

{#snippet sidebarButton(item: SidebarItem)}
    <Sidebar.MenuItem>
        <Sidebar.MenuButton
            tooltipContentProps={{ hidden: false }}
            onclick={() => {
                if (activeItem.title === item.title) {
                    sidebar.setOpen(!sidebar.open)
                    return
                }

                const url = new URL(page.url)
                url.searchParams.set('sidebar', item.query)
                replaceState(url, {})

                activeItem = item
                sidebar.setOpen(true)
            }}
            isActive={activeItem.title === item.title}
            class="px-2.5 md:px-2"
        >
            {#snippet tooltipContent()}
                {item.title}
            {/snippet}
            <item.icon />
            <span>{item.title}</span>
        </Sidebar.MenuButton>
    </Sidebar.MenuItem>
{/snippet}

<Sidebar.Root
    bind:ref
    collapsible="icon"
    class="overflow-hidden [&>[data-sidebar=sidebar]]:flex-row"
    {...restProps}
>
    <!-- Icon rail -->
    <Sidebar.Root collapsible="none" class="!w-[calc(var(--sidebar-width-icon)_+_1px)] border-e">
        <SidebarHeader />
        <Sidebar.Content>
            <Sidebar.Group class="h-full">
                <Sidebar.GroupContent class="h-full px-1.5 md:px-0">
                    <Sidebar.Menu class="flex h-full flex-col">
                        {#each topItems as item (item.title)}
                            {@render sidebarButton(item)}
                        {/each}
                        <div class="mt-auto">
                            {#each bottomItems as item (item.title)}
                                {@render sidebarButton(item)}
                            {/each}
                        </div>
                    </Sidebar.Menu>
                </Sidebar.GroupContent>
            </Sidebar.Group>
        </Sidebar.Content>
        <SidebarFooter />
    </Sidebar.Root>
    <!-- Panel -->
    <Sidebar.Root collapsible="none" class="hidden flex-1 md:flex">
        {#if activeItem.query === 'project'}
            <SidebarProject />
        {:else if activeItem.query === 'prompt'}
            <SidebarPrompt />
        {:else if activeItem.query === 'settings'}
            <SidebarSettings />
        {/if}
        <Sidebar.Rail />
    </Sidebar.Root>
</Sidebar.Root>
