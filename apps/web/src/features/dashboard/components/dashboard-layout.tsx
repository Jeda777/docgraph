import { Menu, X } from 'lucide-react'
import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { AppLogo } from '@/components/app-logo'
import { Button } from '@/components/ui/button'
import { useMe } from '@/lib/api'
import { lazyNamed } from '@/lib/lazy-named'
import { cn } from '@/lib/utils'
import { AppSidebar } from './app-sidebar'

const UsersDialog = lazyNamed(() => import('./users-dialog'), 'UsersDialog')
const ProfileDialog = lazyNamed(() => import('./profile-dialog'), 'ProfileDialog')

export const DashboardLayout = () => {
  const { isAdmin } = useMe()
  const { pathname } = useLocation()
  const [isUsersDialogOpen, setIsUsersDialogOpen] = useState(false)
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const openButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const mainRef = useRef<HTMLElement>(null)

  // Pages scroll inside <main>, so a new page has to be brought back to its top by hand.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on every route change on purpose
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  // The drawer only exists below md; growing the window past it closes the drawer, so the
  // page never stays inert behind a sidebar that is now static.
  useEffect(() => {
    if (!isDrawerOpen) return
    const desktop = window.matchMedia('(min-width: 48rem)')
    const onChange = () => desktop.matches && setIsDrawerOpen(false)
    desktop.addEventListener('change', onChange)
    return () => desktop.removeEventListener('change', onChange)
  }, [isDrawerOpen])

  useEffect(() => {
    if (!isDrawerOpen) return
    // Keyboard users land inside the drawer they just opened, and back on the menu button after.
    closeButtonRef.current?.focus()
    const openButton = openButtonRef.current
    const drawer = drawerRef.current
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      // Escape inside an open menu or dialog (e.g. the account menu) closes only that.
      if (event.target instanceof Element && event.target.closest('[role="menu"], [role="dialog"]'))
        return
      setIsDrawerOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      const focused = document.activeElement
      if (focused === document.body || (focused && drawer?.contains(focused))) openButton?.focus()
    }
  }, [isDrawerOpen])

  const openUsersDialog = isAdmin
    ? () => {
        setIsDrawerOpen(false)
        setIsUsersDialogOpen(true)
      }
    : undefined
  const openProfileDialog = () => {
    setIsDrawerOpen(false)
    setIsProfileDialogOpen(true)
  }

  return (
    <>
      <div className='flex h-dvh w-full bg-background'>
        {/* Below md the sidebar is a drawer opened from the top bar. Closed, it is also
            invisible, which takes its links out of the tab order and the accessibility tree. */}
        <aside
          ref={drawerRef}
          id='app-navigation'
          aria-label='Navigation'
          className={cn(
            'fixed inset-y-0 left-0 z-40 w-72 border-r border-sidebar-border shadow-lift transition-[translate,visibility] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
            'md:visible md:static md:z-auto md:w-64 md:translate-x-0 md:shadow-none md:transition-none',
            isDrawerOpen ? 'visible translate-x-0' : 'invisible -translate-x-full',
          )}
        >
          <AppSidebar
            onOpenUsersDialog={openUsersDialog}
            onOpenProfileDialog={openProfileDialog}
            onNavigate={() => setIsDrawerOpen(false)}
          />
          <Button
            ref={closeButtonRef}
            variant='ghost'
            size='icon-sm'
            aria-label='Close navigation'
            className='absolute top-4 right-3 md:hidden'
            onClick={() => setIsDrawerOpen(false)}
          >
            <X />
          </Button>
        </aside>

        {isDrawerOpen && (
          <button
            type='button'
            aria-label='Close navigation'
            tabIndex={-1}
            className='fixed inset-0 z-30 bg-black/40 animate-in fade-in-0 md:hidden'
            onClick={() => setIsDrawerOpen(false)}
          />
        )}

        {/* While the drawer is open, the page behind it is out of reach of Tab and screen readers. */}
        <div inert={isDrawerOpen} className='flex min-w-0 flex-1 flex-col'>
          <header className='flex h-14 shrink-0 items-center gap-2 border-b px-4 md:hidden'>
            <Button
              ref={openButtonRef}
              variant='ghost'
              size='icon'
              aria-label='Open navigation'
              aria-controls='app-navigation'
              aria-expanded={isDrawerOpen}
              onClick={() => setIsDrawerOpen(true)}
            >
              <Menu />
            </Button>
            <Link to='/' className='flex items-center gap-2 font-semibold tracking-tight'>
              <AppLogo className='size-6' />
              DocGraph
            </Link>
          </header>

          <main ref={mainRef} id='main' className='min-h-0 flex-1 overflow-y-auto'>
            <div className='mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-8 md:py-10'>
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {isAdmin && (
        <Suspense>
          <UsersDialog isOpen={isUsersDialogOpen} setOpen={setIsUsersDialogOpen} />
        </Suspense>
      )}

      <Suspense>
        <ProfileDialog isOpen={isProfileDialogOpen} setOpen={setIsProfileDialogOpen} />
      </Suspense>
    </>
  )
}
