/** Keeps the items whose `getText` contains `search`, ignoring case and surrounding spaces. */
export const filterBySearch = <T>(
  items: readonly T[],
  search: string,
  getText: (item: T) => string,
): T[] => {
  const query = search.trim().toLowerCase()
  return items.filter((item) => getText(item).toLowerCase().includes(query))
}
