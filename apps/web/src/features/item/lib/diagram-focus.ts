/**
 * Canvas -> sidebar "reveal this element" signal. A window event rather than a
 * prop chain, because the two live in unrelated parts of the React tree.
 *
 * Each diagram creates its own typed channel listing exactly the element kinds
 * it renders, so a focus target can never carry a kind that diagram doesn't
 * have a sidebar section for.
 */
export type DiagramFocusTarget<Kind extends string> = {
  kind: Kind
  id: string
}

const EVENT = 'diagram:focus'

export const createDiagramFocus = <Kind extends string>() => {
  const focusDiagramItem = (target: DiagramFocusTarget<Kind>) =>
    window.dispatchEvent(new CustomEvent(EVENT, { detail: target }))

  /** Subscribe; returns the unsubscribe, so it can be returned from an effect. */
  const onDiagramFocus = (handler: (target: DiagramFocusTarget<Kind>) => void) => {
    const listener = (e: Event) => handler((e as CustomEvent<DiagramFocusTarget<Kind>>).detail)
    window.addEventListener(EVENT, listener)
    return () => window.removeEventListener(EVENT, listener)
  }

  return { focusDiagramItem, onDiagramFocus }
}

export const revealSidebarCard = (prefix: string, id: string) => {
  requestAnimationFrame(() => {
    const el = document.querySelector(`#sidebar-${prefix}-${id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el?.animate(
      [{ boxShadow: '0 0 0 2px var(--primary)' }, { boxShadow: '0 0 0 2px transparent' }],
      { duration: 1200, easing: 'ease-out' },
    )
  })
}
