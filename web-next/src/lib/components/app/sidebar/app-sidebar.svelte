<script lang="ts">
import { page } from '$app/state'
import { goto } from '$app/navigation'
import { AlignLeft, Factory, File, Gear } from 'phosphor-svelte'
import * as Sidebar from '$lib/components/ui/sidebar'
import SidebarProject from './sidebar-project.svelte'
import SidebarPrompt from './sidebar-prompt.svelte'
import SidebarSettings from './sidebar-settings.svelte'

let { projectId = null }: { projectId?: number | null } = $props()

const sidebar = Sidebar.useSidebar()
type SidebarPanel = 'project' | 'prompt' | 'settings'
let activePanel = $state<SidebarPanel>('project')
const search = $derived(page.url.search)

$effect(() => {
    const panel = new URLSearchParams(search).get('sidebar')
    if (panel === 'project' || panel === 'prompt' || panel === 'settings') activePanel = panel
})

const topItems = $derived([
    { title: '프로젝트', panel: 'project' as const, icon: File },
    ...(projectId ? [{ title: '프롬프트', panel: 'prompt' as const, icon: AlignLeft }] : []),
])
const bottomItems = [{ title: '설정', panel: 'settings' as const, icon: Gear }]

function handlePanelClick(panel: SidebarPanel) {
    if (activePanel === panel) {
        sidebar.setOpen(!sidebar.open)
        return
    }
    activePanel = panel
    sidebar.setOpen(true)
    const url = new URL(window.location.href)
    url.searchParams.set('sidebar', panel)
    window.history.replaceState(null, '', url.toString())
}
</script>

<Sidebar.Root collapsible="icon" class="overflow-hidden [&>[data-sidebar=sidebar]]:flex-row">
	<Sidebar.Root collapsible="none" class="!w-[calc(var(--sidebar-width-icon)_+_1px)] border-e">
		<Sidebar.Header>
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton size="lg" class="md:h-8 md:p-0" onclick={() => goto('/')}>
						<div
							class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
						>
							<Factory class="size-4" />
						</div>
						<div class="grid flex-1 text-left text-sm leading-tight">
							<span class="truncate font-semibold">NAI Factory</span>
							<span class="truncate text-xs">Local</span>
						</div>
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</Sidebar.Header>
		<Sidebar.Content>
			<Sidebar.Group class="h-full">
				<Sidebar.GroupContent class="h-full px-1.5 md:px-0">
					<Sidebar.Menu class="flex h-full flex-col">
						{#each topItems as item}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton
									tooltipContent={item.title}
									onclick={() => handlePanelClick(item.panel)}
									isActive={activePanel === item.panel}
									class="px-2.5 md:px-2"
								>
									<item.icon />
									<span>{item.title}</span>
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
						{/each}
						<div class="mt-auto">
							{#each bottomItems as item}
								<Sidebar.MenuItem>
									<Sidebar.MenuButton
										tooltipContent={item.title}
										onclick={() => handlePanelClick(item.panel)}
										isActive={activePanel === item.panel}
										class="px-2.5 md:px-2"
									>
										<item.icon />
										<span>{item.title}</span>
									</Sidebar.MenuButton>
								</Sidebar.MenuItem>
							{/each}
						</div>
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		</Sidebar.Content>
		<Sidebar.Footer />
	</Sidebar.Root>

	<Sidebar.Root collapsible="none" class="hidden flex-1 md:flex">
		{#if activePanel === 'project'}
			<SidebarProject />
		{:else if activePanel === 'prompt' && projectId}
			<SidebarPrompt {projectId} />
		{:else if activePanel === 'settings'}
			<SidebarSettings />
		{/if}
		<Sidebar.Rail />
	</Sidebar.Root>
</Sidebar.Root>
