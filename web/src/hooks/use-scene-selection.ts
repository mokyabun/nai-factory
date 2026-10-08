import type { SceneSummary } from '@nai-factory/shared'
import { useSetAtom } from 'jotai'
import { type PointerEvent, useEffect, useRef } from 'react'

import { selectedSceneIdsSetAtom } from '@/routes/project/$projectId/atom'

interface SelectionDragState {
    startIndex: number | null
    action: 'select' | 'deselect'
    baseSelectedIds: Set<number>
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

/**
 * Scene selection for the project grid: click to toggle, drag across cards to select a range,
 * Ctrl/⌘+A to select all and Escape to clear.
 */
export function useSceneSelection(items: SceneSummary[], selectedIds: Set<number>) {
    const setSelectedIds = useSetAtom(selectedSceneIdsSetAtom)
    const dragRef = useRef<SelectionDragState | null>(null)

    function applyRange(state: SelectionDragState, targetIndex: number) {
        if (items.length === 0) return
        if (state.startIndex === null) state.startIndex = targetIndex

        const clamped = Math.min(Math.max(targetIndex, 0), items.length - 1)
        const from = Math.min(state.startIndex, clamped)
        const to = Math.max(state.startIndex, clamped)
        const rangeIds = items.slice(from, to + 1).map((scene) => scene.id)

        setSelectedIds(() => {
            const next = new Set(state.baseSelectedIds)
            for (const id of rangeIds) {
                if (state.action === 'select') next.add(id)
                else next.delete(id)
            }
            return next
        })
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
                setSelectedIds(new Set(items.map((scene) => scene.id)))
                return
            }

            if (event.key === 'Escape') setSelectedIds(new Set<number>())
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [items, setSelectedIds])

    return {
        selectDragStart: (index: number, selected: boolean) => {
            const state: SelectionDragState = {
                startIndex: index,
                action: selected ? 'deselect' : 'select',
                baseSelectedIds: new Set(selectedIds),
            }
            dragRef.current = state
            applyRange(state, index)
        },
        selectDragEnter: (index: number) => {
            if (dragRef.current) applyRange(dragRef.current, index)
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
            setSelectedIds(new Set(items.map((scene) => scene.id)))
        },
        clear: () => {
            setSelectedIds(new Set<number>())
        },
    }
}
