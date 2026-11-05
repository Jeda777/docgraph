import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FormInput } from './form-input'
import { SettingsDialog, type SettingsDialogProps } from './settings-dialog'

afterEach(cleanup)

const showErrorToast = vi.hoisted(() => vi.fn())

vi.mock('@/lib/error-toast', () => ({ showErrorToast }))

type Values = { name: string }

type TestDialogProps = Partial<
  Pick<
    SettingsDialogProps<Values>,
    'onClose' | 'onSave' | 'onDelete' | 'isSaving' | 'isDeleting' | 'deleteScope'
  >
>

const TestDialog = ({
  onClose = vi.fn(),
  onSave = vi.fn().mockResolvedValue(undefined),
  onDelete = vi.fn().mockResolvedValue(undefined),
  isSaving = false,
  isDeleting = false,
  deleteScope,
}: TestDialogProps) => {
  const form = useForm<Values>({ defaultValues: { name: 'Old' } })
  return (
    <SettingsDialog
      open
      onClose={onClose}
      title='Thing Settings'
      id='thing-settings-form'
      entityLabel='thing'
      form={form}
      onSave={onSave}
      isSaving={isSaving}
      onDelete={onDelete}
      isDeleting={isDeleting}
      deleteScope={deleteScope}
    >
      <FormInput name='name' label='Name' />
    </SettingsDialog>
  )
}

const editAndSave = async () => {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New' } })
  const save = screen.getByRole('button', { name: 'Save' })
  await waitFor(() => expect(save).toBeEnabled())
  fireEvent.click(save)
}

const CONFIRM_TEXT = /This action cannot be undone/

/** Opens the confirmation and clicks its Delete button (the last one, rendered in a portal). */
const confirmDelete = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  await screen.findByText(CONFIRM_TEXT)
  fireEvent.click(screen.getAllByRole('button', { name: 'Delete' }).at(-1) as Element)
}

describe('SettingsDialog', () => {
  beforeEach(() => showErrorToast.mockReset())

  it('saves the form and closes on success', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<TestDialog onSave={onSave} onClose={onClose} />)

    await editAndSave()

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0]?.[0]).toEqual({ name: 'New' })
    expect(showErrorToast).not.toHaveBeenCalled()
  })

  it('stays open and shows a toast when saving fails', async () => {
    const error = new Error('boom')
    const onClose = vi.fn()
    render(<TestDialog onSave={vi.fn().mockRejectedValue(error)} onClose={onClose} />)

    await editAndSave()

    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith('Could not save the thing', error),
    )
    expect(onClose).not.toHaveBeenCalled()
  })

  it('asks for confirmation before deleting', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<TestDialog onDelete={onDelete} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await screen.findByText(CONFIRM_TEXT)
    expect(onDelete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByText(CONFIRM_TEXT)).not.toBeInTheDocument())
    expect(onDelete).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('warns that deleting is permanent and points to archiving instead', async () => {
    render(<TestDialog deleteScope='and all its parts' />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(
      await screen.findByText(
        'This action cannot be undone. The thing and all its parts will be permanently deleted.' +
          ' To keep it read-only instead, archive the thing.',
      ),
    ).toBeInTheDocument()
  })

  it('deletes after confirmation and closes on success', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<TestDialog onDelete={onDelete} onClose={onClose} />)

    await confirmDelete()

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('shows a toast when deleting fails', async () => {
    const error = new Error('boom')
    const onClose = vi.fn()
    render(<TestDialog onDelete={vi.fn().mockRejectedValue(error)} onClose={onClose} />)

    await confirmDelete()

    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith('Could not delete the thing', error),
    )
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText(CONFIRM_TEXT)).toBeInTheDocument()
  })

  it('ignores a save while one is already in progress', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<TestDialog onSave={onSave} isSaving />)

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New' } })
    fireEvent.submit(document.getElementById('thing-settings-form') as HTMLFormElement)

    await act(() => Promise.resolve())
    expect(onSave).not.toHaveBeenCalled()
  })
})
