import { act, cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Cursors } from './cursors'

const awareness = vi.hoisted(() => {
  const changeListeners = new Set<() => void>()
  return {
    clientID: 5,
    states: new Map<number, Record<string, unknown>>(),
    getStates: () => awareness.states,
    setLocalStateField: vi.fn(),
    on: (_event: string, listener: () => void) => changeListeners.add(listener),
    off: (_event: string, listener: () => void) => changeListeners.delete(listener),
    emitChange: () => {
      for (const listener of changeListeners) listener()
    },
  }
})

const provider = vi.hoisted(() => ({ awareness }))

vi.mock('@hocuspocus/provider-react', () => ({ useHocuspocusProvider: () => provider }))

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  useMe: () => ({ name: 'Jane Doe' }),
}))

const renderCursors = () =>
  render(
    <ReactFlowProvider>
      <Cursors />
    </ReactFlowProvider>,
  )

/** Sets another client's awareness state, as a synced update would. */
const setRemoteState = (clientId: number, state: Record<string, unknown>) =>
  act(() => {
    awareness.states.set(clientId, state)
    awareness.emitChange()
  })

beforeEach(() => {
  awareness.states = new Map()
  awareness.setLocalStateField.mockReset()
})

afterEach(cleanup)

describe('Cursors', () => {
  it('publishes the local name and theme color name', () => {
    renderCursors()

    expect(awareness.setLocalStateField).toHaveBeenCalledWith('name', 'Jane Doe')
    expect(awareness.setLocalStateField).toHaveBeenCalledWith('colorName', 'cyan')
  })

  it("shows a remote cursor in the peer's theme color", () => {
    renderCursors()

    setRemoteState(2, { name: 'Bob Smith', colorName: 'blue', cursor: { x: 100, y: 100 } })

    expect(screen.getByText('BS').style.background).toBe('var(--color-blue-500)')
  })

  it('falls back to gray for an unknown remote color', () => {
    renderCursors()

    setRemoteState(2, { name: 'Bob Smith', colorName: 'red; x', cursor: { x: 100, y: 100 } })

    expect(screen.getByText('BS').style.background).toBe('var(--color-gray-500)')
  })

  it('hides the local cursor and peers without a position', () => {
    renderCursors()

    setRemoteState(5, { name: 'Jane Doe', colorName: 'cyan', cursor: { x: 100, y: 100 } })
    setRemoteState(2, { name: 'Bob Smith', colorName: 'blue', cursor: null })

    expect(screen.queryByText('JD')).toBeNull()
    expect(screen.queryByText('BS')).toBeNull()
  })
})
