import { useCallback, useRef, useState } from 'react'

const IMAGE_EXTENSIONS = ['.png', '.webp', '.avif', '.jpg', '.jpeg']
const IMPORTABLE_EXTENSIONS = ['.json', '.naif', ...IMAGE_EXTENSIONS]

export function isImageFile(file: File) {
    const name = file.name.toLowerCase()
    return IMAGE_EXTENSIONS.some((extension) => name.endsWith(extension))
}

interface UseFileDropResult {
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

export function useFileDrop(): UseFileDropResult {
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
        const file = Array.from(e.dataTransfer.files).find((f) => {
            const name = f.name.toLowerCase()
            return IMPORTABLE_EXTENSIONS.some((extension) => name.endsWith(extension))
        })
        if (file) setPendingFile(file)
    }

    return {
        isDragOver,
        pendingFile,
        dragHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop },
        clearPendingFile,
    }
}
