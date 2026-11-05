import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppSidebar } from './app-sidebar'

afterEach(cleanup)

const me = vi.hoisted(() => ({ name: 'jane doe', email: 'jane@example.com', isAdmin: false }))
const projects = vi.hoisted(() => ({ data: [] as unknown[] }))

vi.mock('@/lib/api', () => ({
  useMe: () => me,
  useLogout: () => ({ mutate: vi.fn() }),
  useProjectGetList: () => projects,
}))

const project = (id: string, name: string, isArchived = false, isForAllUsers = true) => ({
  id,
  name,
  isArchived,
  isForAllUsers,
})

const renderSidebar = (props: Partial<Parameters<typeof AppSidebar>[0]> = {}, entry = '/') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <AppSidebar onOpenProfileDialog={() => {}} {...props} />
    </MemoryRouter>,
  )

const projectLinks = () =>
  within(screen.getByRole('navigation', { name: 'Projects' })).queryAllByRole('link')

describe('AppSidebar', () => {
  beforeEach(() => {
    me.isAdmin = false
    projects.data = []
  })

  it('lists active projects first, each group alphabetically', () => {
    projects.data = [
      project('1', 'Zeta'),
      project('2', 'Old', true),
      project('3', 'Alpha'),
      project('4', 'Ancient', true),
    ]
    renderSidebar()

    // The colored mark repeats the initial, so read the name alone.
    const names = projectLinks().map((link) => link.querySelector('.truncate')?.textContent)
    expect(names).toEqual(['Alpha', 'Zeta', 'Ancient', 'Old'])
  })

  it('marks projects that only members can see', () => {
    projects.data = [project('1', 'Open'), project('2', 'Private', false, false)]
    renderSidebar()

    const [open, restricted] = projectLinks()
    expect(within(open as HTMLElement).queryByLabelText('Members only')).not.toBeInTheDocument()
    expect(within(restricted as HTMLElement).getByLabelText('Members only')).toBeInTheDocument()
  })

  it('highlights the current project', () => {
    projects.data = [project('1', 'Alpha'), project('2', 'Beta')]
    renderSidebar({}, '/projects/2')

    const [alpha, beta] = projectLinks()
    expect(beta).toHaveAttribute('aria-current', 'page')
    expect(alpha).not.toHaveAttribute('aria-current')
  })

  it('says when there are no projects', () => {
    renderSidebar()

    expect(screen.getByText('No projects yet.')).toBeInTheDocument()
  })

  it('reports every followed link, so the mobile drawer can close', () => {
    projects.data = [project('1', 'Alpha')]
    const onNavigate = vi.fn()
    renderSidebar({ onNavigate })

    fireEvent.click(screen.getByRole('link', { name: 'All projects' }))
    fireEvent.click(projectLinks()[0] as HTMLElement)

    expect(onNavigate).toHaveBeenCalledTimes(2)
  })

  it('offers user management once, in the account menu, only when given a handler', () => {
    renderSidebar()
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(screen.queryByRole('menuitem', { name: 'Users' })).not.toBeInTheDocument()

    cleanup()
    const onOpenUsersDialog = vi.fn()
    renderSidebar({ onOpenUsersDialog })
    expect(screen.queryByRole('button', { name: 'Users' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Users' }))
    expect(onOpenUsersDialog).toHaveBeenCalledOnce()
  })
})
