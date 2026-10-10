import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual'
import {
    type PointerEvent,
    type ReactNode,
    type RefObject,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react'

const MIN_COLUMN_WIDTH = 160
const GAP = 12
const OVERSCAN_ROWS = 3

export function gridLayout(width: number) {
    const columns = Math.max(1, Math.floor((width + GAP) / (MIN_COLUMN_WIDTH + GAP)))
    const columnWidth = (width - GAP * (columns - 1)) / columns
    return { columns, columnWidth }
}

/** Each row is as tall as its narrowest item at the column width. */
export function rowHeights(aspectRatios: readonly number[], columns: number, columnWidth: number) {
    const heights: number[] = []
    for (let start = 0; start < aspectRatios.length; start += columns) {
        heights.push(columnWidth / Math.min(...aspectRatios.slice(start, start + columns)))
    }
    return heights
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
    /** Width over height; keep the function stable, the row heights are memoized on it. */
    getAspectRatio: (item: T) => number
    renderItem: (item: T, index: number) => ReactNode
}

export function VirtualImageGrid<T extends { id: number }>({
    items,
    pinnedIndex,
    onEmptyPointerDown,
    getAspectRatio,
    renderItem,
}: VirtualImageGridProps<T>) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const width = useContentWidth(scrollRef)
    const { columns, columnWidth } = gridLayout(width)
    const heights = useMemo(
        () => (width > 0 ? rowHeights(items.map(getAspectRatio), columns, columnWidth) : []),
        [items, getAspectRatio, width, columns, columnWidth],
    )
    const pinnedRow = pinnedIndex === null ? null : Math.floor(pinnedIndex / columns)

    // eslint-disable-next-line react/incompatible-library -- the virtualizer is mutable by design; this component is not memoized.
    const virtualizer = useVirtualizer({
        count: heights.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: (row) => heights[row] + GAP,
        overscan: OVERSCAN_ROWS,
        rangeExtractor: (range) => {
            const rows = defaultRangeExtractor(range)
            if (pinnedRow === null || rows.includes(pinnedRow)) return rows
            return [...rows, pinnedRow].sort((a, b) => a - b)
        },
    })

    useEffect(() => {
        virtualizer.measure()
    }, [virtualizer, heights])

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
                            className="absolute inset-x-0 top-0 grid items-start gap-3"
                            style={{
                                height: heights[row.index],
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
