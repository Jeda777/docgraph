import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const PROJECT_ID = '01HZX3W5Y8K9M2N4P6Q7R8S9T0'
const MEMBER_ID = '01HZX3W5Y8K9M2N4P6Q7R8S9T1'

const PROJECT = {
  id: PROJECT_ID,
  name: 'Shop',
  isForAllUsers: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  isArchived: false,
  members: [{ id: MEMBER_ID, name: 'Ann', email: 'ann@example.com' }],
}

const api = vi.hoisted(() => ({
  getById: vi.fn(),
  update: { isPending: false, mutateAsync: vi.fn() },
  remove: {
    isPending: false,
    isSuccess: false,
    variables: undefined as string | undefined,
    mutateAsync: vi.fn(),
  },
}))

vi.mock('@/lib/api', () => ({
  useProjectGetById: api.getById,
  useProjectUpdate: () => api.update,
  useProjectDelete: () => api.remove,
  useUserGetList: () => ({ data: PROJECT.members }),
}))

vi.mock('@/lib/error-toast', () => ({ showErrorToast: vi.fn() }))

const { ProjectSettingsDialog } = await import('./project-settings-dialog')

beforeEach(() => {
  api.getById.mockReset().mockReturnValue({ data: PROJECT })
  api.update.mutateAsync.mockReset().mockResolvedValue(undefined)
  api.remove.mutateAsync.mockReset().mockResolvedValue(undefined)
  Object.assign(api.remove, { isSuccess: false, variables: undefined })
})

afterEach(cleanup)

describe('ProjectSettingsDialog', () => {
  it('stays closed and skips the query without a project', () => {
    api.getById.mockReturnValue({ data: undefined })
    render(<ProjectSettingsDialog projectId={null} onClose={vi.fn()} />)

    expect(screen.queryByText('Project Settings')).not.toBeInTheDocument()
    expect(api.getById).toHaveBeenCalledWith('', { getMembers: true }, false)
  })

  it('stays closed until the project is loaded', () => {
    api.getById.mockReturnValue({ data: undefined })
    render(<ProjectSettingsDialog projectId={PROJECT_ID} onClose={vi.fn()} />)

    expect(screen.queryByText('Project Settings')).not.toBeInTheDocument()
    expect(api.getById).toHaveBeenCalledWith(PROJECT_ID, { getMembers: true }, true)
  })

  it('skips the query for the project it just deleted', () => {
    Object.assign(api.remove, { isSuccess: true, variables: PROJECT_ID })
    render(<ProjectSettingsDialog projectId={PROJECT_ID} onClose={vi.fn()} />)

    expect(api.getById).toHaveBeenLastCalledWith(PROJECT_ID, { getMembers: true }, false)
  })

  it('loads another project after deleting one', () => {
    Object.assign(api.remove, { isSuccess: true, variables: 'other' })
    render(<ProjectSettingsDialog projectId={PROJECT_ID} onClose={vi.fn()} />)

    expect(api.getById).toHaveBeenLastCalledWith(PROJECT_ID, { getMembers: true }, true)
  })

  it('fills the form with the loaded project', async () => {
    render(<ProjectSettingsDialog projectId={PROJECT_ID} onClose={vi.fn()} />)

    expect(await screen.findByText('Project Settings')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Shop'))
    expect(screen.getByRole('checkbox', { name: 'For All Users' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Is Archived' })).not.toBeChecked()
    expect(screen.getByText('Ann')).toBeInTheDocument()
  })

  it('saves the edited project with its members and closes', async () => {
    const onClose = vi.fn()
    render(<ProjectSettingsDialog projectId={PROJECT_ID} onClose={onClose} />)
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Shop'))

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Store' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Is Archived' }))
    const save = screen.getByRole('button', { name: 'Save' })
    await waitFor(() => expect(save).toBeEnabled())
    fireEvent.click(save)

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(api.update.mutateAsync).toHaveBeenCalledWith({
      id: PROJECT_ID,
      name: 'Store',
      isForAllUsers: false,
      memberIds: [MEMBER_ID],
      isArchived: true,
    })
  })

  it('deletes the project after confirmation', async () => {
    const onClose = vi.fn()
    render(<ProjectSettingsDialog projectId={PROJECT_ID} onClose={onClose} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    const confirmation = await screen.findByRole('alertdialog')
    expect(confirmation).toHaveTextContent(
      /The project and all its items will be permanently deleted/,
    )
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(api.remove.mutateAsync).toHaveBeenCalledWith(PROJECT_ID)
  })
})
