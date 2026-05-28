import type { ActiveRenameTarget } from './atom'

export function isSameRenameTarget(current: ActiveRenameTarget | null, target: ActiveRenameTarget) {
    return current?.type === target.type && current.id === target.id
}
