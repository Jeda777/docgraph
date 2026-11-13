import { apiKeyDateInDays } from '@docgraph/common/schemas'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const KEY_ID = '01HZX3W5Y8K9M2N4P6Q7R8S9T3'
const PROJECT_ID = '01HZX3W5Y8K9M2N4P6Q7R8S9T4'
const ITEM_ID = '01HZX3W5Y8K9M2N4P6Q7R8S9T5'
const UNRESTRICTED = { readOnly: false, projects: null }
const PLAIN_KEY = 'dg_secret_value'

const api = vi.hoisted(() => ({
  list: { data: undefined as unknown },
  create: { isPending: false, mutate: vi.fn() },
  remove: { isPending: false, mutate: vi.fn() },
  projects: { data: undefined as unknown },
  project: { data: undefined as unknown },
}))

vi.mock('@/lib/api', () => ({
  useApiKeyGetList: () => api.list,
  useApiKeyCreate: () => api.create,
  useApiKeyDelete: () => api.remove,
  useProjectGetList: () => api.projects,
  useProjectGetById: () => api.project,
}))

const showErrorToast = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ add: vi.fn() }))

vi.mock('@/lib/error-toast', () => ({ showErrorToast }))
vi.mock('@/components/ui/toast', () => ({ toast }))

const { ApiKeysSection } = await import('./api-keys-section')

type MutateOptions = { onSuccess?: (data?: unknown) => void; onError?: (error: unknown) => void }

const lastOptions = (mutate: typeof api.create.mutate) =>
  mutate.mock.calls.at(-1)?.[1] as MutateOptions | undefined

const writeText = vi.fn()

// jsdom has no clipboard; install a fake for each test and put the original back afterwards.
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

const createKey = async (name: string) => {
  fireEvent.change(screen.getByPlaceholderText(/Key name/), { target: { value: name } })
  fireEvent.click(screen.getByRole('button', { name: 'Create API key' }))
  await waitFor(() => expect(api.create.mutate).toHaveBeenCalled())
}

beforeEach(() => {
  api.projects.data = [{ id: PROJECT_ID, name: 'Billing' }]
  api.project.data = { items: [{ id: ITEM_ID, name: 'Schema' }] }
  api.list.data = [
    {
      id: KEY_ID,
      name: 'laptop',
      createdAt: new Date(2026, 0, 1),
      lastUsedAt: null,
      expiresAt: null,
      restrictions: UNRESTRICTED,
    },
  ]
  api.create.isPending = false
  api.create.mutate.mockReset()
  api.remove.isPending = false
  api.remove.mutate.mockReset()
  showErrorToast.mockReset()
  toast.add.mockReset()
  writeText.mockReset().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})

afterEach(() => {
  cleanup()
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
})

