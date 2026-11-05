import { type Editor, useEditorState } from '@tiptap/react'
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  type LucideIcon,
  Minus,
  Pilcrow,
  Redo2,
  SquareCode,
  Strikethrough,
  TextQuote,
  Underline,
  Undo2,
} from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDocumentIo } from '../../hooks/use-document-io'
import { useDocumentReadOnly } from '../../hooks/use-document-read-only'
import { EditorHeader } from '../base/editor-header'

export type DocumentToolbarProps = {
  editor: Editor
  itemName: string
}

/** The chain builder returned by `editor.chain()`, used to run editor commands. */
type EditorChain = ReturnType<Editor['chain']>

type ToolbarAction = {
  label: string
  Icon: LucideIcon
  isActive: boolean
  isDisabled?: boolean
  /** Runs the chain command for this action, e.g. `(chain) => chain.toggleBold().run()`. */
  run: (chain: EditorChain) => void
}

const ToolbarButton = ({
  label,
  Icon,
  isActive,
  isDisabled,
  run,
  editor,
}: {
  label: string
  Icon: LucideIcon
  isActive: boolean
  isDisabled: boolean
  run: ToolbarAction['run']
  editor: Editor
}) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label={label}
          aria-pressed={isActive}
          disabled={isDisabled}
          onClick={() => run(editor.chain().focus())}
          className={
            isActive
              ? 'bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground'
              : 'text-muted-foreground'
          }
        />
      }
    >
      <Icon />
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
)

const ToolbarGroup = ({
  actions,
  editor,
  isDisabled,
}: {
  actions: ToolbarAction[]
  editor: Editor
  isDisabled: boolean
}) => (
  <div className='flex shrink-0 items-center gap-0.5'>
    {actions.map(({ isDisabled: actionDisabled, ...action }) => (
      <ToolbarButton
        key={action.label}
        {...action}
        isDisabled={isDisabled || (actionDisabled ?? false)}
        editor={editor}
      />
    ))}
  </div>
)

