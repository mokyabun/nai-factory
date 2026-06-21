import { type Extension, RangeSetBuilder } from '@codemirror/state'
import {
    Decoration,
    type DecorationSet,
    EditorView,
    ViewPlugin,
    type ViewUpdate,
} from '@codemirror/view'
import { parsePromptEmphasisRanges } from '@/lib/prompt-emphasis'

const highEmphasisMark = Decoration.mark({ class: 'cm-prompt-emphasis-high' })
const lowEmphasisMark = Decoration.mark({ class: 'cm-prompt-emphasis-low' })

function buildEmphasisDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>()
    const prompt = view.state.doc.toString()

    for (const range of parsePromptEmphasisRanges(prompt)) {
        builder.add(
            range.from,
            range.to,
            range.kind === 'high' ? highEmphasisMark : lowEmphasisMark,
        )
    }

    return builder.finish()
}

const emphasisPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet

        constructor(view: EditorView) {
            this.decorations = buildEmphasisDecorations(view)
        }

        update(update: ViewUpdate) {
            if (update.docChanged) {
                this.decorations = buildEmphasisDecorations(update.view)
            }
        }
    },
    {
        decorations: (plugin) => plugin.decorations,
    },
)

const emphasisTheme = EditorView.theme({
    '.cm-prompt-emphasis-high': {
        backgroundColor: 'oklch(0.62 0.22 25 / 0.24)',
        borderRadius: '2px',
    },
    '.cm-prompt-emphasis-low': {
        backgroundColor: 'oklch(0.62 0.18 250 / 0.24)',
        borderRadius: '2px',
    },
})

export const promptEmphasisHighlight: Extension = [emphasisPlugin, emphasisTheme]
