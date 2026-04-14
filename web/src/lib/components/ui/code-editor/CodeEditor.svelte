<script lang="ts">
    import { onMount, onDestroy } from 'svelte'
    import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
    import { EditorState, type Extension } from '@codemirror/state'
    import { defaultKeymap, historyKeymap, history } from '@codemirror/commands'
    import { autocompletion, type CompletionSource } from '@codemirror/autocomplete'
    import { shadcnTheme } from './theme'
    import { cn } from '$lib/utils'

    let {
        value = $bindable(''),
        placeholder = '',
        class: className = '',
        minLines = 3,
        completionSource,
        onchange,
    }: {
        value?: string
        placeholder?: string
        class?: string
        /** Minimum visible line count (drives min-height). Default: 3 */
        minLines?: number
        /** Optional CodeMirror completion source for autocomplete */
        completionSource?: CompletionSource
        onchange?: (value: string) => void
    } = $props()

    let container: HTMLDivElement
    let view: EditorView | null = null

    function buildExtensions(): Extension[] {
        return [
            history(),
            keymap.of([...defaultKeymap, ...historyKeymap]),
            EditorView.lineWrapping,
            cmPlaceholder(placeholder),
            autocompletion(completionSource ? { override: [completionSource] } : {}),
            shadcnTheme,
            EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    const v = update.state.doc.toString()
                    value = v
                    onchange?.(v)
                }
            }),
        ]
    }

    onMount(() => {
        view = new EditorView({
            state: EditorState.create({ doc: value, extensions: buildExtensions() }),
            parent: container,
        })
    })

    onDestroy(() => view?.destroy())

    // Sync external value changes into the editor without triggering a loop
    $effect(() => {
        const v = value
        if (view && view.state.doc.toString() !== v) {
            view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } })
        }
    })

    // Approximate line-height in px for min-height calculation (matches lineHeight: 1.5 * 13px)
    const LINE_HEIGHT = 19.5
    const PADDING_V = 12 // top + bottom padding
</script>

<div
    bind:this={container}
    class={cn(
        'overflow-hidden rounded-md border border-input bg-background',
        className,
    )}
    style="min-height: {minLines * LINE_HEIGHT + PADDING_V}px"
></div>
