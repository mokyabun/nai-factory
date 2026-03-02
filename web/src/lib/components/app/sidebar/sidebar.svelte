<script lang="ts">
    import ArchiveXIcon from '@lucide/svelte/icons/archive-x'
    import FileIcon from '@lucide/svelte/icons/file'
    import BalloonIcon from '@lucide/svelte/icons/balloon'
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

    let isInProject = page.url.pathname.startsWith('/project/')

    const data = {
        navMain: [
            {
                title: '프로젝트',
                query: 'project',
                icon: FileIcon,
                isActive: true,
            },
            {
                title: '프롬프트',
                query: 'prompt',
                icon: TextAlignStartIcon,
                isActive: false,
                isHidden: !isInProject,
            },
            {
                title: '빠른 생성',
                query: 'quick-create',
                icon: BalloonIcon,
                isActive: false,
            },
            {
                title: '번들',
                query: 'bundle',
                icon: ArchiveXIcon,
                isActive: false,
            },
            {
                title: '휴지통',
                query: 'trash',
                icon: Trash2Icon,
                isActive: false,
            },
            {
                title: '설정',
                query: 'settings',
                icon: SettingsIcon,
                isActive: false,
            },
        ],
    }

    let { ref = $bindable(null), ...restProps }: ComponentProps<typeof Sidebar.Root> = $props()
    let activeItem = $state(data.navMain[0])

    const sidebarQueryParam = $derived(page.url.searchParams.get('sidebar'))

    $inspect(sidebarQueryParam, 'sidebarQueryParam')

    const sidebar = useSidebar()
</script>

<Sidebar.Root
    bind:ref
    collapsible="icon"
    class="overflow-hidden [&>[data-sidebar=sidebar]]:flex-row"
    {...restProps}
>
    <!-- This is the first sidebar -->
    <!-- We disable collapsible and adjust width to icon. -->
    <!-- This will make the sidebar appear as icons. -->
    <Sidebar.Root collapsible="none" class="!w-[calc(var(--sidebar-width-icon)_+_1px)] border-e">
        <SidebarHeader />
        <Sidebar.Content>
            <Sidebar.Group>
                <Sidebar.GroupContent class="px-1.5 md:px-0">
                    <Sidebar.Menu>
                        {#each data.navMain as item (item.title)}
                            {#if !item.isHidden}
                                <Sidebar.MenuItem>
                                    <Sidebar.MenuButton
                                        tooltipContentProps={{
                                            hidden: false,
                                        }}
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
                            {/if}
                        {/each}
                    </Sidebar.Menu>
                </Sidebar.GroupContent>
            </Sidebar.Group>
        </Sidebar.Content>
        <SidebarFooter />
    </Sidebar.Root>
    <!-- This is the second sidebar -->
    <!-- We disable collapsible and let it fill remaining space -->
    <Sidebar.Root collapsible="none" class="hidden flex-1 md:flex">
        {#if activeItem.title === '프로젝트'}
            <SidebarProject />
        {:else if activeItem.title === '설정'}
            <SidebarSettings />
        {:else if activeItem.title === '프롬프트'}
            <SidebarPrompt />
        {/if}
        <Sidebar.Rail />
    </Sidebar.Root>
</Sidebar.Root>
