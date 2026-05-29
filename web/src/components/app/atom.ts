import { atom } from 'jotai'

export const activeProjectIdAtom = atom<number | null>(null)
export const importDialogOpenAtom = atom(false)
