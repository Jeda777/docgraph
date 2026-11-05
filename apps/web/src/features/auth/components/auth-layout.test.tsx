import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthLayout } from './auth-layout'

afterEach(cleanup)

const me = vi.hoisted(() => ({ current: { data: undefined as unknown, isPending: true } }))

vi.mock('@/lib/api', () => ({
  useMe: () => me.current,
}))

const authedUser = {
  id: 1,
  name: 'jane',
  email: 'jane@example.com',
  isAdmin: false,
  hasPassword: true,
}

const renderRoutes = (path = '/login') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path='/login' element={<div>Login page</div>} />
        </Route>
        <Route path='/projects/:id' element={<div>Project page</div>} />
        <Route path='*' element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  )

describe('AuthLayout', () => {
  beforeEach(() => {
    me.current = { data: undefined, isPending: true }
  })

  it('waits for the session check before rendering the auth page', () => {
    renderRoutes()

    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
  })

  it('renders the auth page when there is no user', () => {
    me.current = { data: null, isPending: false }
    renderRoutes()

    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('redirects to the dashboard when a user is already logged in', () => {
    me.current = { data: authedUser, isPending: false }
    renderRoutes()

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
  })

  it('returns a logged-in user to the remembered page', () => {
    me.current = { data: authedUser, isPending: false }
    renderRoutes('/login?redirect=%2Fprojects%2F7')

    expect(screen.getByText('Project page')).toBeInTheDocument()
  })

  it('ignores a redirect to another origin', () => {
    me.current = { data: authedUser, isPending: false }
    renderRoutes('/login?redirect=%2F%2Fevil.com')

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })
})