describe('ApiKeysSection', () => {
  it('lists existing keys', () => {
    render(<ApiKeysSection />)

    expect(screen.getByText('laptop')).toBeInTheDocument()
    expect(screen.getByText('Last used never')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revoke laptop' })).toBeInTheDocument()
  })

  it('renders no list without keys', () => {
    api.list.data = []
    render(<ApiKeysSection />)

    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('does not create a key without a name', async () => {
    render(<ApiKeysSection />)

    fireEvent.click(screen.getByRole('button', { name: 'Create API key' }))

    expect(await screen.findByText('This field is required')).toBeInTheDocument()
    expect(api.create.mutate).not.toHaveBeenCalled()
  })

  it('shows the created key once with a ready-made Claude Code command', async () => {
    render(<ApiKeysSection />)
    await createKey('desktop')

    expect(api.create.mutate.mock.calls[0]?.[0]).toEqual({
      name: 'desktop',
      expiresOn: '',
      restrictions: UNRESTRICTED,
    })
    act(() => lastOptions(api.create.mutate)?.onSuccess?.({ key: PLAIN_KEY }))

    expect(screen.getByText(/it will not be shown again/)).toBeInTheDocument()
    expect(screen.getByText(PLAIN_KEY)).toBeInTheDocument()
    expect(screen.getByText(/^claude mcp add --transport http docgraph/)).toHaveTextContent(
      `/mcp --header "x-api-key: ${PLAIN_KEY}"`,
    )
    expect(screen.getByPlaceholderText(/Key name/)).toHaveValue('')

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByText(PLAIN_KEY)).not.toBeInTheDocument()
  })

  it('copies the created key to the clipboard', async () => {
    render(<ApiKeysSection />)
    await createKey('desktop')
    act(() => lastOptions(api.create.mutate)?.onSuccess?.({ key: PLAIN_KEY }))

    fireEvent.click(screen.getByRole('button', { name: 'Copy API key' }))

    await waitFor(() =>
      expect(toast.add).toHaveBeenCalledWith({ type: 'success', title: 'Copied to clipboard' }),
    )
    expect(writeText).toHaveBeenCalledWith(PLAIN_KEY)
  })

  it('tells the user to copy manually when the clipboard fails', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    render(<ApiKeysSection />)
    await createKey('desktop')
    act(() => lastOptions(api.create.mutate)?.onSuccess?.({ key: PLAIN_KEY }))

    fireEvent.click(screen.getByRole('button', { name: 'Copy Claude Code' }))

    await waitFor(() =>
      expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' })),
    )
  })

  it('reports a failed creation in a toast', async () => {
    render(<ApiKeysSection />)
    await createKey('desktop')

    const error = new Error('boom')
    act(() => lastOptions(api.create.mutate)?.onError?.(error))

    expect(showErrorToast).toHaveBeenCalledWith('Could not create the API key', error)
    expect(screen.queryByText(/it will not be shown again/)).not.toBeInTheDocument()
  })

  it('revokes a key after confirmation', async () => {
    render(<ApiKeysSection />)

    fireEvent.click(screen.getByRole('button', { name: 'Revoke laptop' }))
    await screen.findByText(/Agents using "laptop" will lose access/)
    expect(api.remove.mutate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(api.remove.mutate.mock.calls[0]?.[0]).toBe(KEY_ID)
    act(() => lastOptions(api.remove.mutate)?.onSuccess?.())
    expect(toast.add).toHaveBeenCalledWith({ type: 'success', title: 'API key revoked' })
    await waitFor(() => expect(screen.queryByText(/Agents using "laptop"/)).not.toBeInTheDocument())
  })

  it('keeps the confirmation open when revoking fails', async () => {
    render(<ApiKeysSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Revoke laptop' }))
    await screen.findByText(/Agents using "laptop"/)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    const error = new Error('boom')
    act(() => lastOptions(api.remove.mutate)?.onError?.(error))

    expect(showErrorToast).toHaveBeenCalledWith('Could not revoke the API key', error)
    expect(screen.getByText(/Agents using "laptop"/)).toBeInTheDocument()
  })

  it('describes the access and expiry of keys', () => {
    api.list.data = [
      {
        id: KEY_ID,
        name: 'ci',
        createdAt: new Date(2026, 0, 1),
        lastUsedAt: null,
        expiresAt: new Date(2000, 0, 1),
        restrictions: { readOnly: true, projects: [{ projectId: PROJECT_ID, itemIds: [ITEM_ID] }] },
      },
    ]
    render(<ApiKeysSection />)

    expect(screen.getByText('Read-only · Billing (1 item)')).toBeInTheDocument()
    expect(screen.getByText(/^Expired /)).toBeInTheDocument()
  })

  it('creates a read-only key limited to selected items', async () => {
    render(<ApiKeysSection />)
    fireEvent.change(screen.getByPlaceholderText(/Key name/), { target: { value: 'ci' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Read-only/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'Selected projects and items' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Billing' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Selected items' }))

    fireEvent.click(screen.getByRole('button', { name: 'Create API key' }))
    expect(await screen.findByText('Select at least one item')).toBeInTheDocument()
    expect(api.create.mutate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Schema' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create API key' }))

    await waitFor(() => expect(api.create.mutate).toHaveBeenCalled())
    expect(api.create.mutate.mock.calls[0]?.[0]).toEqual({
      name: 'ci',
      expiresOn: '',
      restrictions: { readOnly: true, projects: [{ projectId: PROJECT_ID, itemIds: [ITEM_ID] }] },
    })
  })

  it('requires a project when access is limited', async () => {
    render(<ApiKeysSection />)
    fireEvent.change(screen.getByPlaceholderText(/Key name/), { target: { value: 'ci' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Selected projects and items' }))

    fireEvent.click(screen.getByRole('button', { name: 'Create API key' }))

    expect(await screen.findByText('Select at least one project')).toBeInTheDocument()
    expect(api.create.mutate).not.toHaveBeenCalled()
  })

  it('sends the chosen expiry date', async () => {
    render(<ApiKeysSection />)
    fireEvent.change(screen.getByPlaceholderText(/Key name/), { target: { value: 'ci' } })
    fireEvent.change(screen.getByLabelText(/Expires on/), {
      target: { value: apiKeyDateInDays(30) },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create API key' }))

    await waitFor(() => expect(api.create.mutate).toHaveBeenCalled())
    expect(api.create.mutate.mock.calls[0]?.[0]).toMatchObject({ expiresOn: apiKeyDateInDays(30) })
  })
})
