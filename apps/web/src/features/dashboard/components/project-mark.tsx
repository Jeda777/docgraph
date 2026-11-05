import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

/** Hues that sit well next to the brand green in both themes. */
const MARK_HUES = [163, 190, 230, 265, 300, 30, 70, 130]

const hueFor = (seed: string) => {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return MARK_HUES[Math.abs(hash) % MARK_HUES.length]
}

export type ProjectMarkProps = {
  /** Stable seed for the color, usually the project id. */
  seed: string
  name: string
  className?: string
}

/** Colored initial of a project, so projects are told apart at a glance in lists and the sidebar. */
export const ProjectMark = ({ seed, name, className }: ProjectMarkProps) => (
  <span
    aria-hidden='true'
    style={{ '--mark-hue': hueFor(seed) } as CSSProperties}
    className={cn(
      'grid size-5 shrink-0 place-items-center rounded-md text-[0.6875rem] font-semibold uppercase',
      'bg-[oklch(0.93_0.045_var(--mark-hue))] text-[oklch(0.4_0.1_var(--mark-hue))]',
      'dark:bg-[oklch(0.33_0.06_var(--mark-hue))] dark:text-[oklch(0.9_0.08_var(--mark-hue))]',
      className,
    )}
  >
    {name.trim().charAt(0) || '?'}
  </span>
)
