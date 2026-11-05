import type { ReactNode } from 'react'

export type AuthPanelProps = {
  title: string
  description: string
  children: ReactNode
}

/** Heading plus form column shared by the logged-out pages. */
export const AuthPanel = ({ title, description, children }: AuthPanelProps) => (
  <section aria-labelledby='auth-title' className='flex w-full max-w-sm flex-col gap-7'>
    <div className='flex flex-col gap-1.5'>
      <h1 id='auth-title' className='text-2xl font-semibold tracking-tight'>
        {title}
      </h1>
      <p className='text-sm text-muted-foreground'>{description}</p>
    </div>
    {children}
  </section>
)
