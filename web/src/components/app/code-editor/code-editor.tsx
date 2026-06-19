import { acceptCompletion, autocompletion, type CompletionSource } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { EditorState, type Extension } from '@codemirror/state'
import {
    placeholder as cmPlaceholder,
    EditorView,
    type KeyBinding,
    keymap,
    tooltips,
} from '@codemirror/view'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
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

    // Keep mutable callbacks/sources in refs so the editor closure never goes stale,
    // and the React Compiler cannot add them as effect dependencies.
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange

    const completionSourceRef = useRef(completionSource)
    completionSourceRef.current = completionSource

    // Capture the initial value so the React Compiler does not track the `value`
    // prop as a dependency of the setup effect (which would recreate the editor
    // on every keystroke and prevent autocompletion from ever triggering).
    const initialValueRef = useRef(value)

    // biome-ignore lint/correctness/useExhaustiveDependencies: one-time editor initialization
    useEffect(() => {
        if (!containerRef.current) return

        const extensions: Extension[] = [
            history(),
            keymap.of([
                { key: 'Tab', run: acceptCompletion },
                ...(defaultKeymap as unknown as KeyBinding[]),
                ...(historyKeymap as unknown as KeyBinding[]),
            ]),
            EditorView.lineWrapping,
            cmPlaceholder(placeholder),
            autocompletion({
                // Wrap in a stable closure so the React Compiler never sees
                // `completionSource` as a captured reactive value in this effect.
                override: [(ctx) => completionSourceRef.current?.(ctx) ?? null],
                activateOnTyping: true,
                activateOnTypingDelay: 35,
                interactionDelay: 35,
                maxRenderedOptions: 50,
            }),
            // Render tooltips in document.body to avoid overflow/z-index clipping.
            tooltips({ parent: document.body }),
            shadcnTheme,
            EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    onChangeRef.current?.(update.state.doc.toString())
                }
            }),
        ]

        const view = new EditorView({
            state: EditorState.create({ doc: initialValueRef.current, extensions }),
            parent: containerRef.current,
        })
        viewRef.current = view

        return () => {
            view.destroy()
            viewRef.current = null
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Sync external value changes (skip when the editor has focus to avoid
    // overwriting content mid-edit and resetting the cursor position).
    useEffect(() => {
        const view = viewRef.current
        if (!view || view.hasFocus) return
        const current = view.state.doc.toString()
        if (current !== value) {
            view.dispatch({
                changes: { from: 0, to: current.length, insert: value },
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
