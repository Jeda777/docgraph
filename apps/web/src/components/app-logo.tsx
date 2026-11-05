import { cn } from '@/lib/utils'

export type AppLogoProps = {
  className?: string
}

/** Inline copy of `public/logo.svg` that follows the theme's primary colors. */
export const AppLogo = ({ className }: AppLogoProps) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 64 64'
    fill='none'
    aria-hidden='true'
    className={cn('size-8 shrink-0', className)}
  >
    <path
      className='fill-primary'
      d='M17 4h21.5c1.06 0 2.08.42 2.83 1.17l11.5 11.5A4 4 0 0 1 54 19.5V55a5 5 0 0 1-5 5H17a5 5 0 0 1-5-5V9a5 5 0 0 1 5-5Z'
    />
    <path
      className='fill-primary opacity-60'
      d='M39 4.3V14a5 5 0 0 0 5 5h9.7a4 4 0 0 0-.86-2.33l-11.5-11.5A4 4 0 0 0 39 4.3Z'
    />
    <path
      className='stroke-primary-foreground'
      strokeLinecap='round'
      strokeWidth='3'
      d='m25 28 17 6M25 28l4 19M42 34 29 47'
    />
    <g className='fill-primary-foreground'>
      <circle cx='25' cy='28' r='5' />
      <circle cx='42' cy='34' r='5' />
      <circle cx='29' cy='47' r='5' />
    </g>
  </svg>
)
