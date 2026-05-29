import { atom } from 'jotai'

export type SidebarPanel = 'project' | 'playground' | 'prompt' | 'queue' | 'settings'

export const activeSidebarPanelAtom = atom<SidebarPanel>('project')
