import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProtectedLayout } from './components/auth-protected-layout'
import { Toaster } from './components/ui/toast'
import { TooltipProvider } from './components/ui/tooltip'
import { queryClient } from './lib/api'
import { lazyNamed } from './lib/lazy-named'

const AuthLayout = lazyNamed(() => import('./features/auth/components/auth-layout'), 'AuthLayout')
const LoginPage = lazyNamed(() => import('./features/auth/pages/login'), 'LoginPage')
const LoginOtp = lazyNamed(() => import('./features/auth/pages/login-otp'), 'LoginOtp')
const ResetPage = lazyNamed(() => import('./features/auth/pages/reset'), 'ResetPage')
const DashboardLayout = lazyNamed(
  () => import('./features/dashboard/components/dashboard-layout'),
  'DashboardLayout',
)
const ProjectsPage = lazyNamed(() => import('./features/dashboard/pages/projects'), 'ProjectsPage')
const ProjectDetailsPage = lazyNamed(
  () => import('./features/dashboard/pages/project-details'),
  'ProjectDetailsPage',
)
const ItemPage = lazyNamed(() => import('./features/item/index'), 'ItemPage')

export const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AuthLayout />}>
              <Route path='/login' element={<LoginPage />} />
              <Route path='/login-otp' element={<LoginOtp />} />
              <Route path='/reset' element={<ResetPage />} />
            </Route>

            <Route element={<AuthProtectedLayout />}>
              <Route element={<DashboardLayout />}>
                <Route path='/' element={<ProjectsPage />} />
                <Route path='/projects/:projectId' element={<ProjectDetailsPage />} />
              </Route>

              <Route path='/item/:itemId' element={<ItemPage />} />
            </Route>

            <Route path='*' element={<Navigate to='/' />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
