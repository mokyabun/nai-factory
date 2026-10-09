import { type PointerEvent, useEffect, useRef, useState } from 'react'

interface Identified {
    id: number
}

export interface DragRange {
    startIndex: number
    action: 'select' | 'deselect'
    baseSelectedIds: ReadonlySet<number>
}

interface DragState extends Omit<DragRange, 'startIndex'> {
    startIndex: number | null
}

export function applyDragRange(
    items: readonly Identified[],
    { startIndex, action, baseSelectedIds }: DragRange,
    targetIndex: number,
) {
    const clamped = Math.min(Math.max(targetIndex, 0), items.length - 1)
    const from = Math.min(startIndex, clamped)
    const to = Math.max(startIndex, clamped)

    const next = new Set(baseSelectedIds)
    for (const { id } of items.slice(from, to + 1)) {
        if (action === 'select') next.add(id)
        else next.delete(id)
    }
    return next
}

function isEditableTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false
    return (
        target.isContentEditable ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
    )
}

export function useDragSelection(items: readonly Identified[]) {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set())
    const dragRef = useRef<DragState | null>(null)
    // Ids of items that are gone stay in the set but never count as selected.
    const orderedSelectedIds = items
        .filter((item) => selectedIds.has(item.id))
        .map((item) => item.id)

    function dragTo(state: DragState, targetIndex: number) {
        if (items.length === 0) return
        const startIndex = (state.startIndex ??= targetIndex)
        setSelectedIds(applyDragRange(items, { ...state, startIndex }, targetIndex))
    }

    useEffect(() => {
        function handlePointerEnd() {
            dragRef.current = null
        }

        window.addEventListener('pointerup', handlePointerEnd)
        window.addEventListener('pointercancel', handlePointerEnd)
        return () => {
            window.removeEventListener('pointerup', handlePointerEnd)
            window.removeEventListener('pointercancel', handlePointerEnd)
        }
    }, [])

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (isEditableTarget(event.target)) return

            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
                if (items.length === 0) return
                event.preventDefault()
                setSelectedIds(new Set(items.map((item) => item.id)))
                return
            }

            if (event.key === 'Escape') setSelectedIds(new Set<number>())
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [items])

    return {
        selectedIds,
        orderedSelectedIds,
        selectDragStart: (index: number, selected: boolean) => {
            const state: DragState = {
                startIndex: index,
                action: selected ? 'deselect' : 'select',
                baseSelectedIds: new Set(selectedIds),
            }
            dragRef.current = state
            dragTo(state, index)
        },
        selectDragEnter: (index: number) => {
            if (dragRef.current) dragTo(dragRef.current, index)
        },
        gridPointerDown: (event: PointerEvent<HTMLDivElement>) => {
            if (event.button !== 0 || event.target !== event.currentTarget) return
            event.preventDefault()
            dragRef.current = {
                startIndex: null,
                action: 'select',
                baseSelectedIds: new Set(selectedIds),
            }
        },
        toggle: (id: number) => {
            setSelectedIds((prev) => {
                const next = new Set(prev)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
            })
        },
        selectAll: () => {
            setSelectedIds(new Set(items.map((item) => item.id)))
        },
        clear: () => {
            setSelectedIds(new Set<number>())
        },
        /** Deselects `ids` (all when omitted) and returns how to restore the previous selection. */
        take: (ids?: readonly number[]) => {
            const previous = selectedIds
            setSelectedIds((current) => {
                if (!ids) return new Set<number>()
                const next = new Set(current)
                for (const id of ids) next.delete(id)
                return next
            })
            return () => setSelectedIds(previous)
        },
    }
}
