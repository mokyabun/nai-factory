<script lang="ts">
import { acceptCompletion, autocompletion, type CompletionSource } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap, placeholder as cmPlaceholder, tooltips } from '@codemirror/view'
import { onDestroy, onMount } from 'svelte'
import { cn } from '$lib/utils'
import { shadcnTheme } from '../../theme'

const lineHeight = 19.5
const paddingY = 12

let {
    value = $bindable(''),
    placeholder = '',
    class: className,
    minLines = 3,
    completionSource,
    onChange,
}: {
    value?: string
    placeholder?: string
    class?: string
    minLines?: number
    completionSource?: CompletionSource
    onChange?: (value: string) => void
} = $props()

let container: HTMLDivElement
let view: EditorView | null = null
let focused = $state(false)
let externalValue = $derived(value)

onMount(() => {
    const extensions: Extension[] = [
        history(),
        keymap.of([
            { key: 'Tab', run: acceptCompletion },
            ...defaultKeymap,
            ...historyKeymap,
        ] as any),
        EditorView.lineWrapping,
        cmPlaceholder(placeholder),
        autocompletion({
            override: [(ctx) => completionSource?.(ctx) ?? null],
            activateOnTyping: true,
        }),
        tooltips({ parent: document.body }),
        shadcnTheme,
        EditorView.focusChangeEffect.of((_, isFocused) => {
            focused = isFocused
            return null
        }),
        EditorView.updateListener.of((update) => {
            if (!update.docChanged) return
            value = update.state.doc.toString()
            onChange?.(value)
        }),
    ]

    view = new EditorView({
        state: EditorState.create({ doc: value, extensions }),
        parent: container,
    })
})

$effect(() => {
    if (!view || focused) return
    const current = view.state.doc.toString()
    if (current !== externalValue) {
        view.dispatch({ changes: { from: 0, to: current.length, insert: externalValue } })
    }
})

onDestroy(() => {
    view?.destroy()
    view = null
})
</script>

<div
	bind:this={container}
	class={cn('min-h-24 overflow-hidden rounded-md bg-sidebar', className)}
	style:min-height={`${minLines * lineHeight + paddingY}px`}
></div>
