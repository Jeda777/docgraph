import type { Editor } from '@tiptap/react'
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  type LucideIcon,
  Minus,
  Pilcrow,
  SquareCode,
  TextQuote,
} from 'lucide-react'

/** Minimal selection range shape handed to item commands by the suggestion plugin. */
export type SlashCommandRange = { from: number; to: number }

export type SlashCommandItem = {
  title: string
  description: string
  keywords: string[]
  Icon: LucideIcon
  command: (props: { editor: Editor; range: SlashCommandRange }) => void
}

/**
 * Blocks insertable from the "/" menu. Every command removes the typed
 * "/query" text first — the suggestion plugin does not delete it by itself.
 */
const items: SlashCommandItem[] = [
  {
    title: 'Text',
    description: 'Plain paragraph text',
    keywords: ['p', 'paragraph', 'plain', 'text', 'body'],
    Icon: Pilcrow,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).clearNodes().setParagraph().run()
    },
  },
  {
    title: 'Heading 1',
    description: 'Large section heading',
    keywords: ['h1', 'heading', 'title', 'large'],
    Icon: Heading1,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).clearNodes().setHeading({ level: 1 }).run()
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    keywords: ['h2', 'heading', 'subtitle', 'medium'],
    Icon: Heading2,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).clearNodes().setHeading({ level: 2 }).run()
    },
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    keywords: ['h3', 'heading', 'small'],
    Icon: Heading3,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).clearNodes().setHeading({ level: 3 }).run()
    },
  },
  {
    title: 'Bullet list',
    description: 'Simple bulleted list',
    keywords: ['ul', 'unordered', 'bullet', 'list'],
    Icon: List,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).clearNodes().toggleBulletList().run()
    },
  },
  {
    title: 'Numbered list',
    description: 'List with numbered items',
    keywords: ['ol', 'ordered', 'number', 'list'],
    Icon: ListOrdered,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).clearNodes().toggleOrderedList().run()
    },
  },
  {
    title: 'Quote',
    description: 'Capture a quotation',
    keywords: ['blockquote', 'quote', 'citation'],
    Icon: TextQuote,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).clearNodes().toggleBlockquote().run()
    },
  },
  {
    title: 'Code block',
    description: 'Standalone code snippet',
    keywords: ['code', 'pre', 'snippet', 'fence'],
    Icon: SquareCode,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).clearNodes().toggleCodeBlock().run()
    },
  },
  {
    title: 'Divider',
    description: 'Visually divide blocks',
    keywords: ['hr', 'horizontal', 'rule', 'line', 'separator'],
    Icon: Minus,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run()
    },
  },
]

/** Items matching the typed query by title or keyword (empty query = all). */
export const filterSlashCommandItems = (query: string): SlashCommandItem[] => {
  const needle = query.toLowerCase().trim()
  if (!needle) {
    return items
  }

  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(needle) ||
      item.keywords.some((keyword) => keyword.includes(needle)),
  )
}

export const slashCommandItems = items
