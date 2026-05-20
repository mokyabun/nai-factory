import { useCallback, useRef, useState } from 'react'

interface UseJsonDropResult {
    isDragOver: boolean
    pendingFile: File | null
    dragHandlers: {
        onDragEnter: (e: React.DragEvent) => void
        onDragOver: (e: React.DragEvent) => void
        onDragLeave: () => void
        onDrop: (e: React.DragEvent) => void
    }
    clearPendingFile: () => void
}

export function useJsonDrop(): UseJsonDropResult {
    const dragCounter = useRef(0)
    const [isDragOver, setIsDragOver] = useState(false)
    const [pendingFile, setPendingFile] = useState<File | null>(null)

    const clearPendingFile = useCallback(() => setPendingFile(null), [])

    function onDragEnter(e: React.DragEvent) {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        dragCounter.current++
        setIsDragOver(true)
    }

    function onDragOver(e: React.DragEvent) {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
    }

    function onDragLeave() {
        dragCounter.current--
        if (dragCounter.current === 0) setIsDragOver(false)
    }

    function onDrop(e: React.DragEvent) {
        e.preventDefault()
        dragCounter.current = 0
        setIsDragOver(false)
        const file = Array.from(e.dataTransfer.files).find((f) => f.name.endsWith('.json'))
        if (file) setPendingFile(file)
    }

    return {
        isDragOver,
        pendingFile,
        dragHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop },
        clearPendingFile,
    }
}
