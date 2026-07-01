import { atom } from 'jotai'

export type SidebarPanel = 'project' | 'playground' | 'prompt' | 'queue'

export const activeSidebarPanelAtom = atom<SidebarPanel>('project')
