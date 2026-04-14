import { EditorView } from '@codemirror/view'

export const shadcnTheme = EditorView.theme({
    '&': {
        height: '100%',
        color: 'hsl(var(--foreground))',
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
        caretColor: 'hsl(var(--foreground))',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
    },
    '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: 'hsl(var(--foreground))',
    },
    '&.cm-focused .cm-selectionBackground': {
        backgroundColor: 'hsl(var(--primary) / 0.25)',
    },
    '.cm-selectionBackground': {
        backgroundColor: 'hsl(var(--primary) / 0.15)',
    },
    '.cm-activeLine': {
        backgroundColor: 'transparent',
    },
    '.cm-placeholder': {
        color: 'hsl(var(--muted-foreground))',
        fontStyle: 'normal',
    },
    // Autocomplete tooltip
    '.cm-tooltip': {
        backgroundColor: 'hsl(var(--popover))',
        color: 'hsl(var(--popover-foreground))',
        border: '1px solid hsl(var(--border))',
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
        backgroundColor: 'hsl(var(--accent))',
        color: 'hsl(var(--accent-foreground))',
    },
    '.cm-completionLabel': {
        fontSize: '0.8125rem',
    },
    '.cm-completionDetail': {
        fontSize: '0.75rem',
        color: 'hsl(var(--muted-foreground))',
        fontStyle: 'italic',
        marginLeft: '4px',
    },
})
