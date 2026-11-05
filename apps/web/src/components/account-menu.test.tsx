import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '@/lib/stores'
import { AccountMenu } from './account-menu'

afterEach(cleanup)

const logout = vi.hoisted(() => vi.fn())

const authedUser = vi.hoisted(() => ({
  name: 'jane doe',
  email: 'jane@example.com',
  isAdmin: false,
}))

vi.mock('@/lib/api', () => ({
  useLogout: () => ({ mutate: logout }),
  useMe: () => authedUser,
}))

const openMenu = () => {
  fireEvent.click(screen.getByRole('button'))
}

describe('AccountMenu', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    logout.mockReset()
    act(() => useUiStore.setState({ theme: 'light' }))
  })

  it('shows the user initials as the trigger', () => {
    render(<AccountMenu />)

    expect(screen.getByRole('button')).toHaveTextContent('JD')
  })

  it('hides profile and users entries when no handlers are given', () => {
    render(<AccountMenu />)
    openMenu()

    expect(screen.queryByRole('menuitem', { name: /profile/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /users/i })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /logout/i })).toBeInTheDocument()
  })

  it('shows profile and users entries when handlers are given', () => {
    const handleOpenProfileDialog = vi.fn()
    const handleOpenUsersDialog = vi.fn()
    render(
      <AccountMenu
        handleOpenProfileDialog={handleOpenProfileDialog}
        handleOpenUsersDialog={handleOpenUsersDialog}
      />,
    )

    openMenu()

    expect(screen.getByRole('menuitem', { name: /profile/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /users/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('menuitem', { name: /profile/i }))
    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: /users/i }))

    expect(handleOpenProfileDialog).toHaveBeenCalledTimes(1)
    expect(handleOpenUsersDialog).toHaveBeenCalledTimes(1)
  })

  it('toggles the theme from the menu', () => {
    render(<AccountMenu />)
    openMenu()

    fireEvent.click(screen.getByRole('menuitem', { name: /dark mode/i }))

    expect(useUiStore.getState().theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('invokes logout from the menu', () => {
    render(<AccountMenu />)
    openMenu()

    fireEvent.click(screen.getByRole('menuitem', { name: /logout/i }))

    expect(logout).toHaveBeenCalledTimes(1)
  })
})
