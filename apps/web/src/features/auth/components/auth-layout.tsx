import { Navigate, Outlet } from 'react-router'
import { AppLogo } from '@/components/app-logo'
import { PageSpinner } from '@/components/page-spinner'
import { useMe } from '@/lib/api'
import { useAuthRedirect } from '../hooks/use-auth-redirect'
import { AuthShowcase } from './auth-showcase'

export const AuthLayout = () => {
  const { data: user, isPending } = useMe()
  const { redirectTo } = useAuthRedirect()

  if (isPending) return <PageSpinner fullScreen />
  if (user) return <Navigate to={redirectTo} replace />

  return (
    <div className='grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]'>
      <div className='flex flex-col px-6 py-6 sm:px-10'>
        <div className='flex items-center gap-2 text-[0.9375rem] font-semibold tracking-tight'>
          <AppLogo className='size-7' />
          DocGraph
        </div>
        <main className='flex flex-1 items-center justify-center py-12'>
          <Outlet />
        </main>
      </div>
      <AuthShowcase />
    </div>
  )
}
