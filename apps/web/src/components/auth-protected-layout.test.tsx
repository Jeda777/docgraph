import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProtectedLayout } from './auth-protected-layout'

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

const LoginProbe = () => <div>Login page {useLocation().search}</div>

const renderRoutes = (path = '/projects') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AuthProtectedLayout />}>
          <Route path='*' element={<div>Protected content</div>} />
        </Route>
        <Route path='/login' element={<LoginProbe />} />
      </Routes>
    </MemoryRouter>,
  )

describe('AuthProtectedLayout', () => {
  beforeEach(() => {
    me.current = { data: undefined, isPending: true }
  })

  it('waits for the session check instead of redirecting', () => {
    renderRoutes()

    expect(screen.queryByText(/Login page/)).not.toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('redirects to the login page when there is no user', () => {
    me.current = { data: null, isPending: false }
    renderRoutes()

    expect(screen.getByText(/Login page/)).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('remembers the current page in the login redirect', () => {
    me.current = { data: null, isPending: false }
    renderRoutes('/projects/7?sort=name')

    expect(
      screen.getByText('Login page ?redirect=%2Fprojects%2F7%3Fsort%3Dname'),
    ).toBeInTheDocument()
  })

  it('renders the protected content when a user is logged in', () => {
    me.current = { data: authedUser, isPending: false }
    renderRoutes()

    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })
})
