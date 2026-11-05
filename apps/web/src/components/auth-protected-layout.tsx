import { Navigate, Outlet, useLocation } from 'react-router'
import { useMe } from '@/lib/api'
import { getLoginPath } from '@/lib/auth-redirect'
import { PageSpinner } from './page-spinner'

export const AuthProtectedLayout = () => {
  const { data: user, isPending } = useMe()
  const { pathname, search, hash } = useLocation()

  if (isPending) return <PageSpinner fullScreen />
  // Remember the page, so logging in again (e.g. after the session expired) returns to it.
  if (!user) return <Navigate to={getLoginPath(pathname + search + hash)} replace />

  return <Outlet />
}
