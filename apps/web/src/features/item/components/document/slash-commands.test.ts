import { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'
import { filterSlashCommandItems, slashCommandItems } from './slash-command-items'
import { SlashCommands } from './slash-commands'

const createEditor = () =>
  new Editor({ extensions: [StarterKit.configure({ undoRedo: false }), SlashCommands] })

const findItem = (title: string) => {
  const item = slashCommandItems.find((entry) => entry.title === title)
  if (!item) {
    throw new Error(`Missing slash command item: ${title}`)
  }
  return item
}

describe('slash command items', () => {
  it('returns every item for an empty query', () => {
    expect(filterSlashCommandItems('')).toEqual(slashCommandItems)
  })

  it('filters by title and keywords case-insensitively', () => {
    expect(filterSlashCommandItems('head').map((item) => item.title)).toEqual([
      'Heading 1',
      'Heading 2',
      'Heading 3',
    ])
    expect(filterSlashCommandItems('QUOTE').map((item) => item.title)).toEqual(['Quote'])
    expect(filterSlashCommandItems('nope')).toEqual([])
  })
})

describe('slash command item commands', () => {
  /** Range of a typed "/" at the start of the empty first paragraph. */
  const range = { from: 1, to: 1 }

  it('turns the current block into a heading', () => {
    const editor = createEditor()

    findItem('Heading 1').command({ editor, range })

    // TipTap v3 `setNode` appends an empty paragraph after the converted block.
    expect(editor.getJSON()).toEqual({
      type: 'doc',
      content: [{ type: 'heading', attrs: { level: 1 } }, { type: 'paragraph' }],
    })
  })

  it('turns the current block into a bullet list', () => {
    const editor = createEditor()

    findItem('Bullet list').command({ editor, range })

    expect(editor.getJSON()).toEqual({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
        },
        { type: 'paragraph' },
      ],
    })
  })

  it('removes the typed "/query" text before applying the command', () => {
    const editor = createEditor()
    editor.commands.insertContentAt(1, '/hea')

    findItem('Heading 2').command({ editor, range: { from: 1, to: 5 } })

    expect(editor.getJSON()).toEqual({
      type: 'doc',
      content: [{ type: 'heading', attrs: { level: 2 } }, { type: 'paragraph' }],
    })
  })
})