export const DocumentToolbar = ({ editor, itemName }: DocumentToolbarProps) => {
  const fileRef = useRef<HTMLInputElement>(null)
  const readOnly = useDocumentReadOnly()
  const { handleImport, handleDownloadJson, handleDownloadMarkdown, handleDownloadBinary } =
    useDocumentIo({ editor, itemName })

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
      isParagraph: current.isActive('paragraph'),
      isHeading1: current.isActive('heading', { level: 1 }),
      isHeading2: current.isActive('heading', { level: 2 }),
      isHeading3: current.isActive('heading', { level: 3 }),
      isBold: current.isActive('bold'),
      isItalic: current.isActive('italic'),
      isUnderline: current.isActive('underline'),
      isStrike: current.isActive('strike'),
      isCode: current.isActive('code'),
      isBulletList: current.isActive('bulletList'),
      isOrderedList: current.isActive('orderedList'),
      isBlockquote: current.isActive('blockquote'),
      isCodeBlock: current.isActive('codeBlock'),
    }),
  })

  return (
    <>
      {/* The header spans the page's width, so its controls stay within reach on wide screens. */}
      <div className='shrink-0 border-b bg-background px-3 sm:px-6'>
        <EditorHeader
          itemName={itemName}
          itemType='DOCUMENT'
          readOnly={readOnly}
          className='mx-auto w-full max-w-208 px-0'
          onImportClick={() => fileRef.current?.click()}
          exportFormats={[
            { label: 'DocGraph', onSelect: handleDownloadBinary },
            { label: 'Markdown', onSelect: handleDownloadMarkdown },
            { label: 'JSON', onSelect: handleDownloadJson },
          ]}
        />
      </div>

      {/* Zero-height row: the toolbar floats over the top of the scrolling page below. */}
      <div className='relative z-10 flex justify-center px-3'>
        <div
          role='toolbar'
          aria-label='Formatting'
          className='absolute top-3 flex max-w-[calc(100%-1.5rem)] items-center gap-0.5 overflow-x-auto rounded-xl border bg-card/90 p-1 shadow-card backdrop-blur-md scrollbar-none'
        >
          <ToolbarGroup
            editor={editor}
            isDisabled={readOnly}
            actions={[
              {
                label: 'Undo',
                Icon: Undo2,
                isActive: false,
                isDisabled: !state.canUndo,
                run: (chain) => chain.undo().run(),
              },
              {
                label: 'Redo',
                Icon: Redo2,
                isActive: false,
                isDisabled: !state.canRedo,
                run: (chain) => chain.redo().run(),
              },
            ]}
          />
          <Separator orientation='vertical' className='mx-1 my-1.5 shrink-0' />

          <ToolbarGroup
            editor={editor}
            isDisabled={readOnly}
            actions={[
              {
                label: 'Paragraph',
                Icon: Pilcrow,
                isActive: state.isParagraph,
                run: (chain) => chain.setParagraph().run(),
              },
              {
                label: 'Heading 1',
                Icon: Heading1,
                isActive: state.isHeading1,
                run: (chain) => chain.toggleHeading({ level: 1 }).run(),
              },
              {
                label: 'Heading 2',
                Icon: Heading2,
                isActive: state.isHeading2,
                run: (chain) => chain.toggleHeading({ level: 2 }).run(),
              },
              {
                label: 'Heading 3',
                Icon: Heading3,
                isActive: state.isHeading3,
                run: (chain) => chain.toggleHeading({ level: 3 }).run(),
              },
            ]}
          />
          <Separator orientation='vertical' className='mx-1 my-1.5 shrink-0' />

          <ToolbarGroup
            editor={editor}
            isDisabled={readOnly}
            actions={[
              {
                label: 'Bold',
                Icon: Bold,
                isActive: state.isBold,
                run: (chain) => chain.toggleBold().run(),
              },
              {
                label: 'Italic',
                Icon: Italic,
                isActive: state.isItalic,
                run: (chain) => chain.toggleItalic().run(),
              },
              {
                label: 'Underline',
                Icon: Underline,
                isActive: state.isUnderline,
                run: (chain) => chain.toggleUnderline().run(),
              },
              {
                label: 'Strikethrough',
                Icon: Strikethrough,
                isActive: state.isStrike,
                run: (chain) => chain.toggleStrike().run(),
              },
              {
                label: 'Inline code',
                Icon: Code,
                isActive: state.isCode,
                run: (chain) => chain.toggleCode().run(),
              },
            ]}
          />
          <Separator orientation='vertical' className='mx-1 my-1.5 shrink-0' />

          <ToolbarGroup
            editor={editor}
            isDisabled={readOnly}
            actions={[
              {
                label: 'Bullet list',
                Icon: List,
                isActive: state.isBulletList,
                run: (chain) => chain.toggleBulletList().run(),
              },
              {
                label: 'Ordered list',
                Icon: ListOrdered,
                isActive: state.isOrderedList,
                run: (chain) => chain.toggleOrderedList().run(),
              },
            ]}
          />
          <Separator orientation='vertical' className='mx-1 my-1.5 shrink-0' />

          <ToolbarGroup
            editor={editor}
            isDisabled={readOnly}
            actions={[
              {
                label: 'Blockquote',
                Icon: TextQuote,
                isActive: state.isBlockquote,
                run: (chain) => chain.toggleBlockquote().run(),
              },
              {
                label: 'Code block',
                Icon: SquareCode,
                isActive: state.isCodeBlock,
                run: (chain) => chain.toggleCodeBlock().run(),
              },
              {
                label: 'Horizontal rule',
                Icon: Minus,
                isActive: false,
                run: (chain) => chain.setHorizontalRule().run(),
              },
            ]}
          />
        </div>
      </div>

      <input
        ref={fileRef}
        type='file'
        accept='.json,.docgraph,.md'
        className='hidden'
        onChange={handleImport}
      />
    </>
  )
}
