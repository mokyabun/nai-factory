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

import { promptEmphasisHighlight } from './prompt-emphasis-extension'
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

    // Refs keep the editor closure fresh without becoming effect dependencies.
    const onChangeRef = useRef(onChange)
    // eslint-disable-next-line react/refs -- The ref is used by event handlers and debounced callbacks, not to render UI.
    onChangeRef.current = onChange

    const completionSourceRef = useRef(completionSource)
    // eslint-disable-next-line react/refs -- The ref is used by event handlers and debounced callbacks, not to render UI.
    completionSourceRef.current = completionSource

    // Read once so typing never recreates the editor.
    const initialValueRef = useRef(value)

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
                override: [(ctx) => completionSourceRef.current?.(ctx) ?? null],
                activateOnTyping: true,
                activateOnTypingDelay: 35,
                interactionDelay: 35,
                maxRenderedOptions: 50,
            }),
            // Render tooltips in document.body to avoid overflow/z-index clipping.
            tooltips({ parent: document.body }),
            shadcnTheme,
            promptEmphasisHighlight,
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

    // Skipped while focused so typing is not overwritten and the cursor stays put.
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
