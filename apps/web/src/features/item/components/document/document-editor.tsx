import './document-editor.css'
import { nodeColorAt } from '@docgraph/common/schemas'
import { useHocuspocusProvider } from '@hocuspocus/provider-react'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import DragHandle from '@tiptap/extension-drag-handle-react'
import { NodeRange } from '@tiptap/extension-node-range'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from '@tiptap/markdown'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { GripVertical } from 'lucide-react'
import { useEffect } from 'react'
import { PageSpinner } from '@/components/page-spinner'
import { useMe } from '@/lib/api'
import { useDocumentReadOnly } from '../../hooks/use-document-read-only'
import { nodeColorVar } from '../../lib/node-color.helpers'
import type { CrdtEditorProps } from '../../lib/types'
import { DocumentToolbar } from './document-toolbar'
import { SlashCommands } from './slash-commands'

/**
 * Collaborative rich-text document. The TipTap editor state lives in the
 * item's shared Yjs document (under the `content` fragment), so every edit is
 * synced through Hocuspocus and persisted by the server like diagram data.
 */
export const DocumentEditor = ({ connected, itemName }: CrdtEditorProps) => {
  const provider = useHocuspocusProvider()
  const readOnly = useDocumentReadOnly()
  const { name } = useMe()

  const editor = useEditor(
    {
      // The Collaboration extension provides undo/redo over the CRDT history.
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        Collaboration.configure({ document: provider.document, field: 'content' }),
        CollaborationCaret.configure({
          provider,
          // The extension replaces any `color` that is not `#rrggbb` with
          // `transparent`, so the theme color travels as a name in `colorName`.
          user: {
            name: name || 'Anonymous',
            colorName: nodeColorAt(provider.awareness?.clientID ?? 0),
          },
          render: (caretUser) => {
            const color = nodeColorVar(caretUser.colorName)

            const caret = document.createElement('span')
            caret.classList.add('collaboration-carets__caret')
            caret.style.borderColor = color

            const label = document.createElement('div')
            label.classList.add('collaboration-carets__label')
            label.style.backgroundColor = color
            label.textContent = String(caretUser.name ?? '')

            caret.append(label)
            return caret
          },
          // The default selection builder appends a hex alpha suffix to the
          // color, which is invalid for the CSS variable colors used here.
          selectionRender: (selectionUser) => ({
            nodeName: 'span',
            class: 'collaboration-carets__selection',
            style: `background-color: color-mix(in srgb, ${nodeColorVar(selectionUser.colorName)} 30%, transparent)`,
          }),
        }),
        Placeholder.configure({ placeholder: 'Start writing…' }),
        SlashCommands,
        Markdown,
        NodeRange,
      ],
      editable: false,
    },
    [provider, name],
  )

  // The read-only scope is re-evaluated on every (re)connect; follow it.
  useEffect(() => {
    editor?.setEditable(!readOnly)
  }, [editor, readOnly])

  if (!connected) return <PageSpinner fullScreen />

  return (
    <div className='flex h-screen flex-col bg-background'>
      <DocumentToolbar editor={editor} itemName={itemName} />
      <div className='min-h-0 flex-1 overflow-y-auto px-3 pt-18 pb-16 sm:px-6'>
        <EditorContent
          editor={editor}
          className='mx-auto w-full max-w-208 rounded-xl border bg-card px-6 py-10 shadow-card sm:px-16 sm:py-16'
        />
      </div>
      {editor && !readOnly && (
        <DragHandle editor={editor} className='document-drag-handle' nested>
          <GripVertical aria-hidden='true' />
        </DragHandle>
      )}
    </div>
  )
}
