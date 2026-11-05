/**
 * The part of a Yjs `Map` that `syncCollection` uses. Declared structurally so
 * this package does not depend on yjs; a plain `Map` fits too.
 */
export type CollectionMap<T> = {
  keys(): Iterable<string>
  get(key: string): T | undefined
  set(key: string, value: T): unknown
  delete(key: string): unknown
}

/**
 * Structural equality of JSON values. Unlike comparing `JSON.stringify` output,
 * the key order of objects does not matter; keys holding `undefined` count as
 * missing, as they do once the value is stored in the document.
 */
export const isJsonEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, index) => isJsonEqual(value, b[index]))
    )
  }
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const leftKeys = Object.keys(left).filter((key) => left[key] !== undefined)
  const rightKeys = Object.keys(right).filter((key) => right[key] !== undefined)
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => Object.hasOwn(right, key) && isJsonEqual(left[key], right[key]))
  )
}

/**
 * Writes `next` into a diagram collection map (nodes, edges or areas; one entry
 * per element, keyed by id), shared by the web editor and the server. Only
 * elements that changed are set, so a concurrent edit of an element the caller
 * did not touch is not overwritten and unchanged elements don't churn the
 * document. `toStored` strips what must not be persisted; the comparison runs
 * on its result.
 */
export const syncCollection = <T extends { id: string }>(
  map: CollectionMap<T>,
  next: readonly T[],
  toStored: (element: T) => T = (element) => element,
) => {
  const ids = new Set(next.map((element) => element.id))
  for (const key of Array.from(map.keys())) {
    if (!ids.has(key)) map.delete(key)
  }
  for (const element of next) {
    const value = toStored(element)
    // `isJsonEqual` returns early on shared references, so elements whose nested
    // objects are untouched (e.g. a table's columns while another node is
    // dragged) are not walked in full.
    if (!isJsonEqual(map.get(element.id), value)) map.set(element.id, value)
  }
}
