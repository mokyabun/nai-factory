/** Sidebar panels, selected by the `?sidebar=` search param (see `routes/__root.tsx`). */
const SIDEBAR_PANELS = ['project', 'playground', 'prompt', 'queue'] as const

export type SidebarPanel = (typeof SIDEBAR_PANELS)[number]

export function isSidebarPanel(value: unknown): value is SidebarPanel {
    return SIDEBAR_PANELS.includes(value as SidebarPanel)
}

/** The panel a page opens with when the URL names none. */
export function defaultSidebarPanel(pathname: string): SidebarPanel {
    if (pathname === '/playground') return 'playground'
    if (pathname.startsWith('/project/') || pathname.startsWith('/scene/')) return 'prompt'
    return 'project'
}
