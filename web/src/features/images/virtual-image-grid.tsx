import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual'
import {
    type PointerEvent,
    type ReactNode,
    type RefObject,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react'

const MIN_COLUMN_WIDTH = 160
const GAP = 12
const ITEM_ASPECT_RATIO = 4 / 3
const OVERSCAN_ROWS = 3

export function gridLayout(width: number) {
    const columns = Math.max(1, Math.floor((width + GAP) / (MIN_COLUMN_WIDTH + GAP)))
    const columnWidth = (width - GAP * (columns - 1)) / columns
    return { columns, itemHeight: columnWidth * ITEM_ASPECT_RATIO }
}

function useContentWidth(ref: RefObject<HTMLElement | null>) {
    const [width, setWidth] = useState(0)

    useLayoutEffect(() => {
        const element = ref.current
        if (!element) return
        const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
        observer.observe(element)
        return () => observer.disconnect()
    }, [ref])

    return width
}

interface VirtualImageGridProps<T> {
    items: readonly T[]
    /** Index of an item whose row stays mounted while off screen (the item being dragged). */
    pinnedIndex: number | null
    onEmptyPointerDown: (event: PointerEvent<HTMLDivElement>) => void
    renderItem: (item: T, index: number) => ReactNode
}

export function VirtualImageGrid<T extends { id: number }>({
    items,
    pinnedIndex,
    onEmptyPointerDown,
    renderItem,
}: VirtualImageGridProps<T>) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const width = useContentWidth(scrollRef)
    const { columns, itemHeight } = gridLayout(width)
    const rowHeight = itemHeight + GAP
    const pinnedRow = pinnedIndex === null ? null : Math.floor(pinnedIndex / columns)

    // eslint-disable-next-line react/incompatible-library -- the virtualizer is mutable by design; this component is not memoized.
    const virtualizer = useVirtualizer({
        count: width > 0 ? Math.ceil(items.length / columns) : 0,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => rowHeight,
        overscan: OVERSCAN_ROWS,
        rangeExtractor: (range) => {
            const rows = defaultRangeExtractor(range)
            if (pinnedRow === null || rows.includes(pinnedRow)) return rows
            return [...rows, pinnedRow].sort((a, b) => a - b)
        },
    })

    useEffect(() => {
        virtualizer.measure()
    }, [virtualizer, rowHeight])

    return (
        <div ref={scrollRef} className="-m-1 min-h-0 flex-1 overflow-y-auto p-1">
            <div
                className="relative w-full"
                style={{ height: virtualizer.getTotalSize() }}
                onPointerDown={onEmptyPointerDown}
            >
                {virtualizer.getVirtualItems().map((row) => {
                    const start = row.index * columns
                    return (
                        <div
                            key={row.key}
                            className="absolute inset-x-0 top-0 grid gap-3"
                            style={{
                                height: itemHeight,
                                transform: `translateY(${row.start}px)`,
                                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                            }}
                            onPointerDown={onEmptyPointerDown}
                        >
                            {items
                                .slice(start, start + columns)
                                .map((item, offset) => renderItem(item, start + offset))}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
