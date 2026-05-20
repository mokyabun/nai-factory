import { EditorView } from '@codemirror/view'

export const shadcnTheme = EditorView.theme({
    '&': {
        height: '100%',
        color: 'var(--foreground)',
        backgroundColor: 'transparent',
        fontSize: '0.8125rem',
        lineHeight: '1.5',
    },
    '&.cm-focused': {
        outline: 'none',
    },
    '.cm-scroller': {
        fontFamily: 'inherit',
        overflow: 'auto',
    },
    '.cm-content': {
        padding: '6px 10px',
        caretColor: 'var(--foreground)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
    },
    '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: 'var(--foreground)',
    },
    '&.cm-focused .cm-selectionBackground': {
        backgroundColor: 'color-mix(in oklch, var(--primary) 25%, transparent)',
    },
    '.cm-selectionBackground': {
        backgroundColor: 'color-mix(in oklch, var(--primary) 15%, transparent)',
    },
    '.cm-activeLine': {
        backgroundColor: 'transparent',
    },
    '.cm-placeholder': {
        color: 'var(--muted-foreground)',
        fontStyle: 'normal',
    },
    '.cm-tooltip': {
        backgroundColor: 'var(--popover)',
        color: 'var(--popover-foreground)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        padding: '2px',
    },
    '.cm-tooltip-autocomplete ul': {
        fontFamily: 'inherit',
        maxHeight: '200px',
    },
    '.cm-tooltip-autocomplete ul li': {
        padding: '4px 8px',
        borderRadius: '4px',
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
        backgroundColor: 'var(--accent)',
        color: 'var(--accent-foreground)',
    },
    '.cm-completionLabel': {
        fontSize: '0.8125rem',
    },
    '.cm-completionDetail': {
        fontSize: '0.75rem',
        color: 'var(--muted-foreground)',
        fontStyle: 'italic',
        marginLeft: '4px',
    },
})
