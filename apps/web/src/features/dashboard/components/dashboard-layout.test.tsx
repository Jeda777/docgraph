import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DashboardLayout } from './dashboard-layout'

afterEach(cleanup)

// jsdom has no scrolling; the layout resets the page scroll on every route change.
beforeAll(() => {
  Element.prototype.scrollTo = () => {}
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList
})

vi.mock('@/lib/api', () => ({
  useMe: () => ({ name: 'jane doe', email: 'jane@example.com', isAdmin: false }),
  useLogout: () => ({ mutate: vi.fn() }),
  useProjectGetList: () => ({
    data: [{ id: '1', name: 'Alpha', isArchived: false, isForAllUsers: true }],
  }),
}))

// The dialogs load lazily and talk to the API; the drawer does not need them.
vi.mock('./users-dialog', () => ({ UsersDialog: () => null }))
vi.mock('./profile-dialog', () => ({ ProfileDialog: () => null }))

const renderLayout = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path='/' element={<p>Home page</p>} />
          <Route path='/projects/:id' element={<p>Project page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

const drawer = () => screen.getByRole('complementary', { name: 'Navigation', hidden: true })
const openButton = () => screen.getByRole('button', { name: 'Open navigation' })

const openDrawer = () => {
  act(() => openButton().click())
}

describe('DashboardLayout drawer', () => {
  it('keeps the closed drawer out of reach of keyboard and screen readers', () => {
    renderLayout()

    expect(drawer()).toHaveClass('invisible')
    expect(openButton()).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens with focus inside the drawer', () => {
    renderLayout()
    openDrawer()

    expect(drawer()).toHaveClass('visible')
    expect(openButton()).toHaveAttribute('aria-expanded', 'true')
    const closeButtons = screen.getAllByRole('button', { name: 'Close navigation' })
    expect(closeButtons).toContain(document.activeElement)
  })

  it('keeps focus and screen readers away from the page behind the open drawer', () => {
    renderLayout()
    const page = screen.getByText('Home page').closest('[inert]')
    expect(page).toBeNull()

    openDrawer()

    expect(screen.getByText('Home page').closest('[inert]')).not.toBeNull()
  })

  it('closes on Escape and gives focus back to the menu button', () => {
    renderLayout()
    openDrawer()

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(drawer()).toHaveClass('invisible')
    expect(document.activeElement).toBe(openButton())
  })

  it('leaves the drawer open when Escape only closes the account menu inside it', () => {
    renderLayout()
    openDrawer()

    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })

    expect(drawer()).toHaveClass('visible')
  })

  it('closes after following a link', () => {
    renderLayout()
    openDrawer()

    fireEvent.click(screen.getByRole('link', { name: 'Alpha' }))

    expect(screen.getByText('Project page')).toBeInTheDocument()
    expect(drawer()).toHaveClass('invisible')
  })
})
