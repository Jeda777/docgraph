import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DocumentEditor } from './document-editor'

/** Flipped by individual tests to exercise the read-only scope. */
const mockProviderState = { authorizedScope: 'read-write' as 'read-write' | 'readonly' }

// A real Yjs document (the Collaboration extension binds to it) plus an inert awareness stub
// keep the editor renderable outside the app shell.
vi.mock('@hocuspocus/provider-react', async () => {
  const Y = await import('yjs')
  const document = new Y.Doc()

  // A heading and a paragraph with one bold segment, as a synced peer would leave them.
  const fragment = document.getXmlFragment('content')
  const heading = new Y.XmlElement('heading')
  heading.setAttribute('level', '1')
  const headingText = new Y.XmlText()
  headingText.insert(0, 'System overview')
  heading.insert(0, [headingText])

  const paragraph = new Y.XmlElement('paragraph')
  const paragraphText = new Y.XmlText()
  paragraphText.insert(0, 'Documentation lives')
  paragraphText.insert(paragraphText.length, ' next to the diagrams', { bold: true })
  paragraph.insert(0, [paragraphText])

  fragment.insert(0, [heading, paragraph])

  const awareness = {
    clientID: 42,
    states: new Map(),
    getStates: () => new Map(),
    getLocalState: () => null,
    setLocalState: () => {},
    setLocalStateField: () => {},
    on: () => {},
    off: () => {},
  }

  return {
    useHocuspocusProvider: () => ({
      awareness,
      authorizedScope: mockProviderState.authorizedScope,
      on: () => {},
      off: () => {},
      document,
    }),
  }
})

// The editor labels the local cursor with the signed-in user; keep it off the network.
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  useMe: () => ({ data: { id: 1, name: 'jane', email: 'jane@example.com' } }),
}))

afterEach(cleanup)

/** The toolbar navigates, so the editor must mount inside a router; the top bar uses query hooks. */
const renderDocument = (props: { connected: boolean; itemName: string }) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <DocumentEditor {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  )

describe('document editor rendering', () => {
  it('renders the toolbar with the item name', () => {
    renderDocument({ connected: true, itemName: 'Architecture' })

    expect(screen.getByText('Architecture')).toBeInTheDocument()
  })

  it('renders the seeded collaborative content as editable text', () => {
    const { container } = renderDocument({ connected: true, itemName: 'Architecture' })

    // The heading and the plain text segment come through the Yjs fragment.
    expect(screen.getByText('System overview')).toBeInTheDocument()
    expect(screen.getByText('Documentation lives')).toBeInTheDocument()
    // The bold-marked segment renders inside a strong element.
    expect(screen.getByText('next to the diagrams').closest('strong')).toBeInTheDocument()

    expect(container.querySelector('.tiptap')).toHaveAttribute('contenteditable', 'true')
  })

  it('renders bold marks of the seeded content only once', () => {
    const { container } = renderDocument({ connected: true, itemName: 'Architecture' })

    expect(container.querySelectorAll('strong')).toHaveLength(1)
  })

  it('opens read-only when the server grants the readonly scope', () => {
    mockProviderState.authorizedScope = 'readonly'
    const { container } = renderDocument({ connected: true, itemName: 'Architecture' })

    expect(screen.getByText('Read-only')).toBeInTheDocument()
    expect(container.querySelector('.tiptap')).toHaveAttribute('contenteditable', 'false')
  })

  it('shows a spinner while the connection is not established', () => {
    const { container } = renderDocument({ connected: false, itemName: 'Architecture' })

    expect(screen.queryByText('System overview')).not.toBeInTheDocument()
    expect(container.querySelector('.tiptap')).not.toBeInTheDocument()
  })
})
