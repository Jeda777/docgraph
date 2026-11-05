import { type ComponentType, lazy } from 'react'

/** `React.lazy` for a module that exports the component by name instead of as default. */
export const lazyNamed = <
  K extends string,
  // biome-ignore lint/suspicious/noExplicitAny: mirrors React.lazy's own `ComponentType<any>` constraint
  M extends Record<K, ComponentType<any>>,
>(
  load: () => Promise<M>,
  name: K,
) => lazy(() => load().then((module) => ({ default: module[name] })))
