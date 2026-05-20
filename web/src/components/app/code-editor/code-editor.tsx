import { autocompletion, type CompletionSource } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { EditorState, type Extension } from '@codemirror/state'
import { placeholder as cmPlaceholder, EditorView, keymap } from '@codemirror/view'
import { useEffect, useRef } from 'react'
import { cn } from '#/lib/utils'
import { shadcnTheme } from './theme'

const LINE_HEIGHT = 19.5
const PADDING_V = 12

interface CodeEditorProps {
    value?: string
    placeholder?: string
    className?: string
    minLines?: number
    completionSource?: CompletionSource
    onChange?: (value: string) => void
}

export function CodeEditor({
    value = '',
    placeholder = '',
    className,
    minLines = 3,
    completionSource,
    onChange,
}: CodeEditorProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange

    // biome-ignore lint/correctness/useExhaustiveDependencies: intentional one-time editor initialization
    useEffect(() => {
        if (!containerRef.current) return

        const extensions: Extension[] = [
            history(),
            // @ts-ignore
            keymap.of([...defaultKeymap, ...historyKeymap]),
            EditorView.lineWrapping,
            cmPlaceholder(placeholder),
            autocompletion(completionSource ? { override: [completionSource] } : {}),
            shadcnTheme,
            EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    onChangeRef.current?.(update.state.doc.toString())
                }
            }),
        ]

        const view = new EditorView({
            state: EditorState.create({ doc: value, extensions }),
            parent: containerRef.current,
        })
        viewRef.current = view

        return () => {
            view.destroy()
            viewRef.current = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Sync external value changes without triggering infinite loops
    useEffect(() => {
        const view = viewRef.current
        if (view && view.state.doc.toString() !== value) {
            view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: value },
            })
        }
    }, [value])

    return (
        <div
            ref={containerRef}
            className={cn('overflow-hidden rounded-md bg-sidebar min-h-24', className)}
            style={{ minHeight: minLines * LINE_HEIGHT + PADDING_V }}
        />
    )
}
