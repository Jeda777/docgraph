import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

/**
 * A provider stand-in with a real Yjs document and working `authenticated`
 * events, so tests can act like the server (scope changes) or a remote peer
 * (document edits). Rendering of seeded content is covered in `document-render.test.tsx`.
 */
const mock = vi.hoisted(() => {
  const listeners = new Map<string, Set<() => void>>()
  return {
    me: { name: 'Jane' as string | null },
    provider: {
      document: undefined as unknown as Y.Doc,
      authorizedScope: 'read-write' as 'read-write' | 'readonly',
      awareness: {
        clientID: 7,
        states: new Map(),
        getStates: () => new Map(),
        getLocalState: () => null,
        setLocalState: () => {},
        setLocalStateField: (() => {}) as (field: string, value: unknown) => void,
        on: () => {},
        off: () => {},
      },
      on: (event: string, listener: () => void) => {
        if (!listeners.has(event)) listeners.set(event, new Set())
        listeners.get(event)?.add(listener)
      },
      off: (event: string, listener: () => void) => listeners.get(event)?.delete(listener),
      emit: (event: string) => {
        for (const listener of listeners.get(event) ?? []) listener()
      },
    },
  }
})

vi.mock('@hocuspocus/provider-react', () => ({ useHocuspocusProvider: () => mock.provider }))

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  useMe: () => mock.me,
}))

const { DocumentEditor } = await import('./document-editor')

/** Appends a paragraph to the shared document, as a synced edit from another peer would. */
const insertParagraph = (doc: Y.Doc, text: string) => {
  const paragraph = new Y.XmlElement('paragraph')
  paragraph.insert(0, [new Y.XmlText(text)])
  const fragment = doc.getXmlFragment('content')
  fragment.insert(fragment.length, [paragraph])
}

const renderEditor = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <DocumentEditor connected itemName='Architecture' />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const editable = () => document.querySelector('.tiptap')?.getAttribute('contenteditable')

beforeEach(() => {
  mock.provider.document = new Y.Doc()
  insertParagraph(mock.provider.document, 'First line')
  mock.provider.authorizedScope = 'read-write'
  mock.provider.awareness.setLocalStateField = vi.fn()
  mock.me.name = 'Jane'
})

afterEach(cleanup)

describe('DocumentEditor', () => {
  it('shows paragraphs a remote peer adds to the shared document', async () => {
    renderEditor()
    expect(screen.getByText('First line')).toBeInTheDocument()

    act(() => insertParagraph(mock.provider.document, 'Added by a peer'))

    expect(await screen.findByText('Added by a peer')).toBeInTheDocument()
  })

  it('follows the read-only scope when the server re-authenticates', async () => {
    renderEditor()
    await waitFor(() => expect(editable()).toBe('true'))
    expect(screen.queryByText('Read-only')).not.toBeInTheDocument()

    mock.provider.authorizedScope = 'readonly'
    act(() => mock.provider.emit('authenticated'))

    await waitFor(() => expect(editable()).toBe('false'))
    expect(screen.getByText('Read-only')).toBeInTheDocument()

    mock.provider.authorizedScope = 'read-write'
    act(() => mock.provider.emit('authenticated'))

    await waitFor(() => expect(editable()).toBe('true'))
  })

  it('offers the block drag handle only while editable', async () => {
    renderEditor()
    await waitFor(() => expect(document.querySelector('.document-drag-handle')).not.toBeNull())

    mock.provider.authorizedScope = 'readonly'
    act(() => mock.provider.emit('authenticated'))

    await waitFor(() => expect(document.querySelector('.document-drag-handle')).toBeNull())
  })

  it('labels the local caret with the signed-in user', async () => {
    renderEditor()

    await waitFor(() =>
      expect(mock.provider.awareness.setLocalStateField).toHaveBeenCalledWith(
        'user',
        expect.objectContaining({ name: 'Jane' }),
      ),
    )
  })

  it('labels the caret as Anonymous for a user without a name', async () => {
    mock.me.name = null
    renderEditor()

    await waitFor(() =>
      expect(mock.provider.awareness.setLocalStateField).toHaveBeenCalledWith(
        'user',
        expect.objectContaining({ name: 'Anonymous' }),
      ),
    )
  })
})
